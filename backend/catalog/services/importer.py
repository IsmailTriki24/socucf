"""Import du catalogue Excel v1.0 (feuilles Detections, Sources_logs et Lisez-moi).

La simulation (``dry_run``) exécute le véritable import dans une transaction qui est ensuite annulée :
le rapport est donc identique à celui d'un import réel.
"""
import re
from dataclasses import dataclass, field

import openpyxl
from django.db import transaction

from ..models import (
    AideEntree,
    Domaine,
    GuideTraduction,
    Gravite,
    SourceLog,
    TechniqueMitre,
    Template,
    TemplateSource,
    TypeDetection,
)
from .referentiels import ensure_siems, siem_code_from_header

CODE_RE = re.compile(r"^DET-\d{3,}$")
TECH_RE = re.compile(r"^T\d{4}(\.\d{3})?$")
TYPES = {t.value for t in TypeDetection}
ANCIENS_TYPES = {"Simple": TypeDetection.UNITAIRE.value}
GRAVITES = {g.value for g in Gravite}
EMPTY_MITRE = {"", "—", "-", "–"}


class ImportError_(Exception):
    """Fichier inexploitable (feuille manquante, colonnes absentes)."""


class _Rollback(Exception):
    pass


@dataclass
class Report:
    dry_run: bool
    fichier: str = ""
    anomalies: list = field(default_factory=list)
    lignes: list = field(default_factory=list)
    compteurs: dict = field(default_factory=lambda: {
        "templates_crees": 0, "templates_mis_a_jour": 0, "templates_inchanges": 0, "templates_rejetes": 0,
        "sources_creees": 0, "sources_mises_a_jour": 0, "domaines_crees": 0, "techniques_creees": 0,
        "guide_traduction": 0, "aide_en_ligne": 0,
    })

    def anomalie(self, niveau, feuille, ligne, code, message):
        self.anomalies.append({"niveau": niveau, "feuille": feuille, "ligne": ligne, "code": code, "message": message})

    def as_dict(self):
        erreurs = sum(1 for a in self.anomalies if a["niveau"] == "erreur")
        return {
            "dry_run": self.dry_run,
            "fichier": self.fichier,
            "compteurs": self.compteurs,
            "nb_erreurs": erreurs,
            "nb_avertissements": len(self.anomalies) - erreurs,
            "anomalies": self.anomalies,
            "lignes": self.lignes,
        }


def _s(v) -> str:
    return "" if v is None else str(v).strip()


def _lines(v) -> list[str]:
    return [x.strip() for x in _s(v).replace("\r", "").split("\n") if x.strip()]


