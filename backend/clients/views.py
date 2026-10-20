import os
from collections import Counter, defaultdict
from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.http import FileResponse, HttpResponse, JsonResponse
from django.utils import timezone
from rest_framework.decorators import api_view, parser_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import Habilitation, RoleClient, User
from accounts.permissions import can, get_client_or_404, permissions_on_client
from audit import context as audit_context
from audit.models import JournalAudit
from catalog.models import (
    Domaine,
    RequeteHunting,
    Siem,
    SourceLog,
    Syntaxe,
    TactiqueMitre,
    Template,
    render_parametres,
)
from catalog.serializers import ContenuWriteSerializer, HuntingSerializer, SyntaxeSerializer
from catalog.services.contenu import apply_content, technique_payload

from .models import (
    Client,
    ClientSource,
    DetectionClient,
    DetectionSource,
    Journalisation,
    PreuveTest,
    StatutDetection,
    StatutSource,
)
from .services import coverage as cov_service
from .services import detections as svc
from .services import exports

MAX_PREUVE = 5 * 1024 * 1024
PREUVE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".txt", ".log", ".json", ".csv"}
STATUTS = [s.value for s in StatutDetection]


# ---------------------------------------------------------------- helpers
def _siem_item(s: Siem) -> dict:
    return {"id": s.pk, "code": s.code, "nom": s.nom, "categorie": s.categorie, "mode_editeur": s.mode_editeur}


def client_payload(c: Client, user, stats: dict | None = None) -> dict:
    out = {
        "id": c.pk, "nom": c.nom, "secteur": c.secteur, "actif": c.actif,
        "siems": [_siem_item(s) for s in c.siems.all()],
        "domaines": [{"id": d.pk, "nom": d.nom} for d in c.domaines.all()],
        "permissions": permissions_on_client(user, c),
    }
    if stats is not None:
        out.update(stats)
    return out


def clients_stats(clients) -> dict[int, dict]:
    """Compteurs et « bande » (un statut par détection) pour une liste de clients, en une requête."""
    rows = DetectionClient.objects.filter(client__in=clients).order_by("code").values_list("client_id", "statut", "journalisation")
    stats = {c.pk: {"nb_detections": 0, "par_statut": {s: 0 for s in STATUTS}, "journalisation_ok": 0, "bande": []} for c in clients}
    for cid, statut, jour in rows:
        s = stats[cid]
        s["nb_detections"] += 1
        s["par_statut"][statut] += 1
        s["journalisation_ok"] += jour == Journalisation.OK
        s["bande"].append(statut)
    return stats


def get_detection(user, pk, permission="client.view") -> DetectionClient:
    d = (
        DetectionClient.objects.filter(client__in=Client.objects.visible_to(user), pk=pk)
        .select_related("client", "domaine", "template", "proprietaire", "modifie_par")
        .first()
    )
    if d is None:
        raise NotFound()
    if not can(user, d.client, permission):
        raise PermissionDenied("Droits insuffisants sur ce client.")
    return d


def _detection_qs(client):
    return (
        DetectionClient.objects.filter(client=client)
        .select_related("domaine", "proprietaire")
        .prefetch_related(
            "techniques",
            Prefetch("detection_sources", queryset=DetectionSource.objects.select_related("source")),
            Prefetch("syntaxes", queryset=Syntaxe.objects.select_related("siem")),
        )
    )


def detection_item(d: DetectionClient, collectees: set[int]) -> dict:
    """Résumé affiché sur les cartes, le tableau Kanban et les filtres."""
    tech = list(d.techniques.all())
    sources = list(d.detection_sources.all())
    return {
        "id": d.pk, "code": d.code, "domaine": d.domaine.nom, "domaine_id": d.domaine_id, "cas_usage": d.cas_usage,
        "type_detection": d.type_detection, "gravite": d.gravite, "statut": d.statut, "journalisation": d.journalisation,
        "techniques": [t.identifiant for t in tech],
        "tactiques": sorted({tac for t in tech for tac in t.tactiques}),
        "siems_regle": sorted({s.siem.code for s in d.syntaxes.all()}),
        "sources": [{"source_id": r.source_id, "nom": r.source.nom, "collectee": r.source_id in collectees} for r in sources],
        "proprietaire": d.proprietaire.nom_affiche if d.proprietaire else None,
        "a_exclusions": bool(d.exclusions.strip()), "a_recommandation": bool(d.recommandation.strip()), "a_impact": bool(d.impact.strip()),
        "libre": d.template_id is None, "modifie_le": d.modifie_le, "date_deploiement": d.date_deploiement,
    }


