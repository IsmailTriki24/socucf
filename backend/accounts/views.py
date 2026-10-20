from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db.models import Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from clients.models import Client

from .models import Habilitation, RoleClient, RoleGlobal, User
from .permissions import IsPlatformAdmin, can, get_client_or_404


def oidc_enabled() -> bool:
    return bool(getattr(settings, "OIDC_RP_CLIENT_ID", ""))


def user_payload(user) -> dict:
    habs = Habilitation.objects.filter(utilisateur=user, client__actif=True).select_related("client")
    return {
        "id": user.pk,
        "username": user.username,
        "nom": user.nom_affiche,
        "email": user.email,
        "role_global": user.role_global,
        "is_platform_admin": user.is_platform_admin,
        "is_catalogue_manager": user.is_catalogue_manager,
        "habilitations": [{"client_id": h.client_id, "client_nom": h.client.nom, "role": h.role} for h in habs],
    }


class LoginThrottle(ScopedRateThrottle):
    scope = "login"


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    return Response({"csrfToken": get_token(request), "oidc": oidc_enabled()})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    user = authenticate(request, username=request.data.get("username", ""), password=request.data.get("password", ""))
    if user is None:
        return Response({"detail": "Identifiants invalides."}, status=status.HTTP_401_UNAUTHORIZED)
    if oidc_enabled() and not user.is_platform_admin:
        return Response({"detail": "Connexion locale réservée au compte de secours : utilisez le SSO."}, status=status.HTTP_403_FORBIDDEN)
    login(request, user)
    return Response(user_payload(user))


@api_view(["POST"])
def logout_view(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def me(request):
    return Response(user_payload(request.user))


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=12)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role_global", "is_active", "password", "last_login"]
        read_only_fields = ["last_login"]

    def create(self, validated):
        password = validated.pop("password", None)
        user = User(**validated)
        user.set_password(password) if password else user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated):
        password = validated.pop("password", None)
        for k, v in validated.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


@api_view(["GET", "POST"])
@permission_classes([IsPlatformAdmin])
def users(request):
    if request.method == "GET":
        return Response(UserSerializer(User.objects.order_by("username"), many=True).data)
    ser = UserSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    return Response(UserSerializer(ser.save()).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsPlatformAdmin])
def user_detail(request, pk):
    user = User.objects.filter(pk=pk).first()
    if user is None:
        raise NotFound()
    if user.pk == request.user.pk and request.data.get("is_active") is False:
        return Response({"detail": "Vous ne pouvez pas désactiver votre propre compte."}, status=400)
    ser = UserSerializer(user, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    return Response(UserSerializer(ser.save()).data)


@api_view(["GET"])
def user_lookup(request):
    """Recherche par identifiant ou e-mail exact (pour ajouter une habilitation) : pas de liste complète."""
    q = request.query_params.get("q", "").strip()
    if not q:
        return Response([])
    if not (request.user.is_platform_admin or Habilitation.objects.filter(utilisateur=request.user, role=RoleClient.ADMIN_CLIENT).exists()):
        raise PermissionDenied()
    found = User.objects.filter(is_active=True).filter(Q(username__iexact=q) | Q(email__iexact=q))[:5]
    return Response([{"id": u.pk, "username": u.username, "nom": u.nom_affiche, "email": u.email} for u in found])


def hab_payload(h: Habilitation) -> dict:
    return {
        "id": h.pk, "client_id": h.client_id, "client_nom": h.client.nom, "role": h.role,
        "utilisateur_id": h.utilisateur_id, "username": h.utilisateur.username, "nom": h.utilisateur.nom_affiche,
        "email": h.utilisateur.email,
    }


@api_view(["GET", "POST"])
def client_habilitations(request, client_id):
    perm = "client.view" if request.method == "GET" else "habilitation.manage"
    client = get_client_or_404(request.user, client_id, perm)
    if request.method == "GET":
        if not can(request.user, client, "habilitation.manage"):
            raise PermissionDenied("Droits insuffisants.")
        habs = client.habilitations.select_related("utilisateur", "client")
        return Response([hab_payload(h) for h in habs])
    role = request.data.get("role")
    if role not in RoleClient.values:
        return Response({"detail": "Rôle invalide."}, status=400)
    user = User.objects.filter(pk=request.data.get("utilisateur_id"), is_active=True).first()
    if user is None:
        return Response({"detail": "Utilisateur introuvable."}, status=400)
    hab, created = Habilitation.objects.get_or_create(utilisateur=user, client=client, defaults={"role": role})
    if not created:
        return Response({"detail": "Cet utilisateur est déjà habilité sur ce client."}, status=409)
    return Response(hab_payload(hab), status=201)


@api_view(["PATCH", "DELETE"])
def habilitation_detail(request, pk):
    hab = Habilitation.objects.select_related("client", "utilisateur").filter(pk=pk).first()
    if hab is None:
        raise NotFound()
    get_client_or_404(request.user, hab.client_id, "habilitation.manage")  # 404/403 si hors périmètre
    if hab.utilisateur_id == request.user.pk and not request.user.is_platform_admin:
        return Response({"detail": "Vous ne pouvez pas modifier votre propre habilitation."}, status=400)
    if request.method == "DELETE":
        hab.delete()
        return Response(status=204)
    role = request.data.get("role")
    if role not in RoleClient.values:
        return Response({"detail": "Rôle invalide."}, status=400)
    hab.role = role
    hab.save()
    return Response(hab_payload(hab))


@api_view(["GET"])
def acces(request):
    """Écran « qui a accès à quoi » : habilitations des clients que l'on administre."""
    if request.user.is_platform_admin:
        clients = Client.objects.all()
    else:
        ids = Habilitation.objects.filter(utilisateur=request.user, role=RoleClient.ADMIN_CLIENT, client__actif=True).values("client")
        clients = Client.objects.filter(pk__in=ids)
    habs = Habilitation.objects.filter(client__in=clients).select_related("utilisateur", "client")
    out = {"habilitations": [hab_payload(h) for h in habs]}
    if request.user.is_platform_admin:
        out["utilisateurs_globaux"] = [
            {"id": u.pk, "username": u.username, "nom": u.nom_affiche, "role_global": u.role_global, "is_active": u.is_active}
            for u in User.objects.exclude(role_global="").order_by("username")
        ]
    return Response(out)
