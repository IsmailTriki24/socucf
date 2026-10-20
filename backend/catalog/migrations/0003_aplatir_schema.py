"""Étape 1/3 de l'aplatissement des templates : colonnes de contenu sur Template (le contenu de la version courante y sera copié)."""
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("catalog", "0002_initial")]

    operations = [
        migrations.AddField("siem", "categorie", models.CharField(choices=[("siem", "SIEM"), ("xdr", "XDR / plateforme SOC"), ("ndr", "NDR / réseau"), ("generique", "Format générique")], default="siem", max_length=12)),
        migrations.AlterField("siem", "langage_regle", models.CharField(help_text="XML Wazuh, SPL, KQL, EQL ou ES|QL, AQL…", max_length=120)),
        migrations.AlterField("siem", "langage_hunting", models.CharField(max_length=120)),
        migrations.AddField("template", "cas_usage", models.CharField(default="", max_length=300), preserve_default=False),
        migrations.AddField("template", "type_detection", models.CharField(choices=[("Simple", "Simple"), ("Seuil", "Seuil"), ("Corrélation", "Corrélation")], default="Simple", max_length=15)),
        migrations.AddField("template", "gravite", models.CharField(choices=[("Critique", "Critique"), ("Haute", "Haute"), ("Moyenne", "Moyenne"), ("Basse", "Basse")], default="Moyenne", max_length=10)),
        migrations.AddField("template", "logs_a_collecter", models.TextField(blank=True)),
        migrations.AddField("template", "logique", models.TextField(blank=True)),
        migrations.AddField("template", "parametres_defaut", models.JSONField(blank=True, default=dict)),
        migrations.AddField("template", "exclusions", models.TextField(blank=True, verbose_name="Exclusions conseillées")),
        migrations.AddField("template", "recommandation", models.TextField(blank=True)),
        migrations.AddField("template", "impact", models.TextField(blank=True)),
        migrations.AddField("template", "cree_le", models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now), preserve_default=False),
        migrations.AddField("template", "modifie_le", models.DateTimeField(auto_now=True, default=django.utils.timezone.now), preserve_default=False),
        migrations.AddField("template", "techniques", models.ManyToManyField(blank=True, related_name="templates", to="catalog.techniquemitre")),
        migrations.AddField("templatesource", "template", models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="template_sources", to="catalog.template")),
        migrations.AddField("syntaxe", "template", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(class)ss", to="catalog.template")),
        migrations.AddField("requetehunting", "template", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(class)ss", to="catalog.template")),
    ]