def detection_payload(d: DetectionClient, user) -> dict:
    valeurs = d.valeurs_parametres()
    siems = list(d.client.siems.all())
    syntaxes, hunting = [], []
    for siem in siems:
        s = next((x for x in d.syntaxes.all() if x.siem_id == siem.pk), None)
        base = {"siem": siem.code, "siem_nom": siem.nom, "mode_editeur": siem.mode_editeur, "langage": siem.langage_regle}
        if s:
            rendu, manquants = render_parametres(s.contenu, valeurs)
            syntaxes.append({**base, "id": s.pk, "contenu": s.contenu, "rendu": rendu, "parametres_non_resolus": manquants,
                             "champs_requis": s.champs_requis, "notes": s.notes, "presente": True})
        else:
            syntaxes.append({**base, "id": None, "contenu": "", "rendu": "", "parametres_non_resolus": [], "champs_requis": [], "notes": "", "presente": False})
        for h in (x for x in d.requetehuntings.all() if x.siem_id == siem.pk):
            rendu, _ = render_parametres(h.requete, valeurs)
            hunting.append({"id": h.pk, "siem": siem.code, "siem_nom": siem.nom, "titre": h.titre, "objectif": h.objectif,
                            "requete": h.requete, "rendu": rendu, "periode_conseillee": h.periode_conseillee})
    etats = dict(ClientSource.objects.filter(client=d.client).values_list("source_id", "statut"))
    sources = [
        {"source_id": r.source_id, "nom": r.source.nom, "obligatoire": r.obligatoire, "statut": etats.get(r.source_id, StatutSource.A_ACTIVER.value),
         "collectee": etats.get(r.source_id) == StatutSource.COLLECTEE, "a_activer": r.source.a_activer,
         "evenements_cles": r.source.evenements_cles, "piege": r.source.piege}
        for r in d.detection_sources.select_related("source")
    ]
    return {
        "id": d.pk, "client_id": d.client_id, "client_nom": d.client.nom, "code": d.code, "libre": d.template_id is None,
        "template_code": d.template.code if d.template else None,
        "domaine": d.domaine.nom, "domaine_id": d.domaine_id, "cas_usage": d.cas_usage, "type_detection": d.type_detection,
        "gravite": d.gravite, "statut": d.statut, "journalisation": d.journalisation,
        "logs_a_collecter": d.logs_a_collecter, "logique": d.logique, "exclusions": d.exclusions,
        "recommandation": d.recommandation, "impact": d.impact, "notes": d.notes,
        "parametres": d.parametres, "parametres_effectifs": valeurs, "listes_reference": d.listes_reference,
        "parametres_template": d.template.parametres_defaut if d.template else {},
        "sources": sources, "techniques": [technique_payload(t) for t in d.techniques.all()],
        "proprietaire": d.proprietaire.nom_affiche if d.proprietaire else None, "proprietaire_id": d.proprietaire_id,
        "date_deploiement": d.date_deploiement, "reference_siem": d.reference_siem,
        "modifie_par": d.modifie_par.nom_affiche if d.modifie_par else None, "modifie_le": d.modifie_le,
        "syntaxes": syntaxes, "hunting": hunting,
        "preuves": [
            {"id": p.pk, "date": p.date, "resultat": p.resultat, "description": p.description,
             "capture": bool(p.capture), "auteur": p.auteur.nom_affiche if p.auteur else None}
            for p in d.preuves.select_related("auteur")
        ],
        "permissions": permissions_on_client(user, d.client),
    }


def _reload(user, pk):
    d = get_detection(user, pk)
    return detection_payload(d, user)


# ---------------------------------------------------------------- clients
@api_view(["GET", "POST"])
def clients(request):
    if request.method == "POST":
        return _create_client(request)
    cs = list(Client.objects.visible_to(request.user).prefetch_related("siems", "domaines"))
    stats = clients_stats(cs)
    return Response([client_payload(c, request.user, stats[c.pk]) for c in cs])


