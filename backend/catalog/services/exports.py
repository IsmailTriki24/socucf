"""Export Excel au format du catalogue (feuilles Detections, Sources_logs, Lisez-moi)."""
import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from ..models import SourceLog, Template

DET_HEADERS = [
    "ID", "Domaine", "Cas d'usage (attaque détectée)", "Type", "Logs à collecter", "Source des logs",
    "Logique de la règle", "Gravité", "MITRE ATT&CK",
]
SRC_HEADERS = ["Source des logs", "À activer / à collecter", "Événements ou champs clés", "Piège fréquent", "Cas d'usage servis"]
MAX_CELL = 32000
HEAD_FILL = PatternFill("solid", fgColor="1F2A44")
HEAD_FONT = Font(bold=True, color="FFFFFF")


def safe(value):
    """Texte sûr pour une cellule : jamais interprété comme formule (injection de formule Excel)."""
    if value is None:
        return ""
    text = str(value)
    if len(text) > MAX_CELL:
        text = text[:MAX_CELL] + "\n[… tronqué]"
    return text


def put(ws, row, col, value):
    cell = ws.cell(row=row, column=col)
    if isinstance(value, str):
        cell.value = safe(value)
        cell.data_type = "s"  # force le type texte : « =… » n'est pas évalué
    else:
        cell.value = value
    return cell


def style_sheet(ws, widths: list[int], header_row=1):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in ws[header_row]:
        c.fill, c.font = HEAD_FILL, HEAD_FONT
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for row in ws.iter_rows(min_row=header_row + 1):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = ws.cell(row=header_row + 1, column=2)
    ws.auto_filter.ref = ws.dimensions


def detection_row(obj, code=None, domaine_nom=None) -> list:
    """Ligne au format du catalogue ; ``obj`` est un Template ou une DetectionClient (mêmes champs de contenu)."""
    sources = obj.template_sources.all() if hasattr(obj, "template_sources") else obj.detection_sources.all()
    return [
        code or obj.code,
        domaine_nom or obj.domaine.nom,
        obj.cas_usage,
        obj.type_detection,
        obj.logs_a_collecter,
        "\n".join(ts.source.nom for ts in sources),
        obj.logique,
        obj.gravite,
        "\n".join(f"{t.identifiant} {t.nom}" for t in obj.techniques.all()) or "—",
    ]


def write_sources_sheet(ws, extra_headers=(), extra_values=None, serves=None):
    ws.append(SRC_HEADERS + list(extra_headers))
    for i, s in enumerate(SourceLog.objects.all(), start=2):
        values = [s.nom, s.a_activer, s.evenements_cles, s.piege, (serves or {}).get(s.pk, 0)]
        values += (extra_values or {}).get(s.pk, ["" for _ in extra_headers])
        for j, v in enumerate(values, start=1):
            put(ws, i, j, v)


def serves_count() -> dict:
    out: dict[int, int] = {}
    for ts in Template.objects.values_list("template_sources__source_id", flat=True):
        if ts:
            out[ts] = out.get(ts, 0) + 1
    return out


def to_bytes(wb: Workbook) -> bytes:
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def catalogue_workbook() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Detections"
    ws.append(DET_HEADERS)
    qs = Template.objects.select_related("domaine").prefetch_related("template_sources__source", "techniques")
    for r, t in enumerate(qs, start=2):
        for c, v in enumerate(detection_row(t), start=1):
            put(ws, r, c, v)
    style_sheet(ws, [10, 22, 40, 12, 45, 35, 70, 10, 38])
    ws2 = wb.create_sheet("Sources_logs")
    write_sources_sheet(ws2, serves=serves_count())
    style_sheet(ws2, [30, 60, 45, 55, 14])
    return to_bytes(wb)
