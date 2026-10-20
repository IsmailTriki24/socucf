from catalog.models import Template
from catalog.services.coverage import _max_statut, build_matrix

from ..models import DetectionClient, StatutDetection

STATUTS_VALIDES = {s.value for s in StatutDetection}


def parse_statuts(raw: str | None) -> list[str]:
    if not raw:
        return [StatutDetection.DEPLOYEE.value]  # par défaut : Déployé seulement
    statuts = [s for s in raw.split(",") if s in STATUTS_VALIDES]
    return statuts or [StatutDetection.DEPLOYEE.value]


def client_coverage_map(client, statuts: list[str]) -> dict[str, dict]:
    cov: dict[str, dict] = {}
    qs = DetectionClient.objects.filter(client=client, statut__in=statuts).prefetch_related("techniques")
    for d in qs:
        for t in d.techniques.all():
            c = cov.setdefault(t.identifiant, {"count": 0, "detections": [], "statut": None})
            c["detections"].append(d.code)
            c["count"] += 1
            c["statut"] = _max_statut(c["statut"], d.statut)
    return cov


def client_matrix(client, statuts, seulement_couvertes=False) -> dict:
    return build_matrix(client_coverage_map(client, statuts), seulement_couvertes=seulement_couvertes)


def non_couvertes(client, statuts) -> list[dict]:
    """Techniques de la bibliothèque non couvertes aux statuts choisis, avec ce que le client peut faire pour les couvrir."""
    cov = client_coverage_map(client, statuts)
    chez_client = {d.code: d for d in DetectionClient.objects.filter(client=client)}
    domaines = set(client.domaines.values_list("nom", flat=True))
    out: dict[str, dict] = {}
    for t in Template.objects.select_related("domaine").prefetch_related("techniques"):
        for tech in t.techniques.all():
            if tech.identifiant in cov:
                continue
            row = out.setdefault(tech.identifiant, {"identifiant": tech.identifiant, "nom": tech.nom, "templates": []})
            d = chez_client.get(t.code)
            if d:
                etat = f"chez_le_client:{d.statut}"
            elif t.domaine.nom in domaines:
                etat = "a_ajouter"
            else:
                etat = "hors_domaine"
            row["templates"].append({"code": t.code, "cas_usage": t.cas_usage, "etat": etat})
    return sorted(out.values(), key=lambda r: r["identifiant"])
