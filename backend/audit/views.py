from datetime import datetime

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.permissions import get_client_or_404

from .models import JournalAudit


def _entry(e: JournalAudit) -> dict:
    return {
        "id": e.pk, "date": e.date, "utilisateur": e.utilisateur_nom, "utilisateur_id": e.utilisateur_id,
        "client_id": e.client_id, "client": e.client_nom, "objet_type": e.objet_type, "objet_id": e.objet_id,
        "objet": e.objet_repr, "action": e.action, "avant": e.avant, "apres": e.apres,
    }


def _filter(qs, p):
    if p.get("utilisateur"):
        qs = qs.filter(utilisateur_nom__icontains=p["utilisateur"])
    if p.get("objet_type"):
        qs = qs.filter(objet_type=p["objet_type"])
    if p.get("action"):
        qs = qs.filter(action=p["action"])
    if p.get("q"):
        qs = qs.filter(objet_repr__icontains=p["q"])
    for key, lookup in (("du", "date__gte"), ("au", "date__lte")):
        if p.get(key):
            try:
                d = datetime.fromisoformat(p[key])
                qs = qs.filter(**{lookup: timezone.make_aware(d) if timezone.is_naive(d) else d})
            except ValueError:
                pass
    return qs


def _page(qs, p):
    try:
        limit = min(int(p.get("limit", 50)), 200)
        offset = max(int(p.get("offset", 0)), 0)
    except ValueError:
        limit, offset = 50, 0
    total = qs.count()
    return Response({"total": total, "limit": limit, "offset": offset, "resultats": [_entry(e) for e in qs[offset:offset + limit]]})


@api_view(["GET"])
def client_audit(request, client_id):
    c = get_client_or_404(request.user, client_id, "audit.view")
    return _page(_filter(JournalAudit.objects.filter(client=c), request.query_params), request.query_params)


@api_view(["GET"])
def global_audit(request):
    """Journal complet : Administrateur plateforme (catalogue, utilisateurs, tous les clients)."""
    if not request.user.is_platform_admin:
        raise PermissionDenied("Réservé à l'Administrateur plateforme.")
    return _page(_filter(JournalAudit.objects.all(), request.query_params), request.query_params)
