"""Création, copie et synchronisation des détections d'un client."""
import re

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from catalog.models import Domaine, RequeteHunting, Syntaxe, Template

from ..models import (
    Client,
    ClientSource,
    DetectionClient,
    DetectionSource,
    Journalisation,
    StatutDetection,
    StatutSource,
)


def initialiser_sources(client: Client) -> None:
    """Une ligne « source de logs » par source du référentiel, toutes à ajouter au départ."""
    from catalog.models import SourceLog

    existantes = set(ClientSource.objects.filter(client=client).values_list("source_id", flat=True))
    for s in SourceLog.objects.exclude(pk__in=existantes):
        ClientSource.objects.create(client=client, source=s, statut=StatutSource.A_ACTIVER)


def sources_collectees(client: Client) -> set[int]:
    return set(ClientSource.objects.filter(client=client, statut=StatutSource.COLLECTEE).values_list("source_id", flat=True))


def journalisation_satisfaite(detection: DetectionClient, collectees: set[int]) -> bool:
    """Au moins une source de la détection est collectée et toutes les sources « obligatoires » le sont."""
    rows = list(detection.detection_sources.all())
    ids = {r.source_id for r in rows}
    obligatoires = {r.source_id for r in rows if r.obligatoire}
    return bool(ids & collectees) and obligatoires <= collectees


def recalculer_journalisation(client: Client, user=None) -> int:
    """Passe à OK les détections dont les sources sont maintenant collectées (ne rétrograde jamais)."""
    collectees = sources_collectees(client)
    n = 0
    for d in DetectionClient.objects.filter(client=client, journalisation=Journalisation.NON).prefetch_related("detection_sources"):
        if journalisation_satisfaite(d, collectees):
            d.journalisation = Journalisation.OK
            d.save(update_fields=["journalisation", "mis_a_jour_le"])
            n += 1
    return n


def _copier_regles(template: Template, detection: DetectionClient, siems, *, ecraser=False) -> None:
    siem_ids = {s.pk for s in siems}
    for s in template.syntaxes.filter(siem_id__in=siem_ids):
        existante = detection.syntaxes.filter(siem=s.siem).first()
        if existante and not ecraser:
            continue
        if existante:
            existante.contenu, existante.champs_requis, existante.notes = s.contenu, list(s.champs_requis), s.notes
            existante.save()
        else:
            Syntaxe.objects.create(detection_client=detection, siem=s.siem, contenu=s.contenu, champs_requis=list(s.champs_requis), notes=s.notes)
    for h in template.requetehuntings.filter(siem_id__in=siem_ids):
        existante = detection.requetehuntings.filter(siem=h.siem, titre=h.titre).first()
        if existante and not ecraser:
            continue
        if existante:
            existante.objectif, existante.requete, existante.periode_conseillee = h.objectif, h.requete, h.periode_conseillee
            existante.save()
        else:
            RequeteHunting.objects.create(detection_client=detection, siem=h.siem, titre=h.titre, objectif=h.objectif,
                                          requete=h.requete, periode_conseillee=h.periode_conseillee)


def _copier_contenu(template: Template, detection: DetectionClient) -> None:
    detection.techniques.set(template.techniques.all())
    detection.detection_sources.all().delete()
    for ts in template.template_sources.all():
        DetectionSource.objects.create(detection=detection, source=ts.source, obligatoire=ts.obligatoire)


@transaction.atomic
def instancier(client: Client, template: Template, user, *, collectees: set[int] | None = None) -> DetectionClient:
    """Copie le template chez le client : contenu, sources, techniques, règles et hunting des plateformes du client."""
    if DetectionClient.objects.filter(client=client, code=template.code).exists():
        raise ValidationError(f"{template.code} est déjà dans les détections de ce client.")
    d = DetectionClient.objects.create(
        client=client, template=template, code=template.code, domaine=template.domaine, cas_usage=template.cas_usage,
        type_detection=template.type_detection, gravite=template.gravite, detections_similaires=template.detections_similaires, logs_a_collecter=template.logs_a_collecter,
        logique=template.logique, parametres=dict(template.parametres_defaut or {}), exclusions=template.exclusions,
        recommandation=template.recommandation, impact=template.impact, statut=StatutDetection.BROUILLON,
        proprietaire=user, modifie_par=user, modifie_le=timezone.now(),
    )
    _copier_contenu(template, d)
    _copier_regles(template, d, client.siems.all())
    if journalisation_satisfaite(d, sources_collectees(client) if collectees is None else collectees):
        d.journalisation = Journalisation.OK
        d.save(update_fields=["journalisation"])
    return d