@transaction.atomic
def _create_client(request):
    if not request.user.is_platform_admin:
        raise PermissionDenied("Seul l'Administrateur plateforme peut créer un client.")
    d = request.data
    nom = str(d.get("nom", "")).strip()
    if not nom:
        return Response({"detail": "Donnez un nom au client."}, status=400)
    if Client.objects.filter(nom__iexact=nom).exists():
        return Response({"detail": "Un client porte déjà ce nom."}, status=409)
    siems = list(Siem.objects.filter(code__in=d.get("siems", [])))
    if not siems:
        return Response({"detail": "Choisissez au moins une plateforme SIEM / XDR."}, status=400)
    domaines = list(Domaine.objects.all() if d.get("domaines") is None else Domaine.objects.filter(pk__in=d["domaines"]))
    if not domaines:
        return Response({"detail": "Choisissez au moins un domaine."}, status=400)
    admin = None
    if d.get("admin_username"):
        admin = User.objects.filter(username__iexact=str(d["admin_username"]).strip(), is_active=True).first()
        if admin is None:
            return Response({"detail": "Admin client introuvable."}, status=400)
    c = Client.objects.create(nom=nom, secteur=str(d.get("secteur", "")).strip())
    c.siems.set(siems)
    c.domaines.set(domaines)
    svc.initialiser_sources(c)
    if admin:
        Habilitation.objects.create(utilisateur=admin, client=c, role=RoleClient.ADMIN_CLIENT)
    n = svc.synchroniser(c, request.user)
    stats = clients_stats([c])[c.pk]
    return Response({**client_payload(c, request.user, stats), "detections_creees": n}, status=201)


@api_view(["GET", "PATCH", "DELETE"])
def client_detail(request, client_id):
    perm = "client.view" if request.method == "GET" else "client.edit"
    c = get_client_or_404(request.user, client_id, perm)
    extra = {}
    if request.method == "DELETE":
        if not request.user.is_platform_admin:
            raise PermissionDenied("Seul l'Administrateur plateforme peut supprimer un client.")
        if str(request.data.get("confirmation", "")).strip() != c.nom:
            return Response({"detail": "Saisissez le nom exact du client pour confirmer la suppression."}, status=400)
        with transaction.atomic():
            token = audit_context.mute()  # une seule trace pour toute la cascade, rattachée au nom du client
            try:
                nb = c.detections.count()
                pk, nom = c.pk, c.nom
                c.delete()
            finally:
                audit_context.unmute(token)
            JournalAudit.objects.create(
                utilisateur=request.user, utilisateur_nom=request.user.nom_affiche, client=None, client_nom=nom,
                objet_type="clients.Client", objet_id=str(pk), objet_repr=nom, action="suppression", avant={"nom": nom, "nb_detections": nb},
            )
        return Response(status=204)
    if request.method == "PATCH":
        d = request.data
        with transaction.atomic():
            if "nom" in d:
                nom = str(d["nom"]).strip()
                if not nom or Client.objects.filter(nom__iexact=nom).exclude(pk=c.pk).exists():
                    raise ValidationError("Nom vide ou déjà utilisé.")
                c.nom = nom
            if "secteur" in d:
                c.secteur = str(d["secteur"]).strip()
            if "actif" in d and request.user.is_platform_admin:
                c.actif = bool(d["actif"])
            c.save()
            if "siems" in d:
                siems = list(Siem.objects.filter(code__in=d["siems"]))
                if not siems:
                    raise ValidationError("Gardez au moins une plateforme SIEM / XDR.")
                c.siems.set(siems)
                extra["regles_ajoutees"] = svc.completer_regles(c)
            if "domaines" in d:
                avant = set(c.domaines.values_list("pk", flat=True))
                nouveaux = Domaine.objects.filter(pk__in=d["domaines"])
                if not nouveaux:
                    raise ValidationError("Gardez au moins un domaine.")
                c.domaines.set(nouveaux)
                ajoutes = [dom for dom in nouveaux if dom.pk not in avant]
                extra["detections_creees"] = svc.synchroniser(c, request.user, domaines=ajoutes) if ajoutes else 0
        c = Client.objects.get(pk=c.pk)
    return Response({**client_payload(c, request.user, clients_stats([c])[c.pk]), **extra})


