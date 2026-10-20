import json
import re
from collections import Counter

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, F, Prefetch, Q
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from accounts.permissions import CatalogueReadOrManage, IsCatalogueManager
from clients.models import DetectionClient

from . import serializers as ser
from .models import (
    AideEntree,
    Domaine,
    GRAVITE_ORDRE,
    GuideTraduction,
    RequeteHunting,
    Siem,
    SourceLog,
    Syntaxe,
    TechniqueMitre,
    Template,
    TemplateSource,
    TactiqueMitre,
)
from .services import attack as attack_service
from .services import coverage as coverage_service
from .services import importer
from .services.contenu import apply_content

MAX_UPLOAD = 15 * 1024 * 1024


# ---------------------------------------------------------------- référentiels
class DomaineViewSet(viewsets.ModelViewSet):
    permission_classes = [CatalogueReadOrManage]
    serializer_class = ser.DomaineSerializer

    def get_queryset(self):
        return Domaine.objects.annotate(nb_templates=Count("templates", distinct=True)).order_by("ordre", "nom")

    def perform_destroy(self, instance):
        n = instance.templates.count() + instance.detections_client.count()
        if n:
            raise ValidationError(f"Ce domaine contient {n} détection(s) ou template(s) : déplacez-les ou supprimez-les d'abord.")
        instance.delete()


class SourceLogViewSet(viewsets.ModelViewSet):
    permission_classes = [CatalogueReadOrManage]
    serializer_class = ser.SourceLogSerializer

    def get_queryset(self):
        return SourceLog.objects.annotate(nb_cas_usage=Count("template_sources", distinct=True)).order_by("ordre", "nom")

    def perform_destroy(self, instance):
        n = instance.template_sources.count() + instance.detection_sources.count()
        if n:
            raise ValidationError(f"Cette source est requise par {n} détection(s) ou template(s) : retirez-la d'abord de leur liste de sources.")
        instance.delete()


class SiemViewSet(viewsets.ModelViewSet):
    permission_classes = [CatalogueReadOrManage]
    serializer_class = ser.SiemSerializer

    def get_queryset(self):
        return Siem.objects.annotate(nb_clients=Count("clients", distinct=True)).order_by("ordre", "nom")

    @transaction.atomic
    def perform_destroy(self, instance):
        # Supprimer une plateforme supprime aussi les règles et requêtes de hunting écrites pour elle.
        instance.syntaxes.all().delete()
        instance.requetes_hunting.all().delete()
        instance.delete()


@api_view(["GET", "PUT"])
@permission_classes([CatalogueReadOrManage])
def guide_traduction(request):
    if request.method == "PUT":
        notion, texte = str(request.data.get("notion", "")).strip(), str(request.data.get("texte", ""))
        siem = Siem.objects.filter(code=request.data.get("siem")).first()
        if not notion or siem is None:
            return Response({"detail": "Notion et plateforme obligatoires."}, status=400)
        ordre = GuideTraduction.objects.filter(notion=notion).values_list("ordre", flat=True).first() or 99
        if texte.strip():
            GuideTraduction.objects.update_or_create(notion=notion, siem=siem, defaults={"texte": texte, "ordre": ordre})
        else:
            GuideTraduction.objects.filter(notion=notion, siem=siem).delete()
    return Response(ser.GuideSerializer(GuideTraduction.objects.select_related("siem"), many=True).data)


@api_view(["GET"])
def aide(request):
    return Response(ser.AideSerializer(AideEntree.objects.all(), many=True).data)


@api_view(["GET"])
def techniques(request):
    qs = TechniqueMitre.objects.all()
    q = request.query_params.get("q", "").strip()
    if q:
        qs = qs.filter(Q(identifiant__icontains=q) | Q(nom__icontains=q))
    if request.query_params.get("tactique"):
        qs = qs.filter(tactiques__contains=request.query_params["tactique"])
    qs = qs.filter(revoquee=False, obsolete=False) if request.query_params.get("actives") == "1" else qs
    return Response(ser.TechniqueSerializer(qs[:60 if q else 1200], many=True).data)


@api_view(["GET"])
def tactiques(request):
    return Response([{"shortname": t.shortname, "nom": t.nom, "ordre": t.ordre} for t in TactiqueMitre.objects.all()])


# ---------------------------------------------------------------- templates
def _template_qs():
    return Template.objects.select_related("domaine").prefetch_related(
        "techniques",
        Prefetch("template_sources", queryset=TemplateSource.objects.select_related("source")),
        Prefetch("syntaxes", queryset=Syntaxe.objects.select_related("siem")),
        "requetehuntings",
    )


def _get_template(code) -> Template:
    t = _template_qs().filter(code=code).first()
    if t is None:
        raise NotFound()
    return t


def _next_code() -> str:
    nums = [int(m.group(1)) for c in Template.objects.values_list("code", flat=True) if (m := re.fullmatch(r"DET-(\d+)", c))]
    return f"DET-{(max(nums) + 1 if nums else 1):03d}"