def _headers(ws, expected: list[str]) -> dict[str, int]:
    row = [_s(c).lower() for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    idx = {}
    for name in expected:
        if name.lower() not in row:
            raise ImportError_(f"Feuille « {ws.title} » : colonne « {name} » introuvable.")
        idx[name] = row.index(name.lower())
    return idx


def _parse_lisez_moi(ws, report: Report):
    """Retourne (domaines ordonnés, guide[(notion, {code_siem: texte})], aide[(section, titre, texte)])."""
    rows = [[_s(c.value) for c in r] + [""] * (6 - len(r)) for r in ws.iter_rows(min_row=1, max_col=6)]
    domaines, guide, aide = [], [], []
    for i, r in enumerate(rows):
        a, b = r[0], r[1]
        if i == 4 and a:
            aide.append(("principe", "Principe", a, 0))
        if re.match(r"^\d\.\s", a) and b:
            aide.append(("etapes", a, b, int(a[0])))
        if a in ("Type", "Gravité", "Logique de la règle", "MITRE ATT&CK") and b:
            aide.append(("definitions", a, b, len([x for x in aide if x[0] == "definitions"]) + 1))
    # Guide de traduction : en-tête « Notion »
    start = next((i for i, r in enumerate(rows) if r[0] == "Notion"), None)
    if start is None:
        report.anomalie("avertissement", "Lisez-moi", None, "guide_absent", "Tableau « Traduire la logique dans votre SIEM / XDR » introuvable.")
    else:
        cols = {j: siem_code_from_header(rows[start][j]) for j in range(1, 6) if rows[start][j]}
        for r in rows[start + 1:]:
            if not r[0] or r[0].startswith("Pour un autre"):
                break
            guide.append((r[0], {code: r[j] for j, code in cols.items() if code and r[j]}))
    # Domaines : en-tête « Domaine » jusqu'à « Total »
    start = next((i for i, r in enumerate(rows) if r[0] == "Domaine"), None)
    if start is not None:
        for r in rows[start + 1:]:
            if not r[0] or r[0] == "Total":
                break
            domaines.append(r[0])
    return domaines, guide, aide


def import_workbook(fileobj, filename: str = "", user=None, dry_run: bool = True) -> dict:
    report = Report(dry_run=dry_run, fichier=filename)
    try:
        wb = openpyxl.load_workbook(fileobj, data_only=False)
    except Exception as exc:  # fichier corrompu ou format non Excel
        raise ImportError_(f"Fichier Excel illisible : {exc}") from exc
    for name in ("Detections", "Sources_logs"):
        if name not in wb.sheetnames:
            raise ImportError_(f"Feuille « {name} » introuvable.")
    try:
        with transaction.atomic():
            _run(wb, report, user, filename)
            if dry_run:
                raise _Rollback()
    except _Rollback:
        pass
    return report.as_dict()


def _run(wb, report: Report, user, filename: str):
    siems = ensure_siems()

    # --- Lisez-moi
    domaines_liste, guide, aide = [], [], []
    if "Lisez-moi" in wb.sheetnames:
        domaines_liste, guide, aide = _parse_lisez_moi(wb["Lisez-moi"], report)
    else:
        report.anomalie("avertissement", "Lisez-moi", None, "feuille_absente", "Feuille Lisez-moi absente : domaines déduits de la feuille Detections.")
    for ordre, nom in enumerate(domaines_liste):
        d, created = Domaine.objects.get_or_create(nom=nom, defaults={"ordre": ordre})
        if created:
            report.compteurs["domaines_crees"] += 1
        elif d.ordre != ordre:
            d.ordre = ordre
            d.save()
    for ordre, (notion, textes) in enumerate(guide):
        for code, texte in textes.items():
            obj, _ = GuideTraduction.objects.update_or_create(
                notion=notion, siem=siems[code], defaults={"texte": texte, "ordre": ordre}
            )
            report.compteurs["guide_traduction"] += 1
    for section, titre, texte, ordre in aide:
        AideEntree.objects.update_or_create(section=section, titre=titre, defaults={"texte": texte, "ordre": ordre})
        report.compteurs["aide_en_ligne"] += 1

    # --- Sources_logs
    ws = wb["Sources_logs"]
    h = _headers(ws, ["Source des logs", "À activer / à collecter", "Événements ou champs clés", "Piège fréquent"])
    sources = {}
    for n, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        nom = _s(row[h["Source des logs"]])
        if not nom:
            continue
        if nom in sources:
            report.anomalie("erreur", "Sources_logs", n, "source_doublon", f"Source « {nom} » en double : ligne ignorée.")
            continue
        values = {
            "a_activer": _s(row[h["À activer / à collecter"]]),
            "evenements_cles": _s(row[h["Événements ou champs clés"]]),
            "piege": _s(row[h["Piège fréquent"]]),
            "ordre": len(sources),
        }
        obj, created = SourceLog.objects.get_or_create(nom=nom, defaults=values)
        if created:
            report.compteurs["sources_creees"] += 1
        elif any(getattr(obj, k) != v for k, v in values.items()):
            for k, v in values.items():
                setattr(obj, k, v)
            obj.save()
            report.compteurs["sources_mises_a_jour"] += 1
        sources[nom] = obj

    # --- Referentiel ATT&CK disponible ?
    referentiel_charge = TechniqueMitre.objects.filter(verifiee=True).exists()
    if not referentiel_charge:
        report.anomalie(
            "avertissement", "Detections", None, "referentiel_attack_absent",
            "Référentiel ATT&CK non chargé : les identifiants du fichier n'ont pas pu être vérifiés. "
            "Chargez le bundle STIX (commande import_attack) puis relancez la vérification.",
        )

    # --- Detections
    ws = wb["Detections"]
    h = _headers(ws, ["ID", "Domaine", "Cas d'usage (attaque détectée)", "Type", "Logs à collecter", "Source des logs", "Logique de la règle", "Gravité", "MITRE ATT&CK"])
    vus = set()
    techniques_cache = {t.identifiant: t for t in TechniqueMitre.objects.all()}
    for n, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        code = _s(row[h["ID"]])
        erreurs = []
        if not CODE_RE.match(code):
            erreurs.append(("id_invalide", f"Identifiant « {code} » invalide (attendu DET-001)."))
        elif code in vus:
            erreurs.append(("id_doublon", f"{code} apparaît plusieurs fois dans le fichier."))
        vus.add(code)
        domaine_nom = _s(row[h["Domaine"]])
        if domaines_liste and domaine_nom not in domaines_liste:
            erreurs.append(("domaine_inconnu", f"Domaine « {domaine_nom} » absent des domaines du Lisez-moi."))
        elif not domaine_nom:
            erreurs.append(("domaine_vide", "Domaine manquant."))
        typ = ANCIENS_TYPES.get(_s(row[h["Type"]]), _s(row[h["Type"]]))  # « Simple » des anciens fichiers
        if typ not in TYPES:
            erreurs.append(("type_invalide", f"Type « {typ} » invalide (Unitaire, Seuil ou Corrélation)."))
        grav = _s(row[h["Gravité"]])
        if grav not in GRAVITES:
            erreurs.append(("gravite_invalide", f"Gravité « {grav} » invalide."))
        cas = _s(row[h["Cas d'usage (attaque détectée)"]])
        if not cas:
            erreurs.append(("cas_usage_vide", "Cas d'usage manquant."))
        noms_sources = _lines(row[h["Source des logs"]])
        if not noms_sources:
            erreurs.append(("source_vide", "Aucune source de logs indiquée."))
        for nom in noms_sources:
            if nom not in sources:
                erreurs.append(("source_inconnue", f"Source « {nom} » absente de la feuille Sources_logs."))
        tech_ids = []
        for line in _lines(row[h["MITRE ATT&CK"]]):
            if line in EMPTY_MITRE:
                continue
            tid, _, nom_tech = line.partition(" ")
            if not TECH_RE.match(tid):
                report.anomalie("erreur", "Detections", n, "technique_invalide", f"{code} : identifiant ATT&CK « {tid} » mal formé.")
                continue
            tech_ids.append((tid, nom_tech.strip()))
        if erreurs:
            for c, m in erreurs:
                report.anomalie("erreur", "Detections", n, c, f"{code or '(sans ID)'} : {m}")
            report.compteurs["templates_rejetes"] += 1
            report.lignes.append({"ligne": n, "code": code, "action": "rejete"})
            continue

        # Techniques : lier au référentiel, ou créer un enregistrement non vérifié
        techniques = []
        for tid, nom_tech in tech_ids:
            tech = techniques_cache.get(tid)
            if tech is None:
                tech = TechniqueMitre.objects.create(identifiant=tid, nom=nom_tech or tid, verifiee=False)
                techniques_cache[tid] = tech
                report.compteurs["techniques_creees"] += 1
                if referentiel_charge:
                    report.anomalie("avertissement", "Detections", n, "technique_inconnue", f"{code} : technique {tid} {nom_tech} inconnue du référentiel ATT&CK chargé.")
            elif tech.verifiee and nom_tech and tech.nom != nom_tech:
                report.anomalie("avertissement", "Detections", n, "technique_renommee", f"{code} : {tid} s'appelle « {tech.nom} » dans le référentiel, « {nom_tech} » dans le fichier.")
            elif tech.revoquee or tech.obsolete:
                report.anomalie("avertissement", "Detections", n, "technique_obsolete", f"{code} : {tid} est {'révoquée' if tech.revoquee else 'obsolète'} dans le référentiel.")
            techniques.append(tech)

        domaine = Domaine.objects.get_or_create(nom=domaine_nom, defaults={"ordre": 99})[0]
        contenu = {
            "cas_usage": cas,
            "type_detection": typ,
            "logs_a_collecter": _s(row[h["Logs à collecter"]]),
            "logique": _s(row[h["Logique de la règle"]]),
            "gravite": grav,
        }
        report.lignes.append({"ligne": n, "code": code, "action": _upsert_template(code, domaine, contenu, noms_sources, sources, techniques, user, filename, report)})


def _upsert_template(code, domaine, contenu, noms_sources, sources, techniques, user, filename, report) -> str:
    template, created = Template.objects.get_or_create(code=code, defaults={"domaine": domaine, **contenu})
    wanted = {
        **contenu,
        "domaine": domaine.nom,
        "sources": sorted(noms_sources),
        "techniques": sorted(t.identifiant for t in techniques),
    }
    if created:
        _fill_links(template, noms_sources, sources, techniques)
        report.compteurs["templates_crees"] += 1
        return "creer"
    actuel = {
        **{k: getattr(template, k) for k in contenu},
        "domaine": template.domaine.nom,
        "sources": sorted(ts.source.nom for ts in template.template_sources.select_related("source")),
        "techniques": sorted(template.techniques.values_list("identifiant", flat=True)),
    }
    if actuel == wanted:
        report.compteurs["templates_inchanges"] += 1
        return "inchange"
    for k, v in contenu.items():
        setattr(template, k, v)
    template.domaine = domaine
    template.save()
    _fill_links(template, noms_sources, sources, techniques)
    report.compteurs["templates_mis_a_jour"] += 1
    return "mise_a_jour"


def _fill_links(template: Template, noms_sources, sources, techniques):
    template.techniques.set(techniques)
    existantes = {ts.source.nom: ts for ts in template.template_sources.select_related("source")}
    for nom, ts in existantes.items():
        if nom not in noms_sources:
            ts.delete()
    for nom in noms_sources:
        if nom not in existantes:
            TemplateSource.objects.create(template=template, source=sources[nom])