@api_view(["GET", "PUT"])
def client_sources(request, client_id):
    c = get_client_or_404(request.user, client_id, "client.view" if request.method == "GET" else "detection.edit")
    if request.method == "PUT":
        valid = set(StatutSource.values)
        with transaction.atomic():
            for row in request.data if isinstance(request.data, list) else request.data.get("sources", []):
                if row.get("statut") not in valid:
                    raise ValidationError(f"Statut invalide : {row.get('statut')}")
                cs, _ = ClientSource.objects.get_or_create(client=c, source_id=row.get("source_id"))
                cs.statut = row["statut"]
                cs.commentaire = str(row.get("commentaire", ""))[:1000]
                cs.save()
            svc.recalculer_journalisation(c)
    svc.initialiser_sources(c)
    needs = Counter(
        DetectionSource.objects.filter(detection__client=c).values_list("source_id", flat=True)
    )
    out = []
    for cs in ClientSource.objects.filter(client=c).select_related("source"):
        s = cs.source
        out.append({"source_id": s.pk, "nom": s.nom, "statut": cs.statut, "commentaire": cs.commentaire, "nb_detections": needs.get(s.pk, 0),
                    "a_activer": s.a_activer, "evenements_cles": s.evenements_cles, "piege": s.piege})
    return Response(out)


@api_view(["POST"])
def client_source_ajouter(request, client_id, source_id):
    """« Ajouter » une source de logs : elle devient collectée, et la journalisation des détections concernées passe à OK."""
    c = get_client_or_404(request.user, client_id, "detection.edit")
    source = SourceLog.objects.filter(pk=source_id).first()
    if source is None:
        raise NotFound()
    with transaction.atomic():
        cs, _ = ClientSource.objects.get_or_create(client=c, source=source)
        retire = bool(request.data.get("retirer"))
        cs.statut = StatutSource.A_ACTIVER if retire else StatutSource.COLLECTEE
        cs.save()
        n = svc.recalculer_journalisation(c)
    return Response({"source_id": source.pk, "statut": cs.statut, "detections_passees_ok": n})


@api_view(["GET", "POST"])
def client_detections(request, client_id):
    if request.method == "POST":
        return _add_detections(request, client_id)
    c = get_client_or_404(request.user, client_id, "client.view")
    p = request.query_params
    qs = _detection_qs(c)
    if p.get("statut"):
        qs = qs.filter(statut__in=p["statut"].split(","))
    if p.get("domaine"):
        qs = qs.filter(domaine_id=p["domaine"])
    if p.get("gravite"):
        qs = qs.filter(gravite=p["gravite"])
    if p.get("journalisation"):
        qs = qs.filter(journalisation=p["journalisation"])
    if p.get("q"):
        qs = qs.filter(Q(code__icontains=p["q"]) | Q(cas_usage__icontains=p["q"]))
    collectees = svc.sources_collectees(c)
    return Response([detection_item(d, collectees) for d in qs])


@transaction.atomic
def _add_detections(request, client_id):
    c = get_client_or_404(request.user, client_id, "detection.edit")
    data = request.data
    created = []
    if data.get("codes"):
        for code in data["codes"]:
            t = Template.objects.filter(code=code).first()
            if t is None:
                return Response({"detail": f"Template inconnu : {code}."}, status=400)
            created.append(svc.instancier(c, t, request.user).pk)
    elif isinstance(data.get("libre"), dict):
        payload = ContenuWriteSerializer(data=data["libre"])
        payload.is_valid(raise_exception=True)
        v = payload.validated_data
        domaine = Domaine.objects.filter(pk=v.get("domaine_id")).first()
        if domaine is None or not v.get("cas_usage"):
            return Response({"detail": "Un domaine et un cas d'usage sont obligatoires."}, status=400)
        d = svc.creer_libre(c, request.user, domaine, v["cas_usage"])
        apply_content(d, v, params_field="parametres")
        created.append(d.pk)
    else:
        return Response({"detail": "Choisissez des templates ou décrivez une détection."}, status=400)
    return Response({"crees": len(created), "ids": created}, status=201)


