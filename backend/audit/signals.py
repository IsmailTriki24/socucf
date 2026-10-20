"""Journalisation automatique de chaque écriture sur les objets audités.

Les signaux couvrent aussi l'import et les commandes de gestion. Les écritures en masse
(``bulk_create``, ``QuerySet.update``) ne déclenchent pas de signal : elles sont interdites
sur les modèles audités.
"""
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_save

from . import context
from .models import JournalAudit

REDACTED = {"password"}




# libellé modèle -> fonction (instance -> client_id ou None). None dans le dict = non rattaché à un client.
AUDITED = {}


def register(label, client_resolver=None):
    AUDITED[label] = client_resolver or (lambda obj: None)


def snapshot(instance) -> dict:
    data = {}
    for field in instance._meta.concrete_fields:
        if field.name in REDACTED:
            continue
        value = field.value_from_object(instance)
        key = field.attname if field.is_relation else field.name
        if hasattr(value, "name") and not isinstance(value, str):  # FieldFile
            value = value.name
        data[key] = value
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))


def _client_id(label, instance):
    try:
        return AUDITED[label](instance)
    except Exception:  # objet parent déjà supprimé
        return None


def _repr(instance, label) -> str:
    try:
        return str(instance)[:300]
    except Exception:  # objet lié déjà supprimé (cascade) : on garde au moins une référence
        return f"{label} {instance.pk}"


def _write(instance, action, avant, apres):
    from clients.models import Client

    if context.is_muted():
        return

    label = instance._meta.label
    user = context.current_user()
    client_id = _client_id(label, instance)
    client_nom = ""
    if client_id:
        client_nom = Client.objects.filter(pk=client_id).values_list("nom", flat=True).first() or ""
    JournalAudit.objects.create(
        utilisateur=user,
        utilisateur_nom=(user.nom_affiche if user else "système"),
        client_id=client_id,
        client_nom=client_nom,
        objet_type=label,
        objet_id=str(instance.pk),
        objet_repr=_repr(instance, label),
        action=action,
        avant=avant,
        apres=apres,
    )


def _on_pre_save(sender, instance, raw=False, **kwargs):
    if raw or sender._meta.label not in AUDITED:
        return
    old = sender._default_manager.filter(pk=instance.pk).first() if instance.pk else None
    instance._audit_avant = snapshot(old) if old else None


def _on_post_save(sender, instance, created, raw=False, **kwargs):
    label = sender._meta.label
    if raw or label not in AUDITED:
        return
    new = snapshot(instance)
    if created or getattr(instance, "_audit_avant", None) is None:
        _write(instance, "creation", None, new)
        return
    old = instance._audit_avant
    changed = {k for k in new if new[k] != old.get(k)}
    if not changed:
        return
    _write(instance, "modification", {k: old.get(k) for k in sorted(changed)}, {k: new[k] for k in sorted(changed)})


def _on_post_delete(sender, instance, **kwargs):
    if sender._meta.label in AUDITED:
        _write(instance, "suppression", snapshot(instance), None)


def _on_m2m(sender, instance, action, reverse, pk_set, **kwargs):
    label = instance._meta.label
    if reverse or label not in AUDITED or action not in ("post_add", "post_remove", "post_clear"):
        return
    field_name = next((f.name for f in instance._meta.many_to_many if f.remote_field.through is sender), None)
    if field_name is None:
        return
    current = sorted(getattr(instance, field_name).values_list("pk", flat=True))
    _write(instance, "modification", None, {field_name: current})


def connect():
    pre_save.connect(_on_pre_save, dispatch_uid="audit_pre_save")
    post_save.connect(_on_post_save, dispatch_uid="audit_post_save")
    post_delete.connect(_on_post_delete, dispatch_uid="audit_post_delete")
    m2m_changed.connect(_on_m2m, dispatch_uid="audit_m2m")
