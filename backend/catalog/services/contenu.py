"""Contenu commun à un template et à une détection client : mêmes champs, mêmes règles d'écriture."""
import re

from django.core.exceptions import ValidationError

from ..models import Domaine, SourceLog, TechniqueMitre

TEXT_FIELDS = ("cas_usage", "type_detection", "gravite", "logs_a_collecter", "logique", "exclusions", "recommandation", "impact")
PARAM_NAME = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]*")


def apply_content(obj, data: dict, *, params_field: str) -> list[str]:
    """Applique les champs présents dans ``data`` à ``obj`` (template ou détection client).

    Retourne la liste des champs de contenu modifiés. ``obj`` doit déjà exister en base (M2M).
    """
    changed = []
    for f in TEXT_FIELDS:
        if f in data:
            value = data[f]
            if f == "cas_usage":
                value = str(value or "").strip()
                if not value:
                    raise ValidationError("Le cas d'usage est obligatoire.")
            setattr(obj, f, value)
            changed.append(f)
    if "domaine_id" in data:
        domaine = Domaine.objects.filter(pk=data["domaine_id"]).first()
        if domaine is None:
            raise ValidationError("Domaine inconnu.")
        obj.domaine = domaine
        changed.append("domaine")
    if params_field in data or "parametres" in data:
        raw = data.get(params_field, data.get("parametres"))
        if not isinstance(raw, dict):
            raise ValidationError("Les paramètres doivent être un objet {nom: valeur}.")
        for k in raw:
            if not PARAM_NAME.fullmatch(str(k)):
                raise ValidationError(f"Nom de paramètre invalide : {k}")
        setattr(obj, params_field, raw)
        changed.append(params_field)
    obj.save()
    if "sources" in data:
        set_sources(obj, data["sources"])
        changed.append("sources")
    if "techniques" in data:
        set_techniques(obj, data["techniques"])
        changed.append("techniques")
    return changed


def set_sources(obj, rows):
    """``rows`` : [{"source_id": 3, "obligatoire": false}, …] ; remplace l'ensemble des sources."""
    through = obj.template_sources if hasattr(obj, "template_sources") else obj.detection_sources
    fk = "template" if hasattr(obj, "template_sources") else "detection"
    wanted = {}
    for r in rows or []:
        src = SourceLog.objects.filter(pk=r.get("source_id")).first()
        if src is None:
            raise ValidationError(f"Source inconnue : {r.get('source_id')}")
        wanted[src.pk] = (src, bool(r.get("obligatoire")))
    for row in list(through.all()):
        if row.source_id not in wanted:
            row.delete()
    for pk, (src, oblig) in wanted.items():
        row = through.filter(source_id=pk).first()
        if row is None:
            through.model.objects.create(**{fk: obj}, source=src, obligatoire=oblig)
        elif row.obligatoire != oblig:
            row.obligatoire = oblig
            row.save()


def set_techniques(obj, identifiants):
    ids = [str(i).strip().upper() for i in identifiants or [] if str(i).strip()]
    found = list(TechniqueMitre.objects.filter(identifiant__in=ids))
    inconnues = sorted(set(ids) - {t.identifiant for t in found})
    if inconnues:
        raise ValidationError(f"Techniques absentes du référentiel ATT&CK : {', '.join(inconnues)}")
    obj.techniques.set(found)


def technique_payload(t: TechniqueMitre) -> dict:
    return {"id": t.pk, "identifiant": t.identifiant, "nom": t.nom, "tactiques": t.tactiques, "verifiee": t.verifiee,
            "revoquee": t.revoquee, "obsolete": t.obsolete}