@api_view(["POST"])
def client_detections_bulk(request, client_id):
    c = get_client_or_404(request.user, client_id, "detection.edit")
    ids, action, valeur = request.data.get("ids", []), request.data.get("action"), request.data.get("valeur")
    qs = DetectionClient.objects.filter(client=c, pk__in=ids)
    if not ids or not qs.exists():
        return Response({"detail": "Aucune détection sélectionnée."}, status=400)
    n = qs.count()
    with transaction.atomic():
        if action == "supprimer":
            for d in qs:
                d.delete()
        elif action == "statut":
            if valeur not in STATUTS:
                return Response({"detail": "Statut inconnu."}, status=400)
            for d in qs:
                svc.appliquer_statut(d, valeur)
                svc.marquer_modifiee(d, request.user)
        elif action == "journalisation":
            if valeur not in Journalisation.values:
                return Response({"detail": "Valeur inconnue (ok ou non)."}, status=400)
            for d in qs:
                d.journalisation = valeur
                svc.marquer_modifiee(d, request.user)
        else:
            return Response({"detail": "Action inconnue."}, status=400)
    return Response({"modifiees": n})


@api_view(["GET"])
def client_bibliotheque(request, client_id):
    """Templates de la bibliothèque que le client n'a pas encore."""
    c = get_client_or_404(request.user, client_id, "client.view")
    deja = set(DetectionClient.objects.filter(client=c).values_list("code", flat=True))
    domaines = set(c.domaines.values_list("pk", flat=True))
    out = []
    for t in Template.objects.exclude(code__in=deja).select_related("domaine"):
        out.append({"code": t.code, "domaine": t.domaine.nom, "domaine_id": t.domaine_id, "cas_usage": t.cas_usage,
                    "gravite": t.gravite, "type_detection": t.type_detection, "dans_domaines": t.domaine_id in domaines})
    return Response(out)


@api_view(["GET"])
def client_dashboard(request, client_id):
    c = get_client_or_404(request.user, client_id, "client.view")
    detections = list(_detection_qs(c))
    collectees = svc.sources_collectees(c)
    stats = clients_stats([c])[c.pk]

    domaines = defaultdict(lambda: {"total": 0, "deployees": 0, "journalisation_ok": 0})
    manque = Counter()
    for d in detections:
        row = domaines[(d.domaine_id, d.domaine.nom)]
        row["total"] += 1
        row["deployees"] += d.statut == StatutDetection.DEPLOYEE
        row["journalisation_ok"] += d.journalisation == Journalisation.OK
        if d.journalisation == Journalisation.NON:
            for r in d.detection_sources.all():
                if r.source_id not in collectees:
                    manque[r.source_id] += 1
    sources = {s.pk: s for s in SourceLog.objects.filter(pk__in=manque)}
    a_ajouter = [
        {"source_id": sid, "nom": sources[sid].nom, "nb_detections": n, "a_activer": sources[sid].a_activer}
        for sid, n in manque.most_common(6)
    ]

    cov = cov_service.client_matrix(c, [StatutDetection.DEPLOYEE.value])
    tactiques = []
    for tac in cov["tactiques"]:
        total = len(tac["techniques"])
        if total:
            tactiques.append({"shortname": tac["shortname"], "nom": tac["nom"], "total": total, "couvertes": sum(1 for t in tac["techniques"] if t["count"])})
    activite = [
        {"date": e.date, "utilisateur": e.utilisateur_nom, "objet": e.objet_repr, "action": e.action, "objet_type": e.objet_type}
        for e in JournalAudit.objects.filter(client=c).exclude(objet_type__in=["clients.ClientSource"])[:8]
    ] if can(request.user, c, "audit.view") else []
    return Response({
        "client": client_payload(c, request.user, stats),
        "domaines": [{"id": k[0], "nom": k[1], **v} for k, v in sorted(domaines.items(), key=lambda kv: kv[0][1])],
        "sources_a_ajouter": a_ajouter,
        "a_revoir": [detection_item(d, collectees) for d in detections if d.statut == StatutDetection.A_REVOIR][:8],
        "tactiques": tactiques,
        "nb_techniques_deployees": sum(t["couvertes"] for t in tactiques),
        "activite": activite,
        "bande_detail": [{"id": d.pk, "code": d.code, "statut": d.statut} for d in detections],
    })