@api_view(["GET", "POST"])
@permission_classes([CatalogueReadOrManage])
def templates(request):
    if request.method == "POST":
        return _create_template(request)
    p = request.query_params
    qs = _template_qs()
    if p.get("domaine"):
        qs = qs.filter(domaine_id=p["domaine"])
    if p.get("type"):
        qs = qs.filter(type_detection=p["type"])
    if p.get("gravite"):
        qs = qs.filter(gravite=p["gravite"])
    if p.get("technique"):
        qs = qs.filter(techniques__identifiant=p["technique"])
    if p.get("source"):
        qs = qs.filter(template_sources__source_id=p["source"])
    if p.get("q"):
        q = p["q"]
        qs = qs.filter(Q(code__icontains=q) | Q(cas_usage__icontains=q) | Q(logique__icontains=q))
    qs = qs.distinct()
    nb = None
    if request.user.is_catalogue_manager:  # Responsable catalogue : seulement le nombre de clients, jamais les clients
        nb = dict(DetectionClient.objects.values("template_id").annotate(n=Count("client", distinct=True)).values_list("template_id", "n"))
    return Response([ser.template_list_item(t, nb_clients=nb) for t in qs])


@transaction.atomic
def _create_template(request):
    if not request.user.is_catalogue_manager:
        raise PermissionDenied("Réservé au Responsable catalogue ou à l'Administrateur plateforme.")
    d = request.data
    code = str(d.get("code") or "").strip().upper() or _next_code()
    if not re.fullmatch(r"DET-\d{3,}", code):
        return Response({"detail": "Code invalide (attendu : DET-083)."}, status=400)
    if Template.objects.filter(code=code).exists():
        return Response({"detail": f"{code} existe déjà."}, status=409)
    payload = ser.ContenuWriteSerializer(data=d)
    payload.is_valid(raise_exception=True)
    data = payload.validated_data
    if not data.get("cas_usage"):
        return Response({"detail": "Le cas d'usage est obligatoire."}, status=400)
    domaine = Domaine.objects.filter(pk=data.get("domaine_id")).first()
    if domaine is None:
        return Response({"detail": "Domaine inconnu."}, status=400)
    t = Template.objects.create(code=code, domaine=domaine, cas_usage=data["cas_usage"])
    apply_content(t, data, params_field="parametres_defaut")
    return Response(ser.template_payload(_get_template(code)), status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([CatalogueReadOrManage])
def template_detail(request, code):
    t = _get_template(code)
    if request.method == "DELETE":
        t.delete()  # les détections des clients qui l'ont copié restent, sans lien avec la bibliothèque
        return Response(status=204)
    if request.method == "PATCH":
        payload = ser.ContenuWriteSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            apply_content(t, payload.validated_data, params_field="parametres_defaut")
        t = _get_template(code)
    out = ser.template_payload(t)
    out["peut_modifier"] = request.user.is_catalogue_manager
    if request.user.is_catalogue_manager:
        out["nb_clients"] = DetectionClient.objects.filter(template=t).values("client").distinct().count()
    return Response(out)


@api_view(["POST"])
@permission_classes([IsCatalogueManager])
@transaction.atomic
def template_dupliquer(request, code):
    src = _get_template(code)
    nouveau = Template.objects.create(
        code=_next_code(), domaine=src.domaine, cas_usage=f"{src.cas_usage} (copie)"[:300], type_detection=src.type_detection,
        gravite=src.gravite, detections_similaires=src.detections_similaires, logs_a_collecter=src.logs_a_collecter, logique=src.logique, parametres_defaut=dict(src.parametres_defaut or {}),
        exclusions=src.exclusions, recommandation=src.recommandation, impact=src.impact,
    )
    nouveau.techniques.set(src.techniques.all())
    for ts in src.template_sources.all():
        nouveau.template_sources.create(source=ts.source, obligatoire=ts.obligatoire)
    for s in src.syntaxes.all():
        Syntaxe.objects.create(template=nouveau, siem=s.siem, contenu=s.contenu, champs_requis=list(s.champs_requis), notes=s.notes)
    for h in src.requetehuntings.all():
        RequeteHunting.objects.create(template=nouveau, siem=h.siem, titre=h.titre, objectif=h.objectif, requete=h.requete, periode_conseillee=h.periode_conseillee)
    return Response(ser.template_payload(_get_template(nouveau.code)), status=201)


@api_view(["PUT", "DELETE"])
@permission_classes([IsCatalogueManager])
def template_syntaxe(request, code, siem_code):
    t = _get_template(code)
    siem = Siem.objects.filter(code=siem_code).first()
    if siem is None:
        raise NotFound("Plateforme inconnue.")
    obj = Syntaxe.objects.filter(template=t, siem=siem).first()
    if request.method == "DELETE":
        if obj:
            obj.delete()
        return Response(status=204)
    s = ser.SyntaxeSerializer(data={**request.data, "siem": siem.code})
    s.is_valid(raise_exception=True)
    vd = s.validated_data
    if obj:
        obj.contenu, obj.champs_requis, obj.notes = vd["contenu"], vd.get("champs_requis", obj.champs_requis), vd.get("notes", obj.notes)
        obj.save()
    else:
        obj = Syntaxe.objects.create(template=t, **vd)
    return Response(ser.SyntaxeSerializer(obj).data)


@api_view(["POST"])
@permission_classes([IsCatalogueManager])
def template_hunting(request, code):
    t = _get_template(code)
    s = ser.HuntingSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    obj = RequeteHunting.objects.create(template=t, **s.validated_data)
    return Response(ser.HuntingSerializer(obj).data, status=201)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsCatalogueManager])
