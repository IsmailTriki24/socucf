"""Étape 2/3 : chaque détection client reçoit le contenu de la version de template dont elle venait."""
from django.db import migrations


def copier(apps, schema_editor):
    DC = apps.get_model("clients", "DetectionClient")
    DS = apps.get_model("clients", "DetectionSource")
    ClientSource = apps.get_model("clients", "ClientSource")
    # Les détections « retirées » sont supprimées : la suppression est désormais définitive
    DC.objects.filter(statut="retiree").delete()
    for d in DC.objects.select_related("template", "version_origine"):
        v = d.version_origine
        parametres = dict(v.parametres_defaut or {})
        parametres.update({k: val for k, val in (d.parametres or {}).items() if val not in (None, "")})
        sources = list(v.sources.select_related("source"))
        collectees = set(ClientSource.objects.filter(client_id=d.client_id, statut="collectee").values_list("source_id", flat=True))
        obligatoires = {ts.source_id for ts in sources if ts.obligatoire}
        ok = bool(collectees & {ts.source_id for ts in sources}) and obligatoires <= collectees
        DC.objects.filter(pk=d.pk).update(
            code=d.template.code, domaine_id=d.template.domaine_id, cas_usage=v.cas_usage, type_detection=v.type_detection,
            gravite=v.gravite, logs_a_collecter=v.logs_a_collecter, logique=v.logique, parametres=parametres,
            journalisation="ok" if ok else "non",
        )
        DS.objects.bulk_create([DS(detection_id=d.pk, source_id=ts.source_id, obligatoire=ts.obligatoire) for ts in sources])
        Through = DC.techniques.through
        Through.objects.bulk_create([Through(detectionclient_id=d.pk, techniquemitre_id=tid) for tid in v.techniques.values_list("pk", flat=True)])


class Migration(migrations.Migration):
    dependencies = [("clients", "0002_aplatir_schema")]
    operations = [migrations.RunPython(copier, migrations.RunPython.noop)]