@api_view(["GET"])
def client_couverture(request, client_id):
    c = get_client_or_404(request.user, client_id, "client.view")
    statuts = cov_service.parse_statuts(request.query_params.get("statuts"))
    data = cov_service.client_matrix(c, statuts, request.query_params.get("seulement_couvertes") == "1")
    data["statuts"] = statuts
    data["non_couvertes"] = cov_service.non_couvertes(c, statuts) if request.query_params.get("non_couvertes") != "0" else []
    return Response(data)


@api_view(["GET"])
def client_export(request, client_id, fmt):
    c = get_client_or_404(request.user, client_id, "export")
    slug = "".join(ch if ch.isalnum() else "_" for ch in c.nom).strip("_") or "client"
    if fmt == "xlsx":
        resp = HttpResponse(exports.client_workbook(c), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="uc_factory_{slug}.xlsx"'
    elif fmt == "csv":
        resp = HttpResponse(exports.client_csv(c), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="uc_factory_{slug}.csv"'
    elif fmt == "navigator.json":
        resp = JsonResponse(exports.navigator_layer(c, request.query_params.get("statuts")), json_dumps_params={"ensure_ascii": False, "indent": 1})
        resp["Content-Disposition"] = f'attachment; filename="navigator_{slug}.json"'
    else:
        raise NotFound()
    resp["X-Content-Type-Options"] = "nosniff"
    return resp


# ---------------------------------------------------------------- détections
@api_view(["GET", "PATCH", "DELETE"])
def detection_detail(request, pk):
    d = get_detection(request.user, pk, "client.view" if request.method == "GET" else "detection.edit")
    if request.method == "DELETE":
        d.delete()
        return Response(status=204)
    if request.method == "PATCH":
        data = request.data
        payload = ContenuWriteSerializer(data=data, partial=True)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            apply_content(d, payload.validated_data, params_field="parametres")
            if "notes" in data:
                d.notes = str(data["notes"])
            if "reference_siem" in data:
                d.reference_siem = str(data["reference_siem"])[:200]
            if "listes_reference" in data:
                lr = data["listes_reference"]
                if not isinstance(lr, dict) or any(not isinstance(v, list) for v in lr.values()):
                    raise ValidationError("listes_reference : {nom: [valeurs]} attendu.")
                d.listes_reference = lr
            if "statut" in data:
                svc.appliquer_statut(d, data["statut"])
            if "journalisation" in data:
                if data["journalisation"] not in Journalisation.values:
                    raise ValidationError("Journalisation : ok ou non.")
                d.journalisation = data["journalisation"]
            if "date_deploiement" in data:
                try:
                    d.date_deploiement = date.fromisoformat(str(data["date_deploiement"])) if data["date_deploiement"] else None
                except ValueError:
                    raise ValidationError("Date de déploiement invalide (AAAA-MM-JJ).")
            if "proprietaire_id" in data:
                owner = None
                if data["proprietaire_id"]:
                    owner = User.objects.filter(pk=data["proprietaire_id"], habilitations__client=d.client).first() or (
                        User.objects.filter(pk=data["proprietaire_id"]).first() if request.user.is_platform_admin else None)
                    if owner is None:
                        raise ValidationError("Propriétaire non habilité sur ce client.")
                d.proprietaire = owner
            svc.marquer_modifiee(d, request.user)
        d = get_detection(request.user, pk)
    return Response(detection_payload(d, request.user))


@api_view(["POST"])
def detection_reinitialiser(request, pk):
    d = get_detection(request.user, pk, "detection.edit")
    svc.reinitialiser(d, request.user, regles=bool(request.data.get("regles", True)))
    return Response(_reload(request.user, pk))


@api_view(["PUT", "DELETE"])
def detection_syntaxe(request, pk, siem_code):
    d = get_detection(request.user, pk, "detection.edit")
    siem = d.client.siems.filter(code=siem_code).first()
    if siem is None:
        return Response({"detail": "Plateforme non utilisée par ce client."}, status=400)
    obj = d.syntaxes.filter(siem=siem).first()
    with transaction.atomic():
        if request.method == "DELETE":
            if obj:
                obj.delete()
        else:
            s = SyntaxeSerializer(data={**request.data, "siem": siem.code})
            s.is_valid(raise_exception=True)
            vd = s.validated_data
            if obj:
                obj.contenu, obj.champs_requis, obj.notes = vd["contenu"], vd.get("champs_requis", obj.champs_requis), vd.get("notes", obj.notes)
                obj.save()
            else:
                Syntaxe.objects.create(detection_client=d, **vd)
        svc.marquer_modifiee(d, request.user)
    return Response(_reload(request.user, pk))


@api_view(["POST"])
def detection_hunting_create(request, pk):
    d = get_detection(request.user, pk, "detection.edit")
    s = HuntingSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    if not d.client.siems.filter(pk=s.validated_data["siem"].pk).exists():
        return Response({"detail": "Plateforme non utilisée par ce client."}, status=400)
    with transaction.atomic():
        RequeteHunting.objects.create(detection_client=d, **s.validated_data)
        svc.marquer_modifiee(d, request.user)
    return Response(_reload(request.user, pk), status=201)


@api_view(["PATCH", "DELETE"])
def detection_hunting_detail(request, pk, hid):
    d = get_detection(request.user, pk, "detection.edit")
    h = d.requetehuntings.filter(pk=hid).first()
    if h is None:
        raise NotFound()
    with transaction.atomic():
        if request.method == "DELETE":
            h.delete()
        else:
            s = HuntingSerializer(h, data=request.data, partial=True)
            s.is_valid(raise_exception=True)
            if "siem" in s.validated_data and not d.client.siems.filter(pk=s.validated_data["siem"].pk).exists():
                raise ValidationError("Plateforme non utilisée par ce client.")
            s.save()
        svc.marquer_modifiee(d, request.user)
    return Response(_reload(request.user, pk))


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def detection_preuve(request, pk):
    d = get_detection(request.user, pk, "detection.edit")
    resultat = request.data.get("resultat")
    if resultat not in PreuveTest.Resultat.values:
        return Response({"detail": "Résultat invalide (reussi ou echoue)."}, status=400)
    when = timezone.now()
    if request.data.get("date"):
        try:
            when = datetime.fromisoformat(str(request.data["date"]))
            if timezone.is_naive(when):
                when = timezone.make_aware(when)
        except ValueError:
            return Response({"detail": "Date invalide."}, status=400)
        if when > timezone.now():
            return Response({"detail": "La date du test ne peut pas être dans le futur."}, status=400)
    f = request.FILES.get("capture")
    if f is not None:
        ext = os.path.splitext(f.name)[1].lower()
        if ext not in PREUVE_EXT:
            return Response({"detail": f"Type de fichier non autorisé ({ext})."}, status=400)
        if f.size > MAX_PREUVE:
            return Response({"detail": "Capture trop volumineuse (5 Mo maximum)."}, status=413)
    PreuveTest.objects.create(detection=d, date=when, resultat=resultat, description=str(request.data.get("description", ""))[:5000], capture=f or "", auteur=request.user)
    return Response(_reload(request.user, pk), status=201)


@api_view(["DELETE"])
def preuve_detail(request, pk):
    p = PreuveTest.objects.select_related("detection__client").filter(pk=pk, detection__client__in=Client.objects.visible_to(request.user)).first()
    if p is None:
        raise NotFound()
    if not can(request.user, p.detection.client, "detection.edit"):
        raise PermissionDenied()
    p.delete()
    return Response(status=204)


@api_view(["GET"])
def preuve_capture(request, pk):
    p = PreuveTest.objects.select_related("detection__client").filter(pk=pk, detection__client__in=Client.objects.visible_to(request.user)).first()
    if p is None or not p.capture:
        raise NotFound()
    if not can(request.user, p.detection.client, "client.view"):
        raise PermissionDenied()
    resp = FileResponse(p.capture.open("rb"), as_attachment=True, filename=os.path.basename(p.capture.name))
    resp["X-Content-Type-Options"] = "nosniff"
    resp["Content-Security-Policy"] = "default-src 'none'; sandbox"
    return resp