@transaction.atomic
def synchroniser(client: Client, user, *, domaines=None) -> int:
    """Ajoute les templates des domaines donnés (par défaut tous ceux du client) qui ne sont pas déjà chez le client."""
    domaines = list(client.domaines.all()) if domaines is None else list(domaines)
    deja = set(DetectionClient.objects.filter(client=client).values_list("code", flat=True))
    collectees = sources_collectees(client)
    n = 0
    for t in Template.objects.filter(domaine__in=domaines).exclude(code__in=deja).select_related("domaine"):
        instancier(client, t, user, collectees=collectees)
        n += 1
    return n


@transaction.atomic
def completer_regles(client: Client) -> int:
    """Après l'ajout d'une plateforme au client : copie les règles du template manquantes dans ses détections."""
    siems = list(client.siems.all())
    n = 0
    for d in DetectionClient.objects.filter(client=client, template__isnull=False).select_related("template"):
        avant = d.syntaxes.count() + d.requetehuntings.count()
        _copier_regles(d.template, d, siems)
        n += (d.syntaxes.count() + d.requetehuntings.count()) - avant
    return n


def prochain_code_client(client: Client) -> str:
    nums = [int(m.group(1)) for c in DetectionClient.objects.filter(client=client).values_list("code", flat=True) if (m := re.fullmatch(r"CLI-(\d+)", c))]
    return f"CLI-{(max(nums) + 1 if nums else 1):03d}"


@transaction.atomic
def creer_libre(client: Client, user, domaine: Domaine, cas_usage: str, **champs) -> DetectionClient:
    """Détection propre au client, sans template d'origine."""
    d = DetectionClient.objects.create(
        client=client, code=prochain_code_client(client), domaine=domaine, cas_usage=cas_usage,
        proprietaire=user, modifie_par=user, modifie_le=timezone.now(), **champs,
    )
    return d


@transaction.atomic
def reinitialiser(detection: DetectionClient, user, *, regles: bool = True) -> DetectionClient:
    """Remet le contenu depuis le template d'origine (les réglages du client sont écrasés)."""
    t = detection.template
    if t is None:
        raise ValidationError("Cette détection n'a pas de template d'origine.")
    for f in ("domaine", "cas_usage", "type_detection", "gravite", "detections_similaires", "logs_a_collecter", "logique", "exclusions", "recommandation", "impact"):
        setattr(detection, f, getattr(t, f))
    detection.parametres = dict(t.parametres_defaut or {})
    detection.modifie_par, detection.modifie_le = user, timezone.now()
    detection.save()
    _copier_contenu(t, detection)
    if regles:
        # Retour à l'état du template : les règles ajoutées chez le client disparaissent aussi.
        detection.syntaxes.all().delete()
        detection.requetehuntings.all().delete()
        _copier_regles(t, detection, detection.client.siems.all())
    return detection


def marquer_modifiee(detection: DetectionClient, user) -> None:
    detection.modifie_par = user
    detection.modifie_le = timezone.now()
    detection.save()


def appliquer_statut(detection: DetectionClient, statut: str) -> None:
    """Le statut se choisit librement ; passer à Déployé date le déploiement si aucune date n'est encore renseignée."""
    if statut not in StatutDetection.values:
        raise ValidationError(f"Statut inconnu : {statut}")
    detection.statut = statut
    if statut == StatutDetection.DEPLOYEE and not detection.date_deploiement:
        detection.date_deploiement = timezone.localdate()
