"""Export PDF des détections d'un client : page de garde, synthèse, sommaire, puis une fiche par détection.

Le document est écrit en HTML/CSS (gabarit ``clients/detections_pdf.html``) et mis en page par WeasyPrint.
Les polices sont celles de l'interface (Schibsted Grotesk, JetBrains Mono, licence OFL), livrées dans ``clients/pdf/fonts`` ;
le logo du Tunisian Financial Cert (vectoriel) est dans ``clients/pdf``.
"""
from collections import OrderedDict
from pathlib import Path

from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.safestring import mark_safe

from django.utils.html import escape

from catalog.models import GRAVITE_ORDRE, PARAM_RE, TactiqueMitre

from ..models import DetectionClient, StatutDetection

ASSETS = Path(__file__).resolve().parent.parent / "pdf"

STATUT_COULEUR = {"brouillon": "#66749b", "en_test": "#0a86a6", "a_revoir": "#b26a00", "validee": "#7447d6", "deployee": "#12865a"}
GRAVITE_COULEUR = {"Critique": "#d6283c", "Haute": "#cc5a0a", "Moyenne": "#a67c00", "Basse": "#1f6fc4"}
GRAVITE_NIVEAU = {"Critique": 4, "Haute": 3, "Moyenne": 2, "Basse": 1}
STATUTS_VALIDES = {s.value for s in StatutDetection}


def css_string(texte: str) -> str:
    """Chaîne CSS littérale sûre (marges de page) : tout caractère hors lettres, chiffres et espaces est échappé."""
    return '"' + "".join(c if c.isalnum() or c == " " else f"\\{ord(c):x} " for c in texte) + '"'


def parse_statuts(raw: str | None) -> list[str]:
    """Statuts demandés ; aucun (ou aucun valide) = tous les statuts."""
    statuts = [s for s in (raw or "").split(",") if s in STATUTS_VALIDES]
    return statuts or [s.value for s in StatutDetection]


def parse_ids(raw: str | None) -> list[int] | None:
    if not raw:
        return None
    return [int(x) for x in raw.split(",") if x.strip().isdigit()]


def _fetcher():
    """Seules les ressources livrées avec l'application (polices) sont chargées : jamais d'URL distante ni de fichier arbitraire."""
    from weasyprint import URLFetcher

    racine = ASSETS.as_uri() + "/"

    class Fetcher(URLFetcher):
        def fetch(self, url, headers=None):
            if not url.startswith(racine) or ".." in url:
                raise ValueError(f"Ressource refusée dans le PDF : {url}")
            return super().fetch(url, headers)

    return Fetcher(allowed_protocols=["file"])


def _queryset(client):
    return (
        DetectionClient.objects.filter(client=client)
        .select_related("domaine", "template", "proprietaire", "modifie_par")
        .prefetch_related("techniques", "syntaxes__siem", "requetehuntings__siem", "preuves")
        .order_by("domaine__ordre", "domaine__nom", "code")
    )


NB_COULEURS_PARAM = 6  # classes .p-1 à .p-6 du gabarit


def _code_colore(texte: str, valeurs: dict, couleurs: dict) -> tuple[str, list[str]]:
    """Code de la règle avec chaque {{paramètre}} remplacé par sa valeur, dans la couleur de sa pastille ;
    un paramètre sans valeur reste {{nom}}, surligné en rouge. Tout le reste est échappé."""
    morceaux, manquants, fin = [], [], 0
    for m in PARAM_RE.finditer(texte or ""):
        morceaux.append(escape(texte[fin:m.start()]))
        nom = m.group(1)
        if nom in valeurs and valeurs[nom] not in (None, ""):
            morceaux.append(f'<span class="pv {couleurs.get(nom, "p-1")}">{escape(str(valeurs[nom]))}</span>')
        else:
            if nom not in manquants:
                manquants.append(nom)
            morceaux.append(f'<span class="pv-manquant">{escape(m.group(0))}</span>')
        fin = m.end()
    morceaux.append(escape((texte or "")[fin:]))
    return mark_safe("".join(morceaux)), manquants


