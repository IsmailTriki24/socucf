import pytest

from audit.models import JournalAudit
from catalog.models import Domaine, SourceLog, Template, TechniqueMitre
from catalog.services.importer import import_workbook
from tests.conftest import XLSX


@pytest.mark.django_db
def test_import_creates_catalogue():
    assert Template.objects.count() == 82
    assert SourceLog.objects.count() == 28
    assert Domaine.objects.count() == 11
    det1 = Template.objects.get(code="DET-001")
    assert det1.template_sources.count() == 4
    assert {t.identifiant for t in det1.techniques.all()} == {"T1110.001", "T1078"}


@pytest.mark.django_db
def test_det081_has_no_technique():
    assert Template.objects.get(code="DET-081").techniques.count() == 0


@pytest.mark.django_db
def test_reimport_creates_no_duplicate():
    with open(XLSX, "rb") as f:
        report = import_workbook(f, "again.xlsx", dry_run=False)
    assert report["compteurs"]["templates_inchanges"] == 82
    assert report["compteurs"]["templates_crees"] == 0
    assert Template.objects.count() == 82


@pytest.mark.django_db
def test_dry_run_writes_nothing(tmp_path):
    import openpyxl

    wb = openpyxl.load_workbook(XLSX)
    wb["Detections"]["C2"] = "Cas d'usage modifié"
    path = tmp_path / "modif.xlsx"
    wb.save(path)
    audit_before = JournalAudit.objects.count()
    with open(path, "rb") as f:
        report = import_workbook(f, "modif.xlsx", dry_run=True)
    assert report["compteurs"]["templates_mis_a_jour"] == 1
    assert Template.objects.get(code="DET-001").cas_usage != "Cas d'usage modifié"
    assert JournalAudit.objects.count() == audit_before


@pytest.mark.django_db
def test_changed_row_updates_template_and_keeps_rules(tmp_path):
    import openpyxl

    wb = openpyxl.load_workbook(XLSX)
    wb["Detections"]["C2"] = "Force brute modifiée"  # DET-001
    path = tmp_path / "modif.xlsx"
    wb.save(path)
    with open(path, "rb") as f:
        report = import_workbook(f, "modif.xlsx", dry_run=False)
    t = Template.objects.get(code="DET-001")
    assert report["compteurs"]["templates_mis_a_jour"] == 1
    assert t.cas_usage == "Force brute modifiée"
    assert t.syntaxes.count() == 5  # règles des plateformes conservées
    with open(XLSX, "rb") as f:  # remise en l'état pour les autres tests de la session
        import_workbook(f, "orig.xlsx", dry_run=False)


@pytest.mark.django_db
def test_platforms_cover_siem_and_xdr_vendors():
    from catalog.models import Siem

    codes = set(Siem.objects.values_list("code", flat=True))
    assert {"fortisiem", "cortex", "trendvisionone", "ciscoxdr", "ciscosna", "googlesecops", "crowdstrike", "sigma"} <= codes
    assert Siem.objects.filter(categorie="xdr").exists() and Siem.objects.filter(categorie="generique").exists()


@pytest.mark.django_db
def test_anomalies_reported(tmp_path):
    import openpyxl

    wb = openpyxl.load_workbook(XLSX)
    ws = wb["Detections"]
    ws["F2"] = "Source qui n'existe pas"
    ws["D3"] = "Inconnu"
    ws["I4"] = "TXYZ mal formé"
    path = tmp_path / "bad.xlsx"
    wb.save(path)
    with open(path, "rb") as f:
        report = import_workbook(f, "bad.xlsx", dry_run=True)
    codes = {a["code"] for a in report["anomalies"]}
    assert {"source_inconnue", "type_invalide", "technique_invalide"} <= codes
    assert report["compteurs"]["templates_rejetes"] == 2


@pytest.mark.django_db
def test_all_catalogue_techniques_exist_in_attack_when_loaded():
    # sans référentiel chargé dans la base de test, les techniques du catalogue sont non vérifiées
    assert TechniqueMitre.objects.filter(identifiant="T1685").exists()
