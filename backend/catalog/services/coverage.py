"""Couverture MITRE ATT&CK : matrice tactiques × techniques."""
from collections import defaultdict

from ..models import TactiqueMitre, TechniqueMitre


def build_matrix(coverage: dict[str, dict], *, seulement_couvertes: bool = False) -> dict:
    """``coverage`` : identifiant de technique -> {"count": n, "detections": [codes], "statut": str|None}.

    Une technique parente agrège ses sous-techniques. Retourne la matrice ordonnée par tactique.
    """
    techniques = {t.identifiant: t for t in TechniqueMitre.objects.filter(revoquee=False, obsolete=False)}
    # Techniques utilisées mais révoquées / inconnues : on les affiche quand même si couvertes
    for tid in coverage:
        if tid not in techniques:
            t = TechniqueMitre.objects.filter(identifiant=tid).first()
            if t:
                techniques[tid] = t
    parents: dict[str, dict] = {}
    for tid, t in techniques.items():
        base = tid.split(".")[0]
        if base not in parents:
            p = techniques.get(base)
            parents[base] = {"id": base, "nom": p.nom if p else base, "tactiques": list(p.tactiques) if p else [], "sous": [], "p": p}
        if "." in tid:
            parents[base]["sous"].append(t)
    for base, data in parents.items():
        if not data["tactiques"]:  # parente absente ou sans tactique : union des tactiques des sous-techniques
            data["tactiques"] = sorted({x for s in data["sous"] for x in s.tactiques})

    def cell(base, data):
        own = coverage.get(base, {"count": 0, "detections": [], "statut": None})
        subs = []
        total = set(own["detections"])
        statut_max = own["statut"]
        for s in sorted(data["sous"], key=lambda x: x.identifiant):
            c = coverage.get(s.identifiant, {"count": 0, "detections": [], "statut": None})
            subs.append({"id": s.identifiant, "nom": s.nom, "count": c["count"], "detections": c["detections"], "statut": c["statut"]})
            total |= set(c["detections"])
            statut_max = _max_statut(statut_max, c["statut"])
        return {
            "id": base, "nom": data["nom"], "count": len(total), "detections": sorted(total),
            "statut": _max_statut(own["statut"], statut_max), "sous_techniques": subs,
            "verifiee": data["p"].verifiee if data["p"] else False,
        }

    par_tactique = defaultdict(list)
    for base, data in parents.items():
        c = cell(base, data)
        if seulement_couvertes and c["count"] == 0:
            continue
        for tac in data["tactiques"] or ["non-classee"]:
            par_tactique[tac].append(c)
    tactiques = []
    for tac in TactiqueMitre.objects.all():
        tactiques.append({"shortname": tac.shortname, "nom": tac.nom, "techniques": sorted(par_tactique.pop(tac.shortname, []), key=lambda c: c["id"])})
    if par_tactique:
        autres = [c for lst in par_tactique.values() for c in lst]
        tactiques.append({"shortname": "non-classee", "nom": "Non classées (référentiel ATT&CK non chargé)", "techniques": sorted(autres, key=lambda c: c["id"])})
    return {
        "tactiques": tactiques,
        "referentiel_charge": TechniqueMitre.objects.filter(verifiee=True).exists(),
        "nb_techniques_couvertes": sum(1 for t in coverage.values() if t["count"]),
    }


_ORDRE = {None: 0, "brouillon": 1, "en_test": 2, "a_revoir": 3, "validee": 4, "deployee": 5}


def _max_statut(a, b):
    return a if _ORDRE.get(a, 0) >= _ORDRE.get(b, 0) else b