def hunting_detail(request, pk):
    obj = RequeteHunting.objects.filter(pk=pk, template__isnull=False).first()
    if obj is None:
        raise NotFound()
    if request.method == "DELETE":
        obj.delete()
        return Response(status=204)
    s = ser.HuntingSerializer(obj, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


# ---------------------------------------------------------------- import / stats / couverture / export
@api_view(["POST"])
@permission_classes([IsCatalogueManager])
@parser_classes([MultiPartParser, FormParser])
def catalogue_import(request):
    f = request.FILES.get("fichier")
    if f is None:
        return Response({"detail": "Fichier manquant (champ « fichier »)."}, status=400)
    if f.size > MAX_UPLOAD:
        return Response({"detail": "Fichier trop volumineux (15 Mo maximum)."}, status=413)
    if not f.name.lower().endswith(".xlsx"):
        return Response({"detail": "Format attendu : .xlsx"}, status=400)
    dry_run = str(request.data.get("dry_run", "true")).lower() not in ("false", "0", "non")
    try:
        report = importer.import_workbook(f, f.name, user=request.user, dry_run=dry_run)
    except importer.ImportError_ as exc:
        return Response({"detail": str(exc)}, status=400)
    return Response(report)


@api_view(["POST"])
@permission_classes([IsCatalogueManager])
@parser_classes([MultiPartParser, FormParser])
def attack_import(request):
    f = request.FILES.get("fichier")
    if f is None:
        return Response({"detail": "Fichier STIX manquant (champ « fichier »)."}, status=400)
    if f.size > 120 * 1024 * 1024:
        return Response({"detail": "Fichier trop volumineux."}, status=413)
    try:
        data = json.load(f)
        report = attack_service.import_bundle(data)
    except (ValueError, KeyError) as exc:
        return Response({"detail": f"Bundle STIX invalide : {exc}"}, status=400)
    return Response(report)


@api_view(["GET"])
def attack_impacts(request):
    return Response(
        {
            "version_attack": TechniqueMitre.objects.exclude(version_attack="").values_list("version_attack", flat=True).first(),
            "impacts": attack_service.impacts_templates() if request.user.is_catalogue_manager else [],
            "nb_techniques": TechniqueMitre.objects.count(),
            "nb_verifiees": TechniqueMitre.objects.filter(verifiee=True).count(),
        }
    )


@api_view(["GET"])
def catalogue_stats(request):
    """Compteurs par domaine de la bibliothèque, recalculés en base."""
    par_domaine = {d.nom: {"domaine_id": d.pk, "domaine": d.nom, "total": 0, "Unitaire": 0, "Seuil": 0, "Corrélation": 0} for d in Domaine.objects.all()}
    gravite, total = Counter(), 0
    for t in Template.objects.select_related("domaine"):
        row = par_domaine[t.domaine.nom]
        row["total"] += 1
        row[t.type_detection] += 1
        gravite[t.gravite] += 1
        total += 1
    return Response(
        {
            "total": total,
            "domaines": list(par_domaine.values()),
            "gravites": [{"gravite": g, "n": gravite.get(g, 0)} for g in sorted(GRAVITE_ORDRE, key=GRAVITE_ORDRE.get)],
            "nb_sources": SourceLog.objects.count(),
            "nb_domaines": Domaine.objects.count(),
            "nb_techniques_couvertes": TechniqueMitre.objects.filter(templates__isnull=False).distinct().count(),
        }
    )


@api_view(["GET"])
def catalogue_couverture(request):
    p = request.query_params
    qs = Template.objects.all()
    if p.get("domaine"):
        qs = qs.filter(domaine_id=p["domaine"])
    if p.get("gravite"):
        qs = qs.filter(gravite=p["gravite"])
    if p.get("siem"):
        qs = qs.filter(syntaxes__siem__code=p["siem"])
    cov: dict[str, dict] = {}
    for t in qs.distinct().prefetch_related("techniques"):
        for tech in t.techniques.all():
            c = cov.setdefault(tech.identifiant, {"count": 0, "detections": [], "statut": None})
            c["detections"].append(t.code)
            c["count"] += 1
    return Response(coverage_service.build_matrix(cov, seulement_couvertes=p.get("seulement_couvertes") == "1"))


@api_view(["GET"])
def catalogue_export(request):
    from .services.exports import catalogue_workbook

    data = catalogue_workbook()
    resp = HttpResponse(data, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = 'attachment; filename="catalogue_detection_soc_ucf.xlsx"'
    return resp