def _fiche(d: DetectionClient, siems, tactiques: dict, technique: bool) -> dict:
    valeurs = d.valeurs_parametres()
    noms = list((d.parametres or {}).keys()) + [n for n in (d.listes_reference or {}) if n not in (d.parametres or {})]
    couleurs = {nom: f"p-{i % NB_COULEURS_PARAM + 1}" for i, nom in enumerate(noms)}
    techniques = [
        {"id": t.identifiant, "nom": t.nom, "tactiques": ", ".join(tactiques.get(x, x) for x in t.tactiques)}
        for t in sorted(d.techniques.all(), key=lambda t: t.identifiant)
    ]
    regles, regles_absentes, hunting = [], [], []
    if technique:
        for siem in siems:
            s = next((x for x in d.syntaxes.all() if x.siem_id == siem.pk), None)
            if s is None or not s.contenu.strip():
                regles_absentes.append(siem.nom)
                continue
            texte, manquants = _code_colore(s.contenu, valeurs, couleurs)
            regles.append({"siem": siem.nom, "langage": siem.langage_regle, "code": texte, "manquants": manquants,
                           "champs": s.champs_requis or [], "notes": s.notes})
        ordre = {s.pk: i for i, s in enumerate(siems)}
        for h in sorted(d.requetehuntings.all(), key=lambda h: (ordre.get(h.siem_id, 99), h.titre)):
            texte, _ = _code_colore(h.requete, valeurs, couleurs)
            hunting.append({"siem": h.siem.nom, "langage": h.siem.langage_hunting, "titre": h.titre, "objectif": h.objectif,
                            "periode": h.periode_conseillee, "code": texte})
    listes = [
        {"nom": nom, "couleur": couleurs[nom], "valeurs": ", ".join(str(v) for v in (vals if isinstance(vals, (list, tuple)) else [vals]))}
        for nom, vals in (d.listes_reference or {}).items()
    ]
    return {
        "obj": d,
        "anchor": f"det-{d.pk}",
        "gravite_couleur": GRAVITE_COULEUR.get(d.gravite, "#66749b"),
        "gravite_niveau": GRAVITE_NIVEAU.get(d.gravite, 0),
        "statut_couleur": STATUT_COULEUR.get(d.statut, "#66749b"),
        "techniques": techniques,
        "parametres": [{"nom": k, "valeur": v, "couleur": couleurs[k]} for k, v in (d.parametres or {}).items()],
        "listes": listes,
        "regles": regles,
        "regles_absentes": regles_absentes,
        "hunting": hunting,
        "preuves": list(d.preuves.all()),
    }


def _synthese(detections: list[DetectionClient]) -> dict:
    total = len(detections) or 1
    par_statut = []
    for s in StatutDetection:
        n = sum(1 for d in detections if d.statut == s.value)
        par_statut.append({"id": s.value, "label": s.label, "n": n, "pct": round(100 * n / total, 2), "couleur": STATUT_COULEUR[s.value]})
    par_gravite = []
    for g in sorted(GRAVITE_COULEUR, key=lambda g: GRAVITE_ORDRE[g]):
        n = sum(1 for d in detections if d.gravite == g)
        par_gravite.append({"label": g, "n": n, "pct": round(100 * n / total, 2), "couleur": GRAVITE_COULEUR[g], "niveau": GRAVITE_NIVEAU[g]})
    techniques = {t.identifiant for d in detections for t in d.techniques.all()}
    return {
        "par_statut": par_statut,
        "par_gravite": par_gravite,
        "journalisation_ok": sum(1 for d in detections if d.journalisation == "ok"),
        "nb_techniques": len(techniques),
    }


def detections_pdf(client, *, statuts: list[str] | None = None, ids: list[int] | None = None,
                   technique: bool = True, seule: DetectionClient | None = None) -> bytes:
    """PDF des détections du client (filtrées par statut et/ou par identifiants), ou d'une seule détection (``seule``)."""
    from weasyprint import HTML

    qs = _queryset(client)
    if seule is not None:
        qs = qs.filter(pk=seule.pk)
    else:
        if statuts:
            qs = qs.filter(statut__in=statuts)
        if ids is not None:
            qs = qs.filter(pk__in=ids)
    detections = list(qs)
    siems = list(client.siems.order_by("ordre", "nom"))
    tactiques = dict(TactiqueMitre.objects.values_list("shortname", "nom"))
    fiches = [_fiche(d, siems, tactiques, technique) for d in detections]

    groupes: OrderedDict[str, list] = OrderedDict()
    for f in fiches:
        groupes.setdefault(f["obj"].domaine.nom, []).append(f)
    total = len(fiches) or 1
    sommaire = [
        {
            "nom": nom,
            "fiches": fs,
            "n": len(fs),
            "pct": round(100 * len(fs) / total, 2),
            "segments": [
                {"couleur": STATUT_COULEUR[s.value], "pct": round(100 * n / len(fs), 2)}
                for s in StatutDetection
                if (n := sum(1 for f in fs if f["obj"].statut == s.value))
            ],
            "deployees": sum(1 for f in fs if f["obj"].statut == StatutDetection.DEPLOYEE),
        }
        for nom, fs in groupes.items()
    ]

    tous = statuts is None or set(statuts) == STATUTS_VALIDES
    filtre = None
    if seule is None:
        morceaux = []
        if not tous:
            morceaux.append("statuts : " + ", ".join(StatutDetection(s).label for s in statuts))
        if ids is not None:
            morceaux.append("sélection manuelle")
        filtre = " · ".join(morceaux) or None

    html = render_to_string("clients/detections_pdf.html", {
        "assets": ASSETS.as_uri(),
        "client": client,
        "siems": siems,
        "domaines": list(client.domaines.order_by("ordre", "nom")),
        "fiches": fiches,
        "sommaire": sommaire,
        "synthese": _synthese(detections),
        "seule": seule is not None,
        "technique": technique,
        "filtre": filtre,
        "genere_le": timezone.localtime(),
        "css": {"client": mark_safe(css_string(client.nom))},
        "statut_couleur": STATUT_COULEUR,
    })
    titre = f"{detections[0].code} · {client.nom}" if seule is not None and detections else f"Détections · {client.nom}"
    doc = HTML(string=html, base_url=ASSETS.as_uri() + "/", url_fetcher=_fetcher()).render()
    doc.metadata.title = titre
    doc.metadata.authors = ["Tunisian Financial Cert"]
    doc.metadata.lang = "fr"
    return doc.write_pdf()
