"""Exports d'un client : Excel (format du catalogue + 5 colonnes), CSV, layer ATT&CK Navigator."""
import csv
import io

from django.conf import settings
from openpyxl import Workbook
from openpyxl.styles import Font

from catalog.models import render_parametres
from catalog.services.exports import (
    DET_HEADERS,
    detection_row,
    put,
    safe,
    serves_count,
    style_sheet,
    to_bytes,
    write_sources_sheet,
)

from ..models import ClientSource, DetectionClient
from .coverage import client_coverage_map, parse_statuts

EXTRA_HEADERS = ["Statut", "Journalisation", "SIEM / XDR", "Règle", "Requêtes de hunting", "Exclusions", "Recommandation", "Impact", "Date de déploiement"]


def _detections(client):
    return (
        DetectionClient.objects.filter(client=client)
        .select_related("domaine")
        .prefetch_related("detection_sources__source", "techniques", "syntaxes__siem", "requetehuntings__siem")
    )


def _regle(d: DetectionClient, siems) -> str:
    valeurs, blocs = d.valeurs_parametres(), []
    for siem in siems:
        s = next((x for x in d.syntaxes.all() if x.siem_id == siem.pk), None)
        if s is None:
            blocs.append(f"[{siem.nom}] non renseignée")
        else:
            texte, _ = render_parametres(s.contenu, valeurs)
            blocs.append(f"[{siem.nom}]\n{texte}")
    return "\n\n".join(blocs)


def _hunting(d: DetectionClient, siems) -> str:
    valeurs, blocs = d.valeurs_parametres(), []
    for siem in siems:
        reqs = [h for h in d.requetehuntings.all() if h.siem_id == siem.pk]
        if not reqs:
            blocs.append(f"[{siem.nom}] non renseignée")
        for h in reqs:
            texte, _ = render_parametres(h.requete, valeurs)
            blocs.append(f"[{siem.nom}] {h.titre}\n{texte}")
    return "\n\n".join(blocs)


def client_rows(client) -> list[list]:
    siems = list(client.siems.all())
    rows = []
    for d in _detections(client):
        rows.append(
            detection_row(d)
            + [d.get_statut_display(), d.get_journalisation_display(), ", ".join(s.nom for s in siems), _regle(d, siems), _hunting(d, siems),
               d.exclusions, d.recommandation, d.impact, d.date_deploiement.isoformat() if d.date_deploiement else ""]
        )
    return rows


def client_workbook(client) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Detections"
    ws.append(DET_HEADERS + EXTRA_HEADERS)
    for r, row in enumerate(client_rows(client), start=2):
        for c, v in enumerate(row, start=1):
            put(ws, r, c, v)
    style_sheet(ws, [10, 22, 40, 12, 45, 35, 70, 10, 38, 12, 14, 24, 80, 80, 40, 40, 40, 14])

    ws2 = wb.create_sheet("Sources_logs")
    statuts = {cs.source_id: cs for cs in ClientSource.objects.filter(client=client)}
    extra = {
        sid: [cs.get_statut_display(), cs.commentaire] for sid, cs in statuts.items()
    }
    write_sources_sheet(ws2, ["Statut chez le client", "Commentaire"], extra, serves_count())
    style_sheet(ws2, [30, 60, 45, 55, 14, 18, 40])

    ws3 = wb.create_sheet("Lisez-moi")
    for r, (k, v) in enumerate(
        [
            ("Client", client.nom),
            ("Secteur", client.secteur),
            ("Plateformes SIEM / XDR", ", ".join(s.nom for s in client.siems.all())),
            ("Domaines retenus", ", ".join(d.nom for d in client.domaines.all())),
            ("Export", "SOC UCF – UC Factory du client (format du catalogue + colonnes client)"),
            ("Paramètres", "Les paramètres {{nom}} des règles sont remplacés par les valeurs du client."),
        ],
        start=1,
    ):
        put(ws3, r, 1, k).font = Font(bold=True)
        put(ws3, r, 2, v)
    ws3.column_dimensions["A"].width = 22
    ws3.column_dimensions["B"].width = 90
    return to_bytes(wb)


def _csv_safe(v) -> str:
    text = safe(v)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def client_csv(client) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(DET_HEADERS + EXTRA_HEADERS)
    for row in client_rows(client):
        w.writerow([_csv_safe(v) for v in row])
    return "﻿" + buf.getvalue()


def navigator_layer(client, statuts_raw: str | None = None) -> dict:
    statuts = parse_statuts(statuts_raw)
    cov = client_coverage_map(client, statuts)
    techniques = [
        {"techniqueID": tid, "score": c["count"], "comment": ", ".join(sorted(c["detections"])), "enabled": True}
        for tid, c in sorted(cov.items())
    ]
    major = settings.ATTACK_VERSION.split(".")[0]
    return {
        "name": f"SOC UCF – {client.nom}",
        "versions": {"attack": major, "navigator": "5.1.0", "layer": "4.5"},
        "domain": "enterprise-attack",
        "description": f"Couverture de détection de {client.nom} (statuts : {', '.join(statuts)}).",
        "sorting": 0,
        "layout": {"layout": "side", "aggregateFunction": "average", "showID": False, "showName": True,
                   "showAggregateScores": False, "countUnscored": False, "expandedSubtechniques": "none"},
        "hideDisabled": False,
        "techniques": techniques,
        "gradient": {"colors": ["#ffffff", "#8ec6ff", "#1f6feb"], "minValue": 0, "maxValue": max([t["score"] for t in techniques] + [1])},
        "legendItems": [], "metadata": [], "links": [], "showTooltips": True,
        "selectTechniquesAcrossTactics": True, "selectSubtechniquesWithParent": False,
    }
