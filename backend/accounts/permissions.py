"""Matrice de droits (plan §Rôles et droits par client) et contrôle côté serveur.

Tout accès aux données d'un client passe par ``client_for_user`` / ``Client.objects.visible_to`` :
un identifiant dans l'URL ne suffit jamais.
"""
from django.http import Http404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from .models import RoleClient

ADMIN_PLATEFORME = "admin_plateforme"
ADMIN_CLIENT = RoleClient.ADMIN_CLIENT.value
VALIDEUR = RoleClient.VALIDEUR.value
CONTRIBUTEUR = RoleClient.CONTRIBUTEUR.value
LECTEUR = RoleClient.LECTEUR.value

_ALL = {ADMIN_PLATEFORME, ADMIN_CLIENT, VALIDEUR, CONTRIBUTEUR, LECTEUR}

# permission client -> rôles autorisés (le Responsable catalogue n'a aucun droit client en soi).
CLIENT_PERMISSIONS: dict[str, set[str]] = {
    "client.view": _ALL,
    "client.edit": {ADMIN_PLATEFORME, ADMIN_CLIENT},
    "detection.edit": {ADMIN_PLATEFORME, ADMIN_CLIENT, VALIDEUR, CONTRIBUTEUR},
    "habilitation.manage": {ADMIN_PLATEFORME, ADMIN_CLIENT},
    "export": _ALL,
    "audit.view": {ADMIN_PLATEFORME, ADMIN_CLIENT, VALIDEUR},
}


def role_on_client(user, client) -> str | None:
    """Rôle effectif de l'utilisateur sur un client, ou None s'il n'a aucun droit."""
    if not user or not user.is_authenticated or not user.is_active:
        return None
    if user.is_platform_admin:
        return ADMIN_PLATEFORME
    from .models import Habilitation

    client_id = getattr(client, "pk", client)
    return (
        Habilitation.objects.filter(utilisateur=user, client_id=client_id, client__actif=True)
        .values_list("role", flat=True)
        .first()
    )


def can(user, client, permission: str) -> bool:
    role = role_on_client(user, client)
    return role is not None and role in CLIENT_PERMISSIONS[permission]


def permissions_on_client(user, client) -> dict[str, bool]:
    role = role_on_client(user, client)
    return {p: (role is not None and role in roles) for p, roles in CLIENT_PERMISSIONS.items()}


def get_client_or_404(user, client_id, permission: str = "client.view"):
    """Retourne le client si l'utilisateur est habilité, sinon 404 (aucune fuite d'existence).

    Une habilitation existante mais insuffisante pour ``permission`` donne un 403.
    """
    from clients.models import Client

    client = Client.objects.visible_to(user).filter(pk=client_id).first()
    if client is None:
        raise Http404()
    if not can(user, client, permission):
        raise PermissionDenied("Droits insuffisants sur ce client.")
    return client


class IsCatalogueManager(BasePermission):
    """Écriture sur les templates : Admin plateforme et Responsable catalogue."""

    message = "Réservé au Responsable catalogue ou à l'Administrateur plateforme."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_catalogue_manager)


class IsPlatformAdmin(BasePermission):
    message = "Réservé à l'Administrateur plateforme."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_platform_admin)


class CatalogueReadOrManage(BasePermission):
    """Lecture du catalogue pour tout utilisateur connecté, écriture pour les gestionnaires."""

    message = "Seul le Responsable catalogue ou l'Administrateur plateforme peut modifier le catalogue."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return user.is_catalogue_manager
