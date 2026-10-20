"""Import du référentiel MITRE ATT&CK Enterprise (bundle STIX officiel)."""
import json

from django.conf import settings
from django.db import transaction

from ..models import TactiqueMitre, TechniqueMitre, Template


def _attack_id(obj):
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack" and ref.get("external_id"):
            return ref["external_id"]
    return None


@transaction.atomic
def import_bundle(data: dict | bytes | str) -> dict:
    """Charge tactiques et techniques. Retourne un rapport (créées, mises à jour, renommées, révoquées…)."""
    if isinstance(data, (bytes, str)):
        data = json.loads(data)
    objects = data.get("objects") if isinstance(data, dict) else None
    if not objects:
        raise ValueError("Bundle STIX invalide : aucun objet.")
    version = next((o.get("x_mitre_version") for o in objects if o.get("type") == "x-mitre-collection"), None) or settings.ATTACK_VERSION

    # Tactiques, dans l'ordre de la matrice
    tactics = {o["id"]: o for o in objects if o.get("type") == "x-mitre-tactic"}
    matrix = next((o for o in objects if o.get("type") == "x-mitre-matrix"), None)
    order = matrix.get("tactic_refs", []) if matrix else list(tactics)
    for i, ref in enumerate(order):
        t = tactics.get(ref)
        if t:
            TactiqueMitre.objects.update_or_create(
                shortname=t["x_mitre_shortname"], defaults={"nom": t["name"], "ordre": i}
            )

    by_stix: dict[str, str] = {}
    parsed = {}
    for o in objects:
        if o.get("type") != "attack-pattern":
            continue
        tid = _attack_id(o)
        if not tid:
            continue
        by_stix[o["id"]] = tid
        parsed[tid] = {
            "nom": o["name"],
            "tactiques": [p["phase_name"] for p in o.get("kill_chain_phases", []) if p.get("kill_chain_name") == "mitre-attack"],
            "obsolete": bool(o.get("x_mitre_deprecated")),
            "revoquee": bool(o.get("revoked")),
        }

    replaced_by = {}
    for o in objects:
        if o.get("type") == "relationship" and o.get("relationship_type") == "revoked-by":
            src, dst = by_stix.get(o.get("source_ref")), by_stix.get(o.get("target_ref"))
            if src and dst:
                replaced_by[src] = dst

    for tid, p in parsed.items():
        p["remplacee_par"] = replaced_by.get(tid, "")

    existing = {t.identifiant: t for t in TechniqueMitre.objects.all()}
    created = updated = 0
    renamed = []
    for tid, p in parsed.items():
        obj = existing.get(tid)
        if obj is None:
            existing[tid] = TechniqueMitre.objects.create(identifiant=tid, version_attack=version, verifiee=True, **p)
            created += 1
            continue
        if obj.nom != p["nom"] and obj.verifiee:
            renamed.append({"identifiant": tid, "ancien_nom": obj.nom, "nouveau_nom": p["nom"]})
        elif obj.nom != p["nom"]:
            # Nom provisoire issu du fichier Excel : simple correction vers le nom officiel
            pass
        changed = any(getattr(obj, k) != v for k, v in p.items()) or not obj.verifiee or obj.version_attack != version
        if changed:
            for k, v in p.items():
                setattr(obj, k, v)
            obj.verifiee = True
            obj.version_attack = version
            obj.save()
            updated += 1
    for tid, obj in existing.items():
        if "." in tid and tid in parsed and not obj.parente_id:
            parent = existing.get(tid.split(".")[0])
            if parent:
                obj.parente = parent
                obj.save(update_fields=["parente"])

    # Techniques stockées mais absentes du bundle (identifiants du catalogue inconnus de cette version)
    inconnues = sorted(t for t, o in existing.items() if t not in parsed)
    for tid in inconnues:
        o = existing[tid]
        if o.verifiee:
            o.verifiee = False
            o.save(update_fields=["verifiee"])

    return {
        "version_attack": version,
        "tactiques": TactiqueMitre.objects.count(),
        "techniques_creees": created,
        "techniques_mises_a_jour": updated,
        "techniques_inconnues_du_referentiel": inconnues,
        "renommees": renamed,
        "impacts": impacts_templates(),
    }


def impacts_templates() -> list[dict]:
    """Techniques révoquées, obsolètes ou inconnues encore mappées sur un template."""
    rows = []
    for tpl in Template.objects.prefetch_related("techniques"):
        for t in tpl.techniques.all():
            if t.revoquee or t.obsolete or not t.verifiee:
                rows.append(
                    {
                        "template": tpl.code,
                        "technique": t.identifiant,
                        "nom": t.nom,
                        "probleme": "revoquee" if t.revoquee else "obsolete" if t.obsolete else "inconnue",
                        "remplacee_par": t.remplacee_par,
                    }
                )
    return sorted(rows, key=lambda r: (r["template"], r["technique"]))
