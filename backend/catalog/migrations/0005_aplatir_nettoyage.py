"""Étape 3/3 : suppression des versions (TemplateVersion) et des champs devenus inutiles."""
import django.db.models.deletion
from django.db import migrations, models


def nettoyer(apps, schema_editor):
    Template = apps.get_model("catalog", "Template")
    TemplateSource = apps.get_model("catalog", "TemplateSource")
    Syntaxe = apps.get_model("catalog", "Syntaxe")
    Hunting = apps.get_model("catalog", "RequeteHunting")
    # Lignes des anciennes versions non courantes (jamais reprises sur le template)
    TemplateSource.objects.filter(template__isnull=True).delete()
    Syntaxe.objects.filter(template__isnull=True, detection_client__isnull=True).delete()
    Hunting.objects.filter(template__isnull=True, detection_client__isnull=True).delete()
    # Un template retiré disparaît (les détections des clients qui l'ont copié restent, sans lien)
    Template.objects.filter(statut="retire").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_aplatir_donnees"),
        ("clients", "0004_aplatir_nettoyage"),
    ]

    operations = [
        migrations.RunPython(nettoyer, migrations.RunPython.noop),
        migrations.RemoveConstraint("syntaxe", "syntaxe_un_seul_rattachement"),
        migrations.RemoveConstraint("syntaxe", "syntaxe_unique_version"),
        migrations.RemoveConstraint("requetehunting", "hunting_un_seul_rattachement"),
        migrations.RemoveConstraint("templatesource", "template_source_unique"),
        migrations.RemoveField("syntaxe", "template_version"),
        migrations.RemoveField("requetehunting", "template_version"),
        migrations.RemoveField("templatesource", "version"),
        migrations.RemoveField("template", "version_courante"),
        migrations.RemoveField("template", "statut"),
        migrations.DeleteModel("TemplateVersion"),
        migrations.RemoveField("siem", "propose"),
        migrations.AlterField("templatesource", "template", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="template_sources", to="catalog.template")),
        migrations.AddField("template", "sources", models.ManyToManyField(related_name="templates", through="catalog.TemplateSource", to="catalog.sourcelog")),
        migrations.AddConstraint("templatesource", models.UniqueConstraint(fields=("template", "source"), name="template_source_unique")),
        migrations.AddConstraint("syntaxe", models.CheckConstraint(condition=models.Q(("detection_client__isnull", True), ("template__isnull", False)) | models.Q(("detection_client__isnull", False), ("template__isnull", True)), name="syntaxe_un_seul_rattachement")),
        migrations.AddConstraint("syntaxe", models.UniqueConstraint(condition=models.Q(("template__isnull", False)), fields=("template", "siem"), name="syntaxe_unique_template")),
        migrations.AddConstraint("requetehunting", models.CheckConstraint(condition=models.Q(("detection_client__isnull", True), ("template__isnull", False)) | models.Q(("detection_client__isnull", False), ("template__isnull", True)), name="hunting_un_seul_rattachement")),
    ]
