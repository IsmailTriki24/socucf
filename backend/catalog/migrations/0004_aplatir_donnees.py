"""Étape 2/3 : copie du contenu de la version courante de chaque template vers le template, et ajout des nouvelles plateformes."""
from django.db import migrations


def copier(apps, schema_editor):
    Template = apps.get_model("catalog", "Template")
    TemplateVersion = apps.get_model("catalog", "TemplateVersion")
    TemplateSource = apps.get_model("catalog", "TemplateSource")
    Syntaxe = apps.get_model("catalog", "Syntaxe")
    Hunting = apps.get_model("catalog", "RequeteHunting")
    for t in Template.objects.all():
        v = t.version_courante or TemplateVersion.objects.filter(template=t).order_by("-numero").first()
        if v is None:
            continue
        # .update() : pas de signal, donc pas d'entrée d'audit pour une simple migration de schéma
        Template.objects.filter(pk=t.pk).update(
            cas_usage=v.cas_usage, type_detection=v.type_detection, gravite=v.gravite, logs_a_collecter=v.logs_a_collecter,
            logique=v.logique, parametres_defaut=v.parametres_defaut or {},
        )
        Through = Template.techniques.through
        Through.objects.bulk_create([Through(template_id=t.pk, techniquemitre_id=tid) for tid in v.techniques.values_list("pk", flat=True)])
        TemplateSource.objects.filter(version=v).update(template=t)
        Syntaxe.objects.filter(template_version=v).update(template=t)
        Hunting.objects.filter(template_version=v).update(template=t)

    # Nouvelles plateformes SIEM / XDR (une seule fois : ensuite, tout se gère dans l'application)
    from catalog.services.referentiels import SIEMS

    Siem = apps.get_model("catalog", "Siem")
    existants = set(Siem.objects.values_list("code", flat=True))
    for i, (code, nom, categorie, lr, lh, mode) in enumerate(SIEMS):
        if code not in existants:
            Siem.objects.create(code=code, nom=nom, categorie=categorie, langage_regle=lr, langage_hunting=lh, mode_editeur=mode, ordre=i)
        else:
            Siem.objects.filter(code=code).update(ordre=i, categorie=categorie)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0003_aplatir_schema")]
    operations = [migrations.RunPython(copier, migrations.RunPython.noop)]
