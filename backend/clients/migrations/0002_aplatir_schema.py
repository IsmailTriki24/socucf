"""Détection client autonome : contenu copié du template, journalisation, sources et techniques propres (étape 1/3)."""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_aplatir_donnees"),
        ("clients", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint("detectionclient", "detection_client_unique_active"),
        migrations.AlterField("detectionclient", "template", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="detections_client", to="catalog.template")),
        migrations.AddField("detectionclient", "code", models.CharField(default="", max_length=20), preserve_default=False),
        migrations.AddField("detectionclient", "domaine", models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="detections_client", to="catalog.domaine")),
        migrations.AddField("detectionclient", "cas_usage", models.CharField(default="", max_length=300), preserve_default=False),
        migrations.AddField("detectionclient", "type_detection", models.CharField(choices=[("Simple", "Simple"), ("Seuil", "Seuil"), ("Corrélation", "Corrélation")], default="Simple", max_length=15)),
        migrations.AddField("detectionclient", "gravite", models.CharField(choices=[("Critique", "Critique"), ("Haute", "Haute"), ("Moyenne", "Moyenne"), ("Basse", "Basse")], default="Moyenne", max_length=10)),
        migrations.AddField("detectionclient", "logs_a_collecter", models.TextField(blank=True)),
        migrations.AddField("detectionclient", "logique", models.TextField(blank=True)),
        migrations.AddField("detectionclient", "recommandation", models.TextField(blank=True)),
        migrations.AddField("detectionclient", "impact", models.TextField(blank=True)),
        migrations.AddField("detectionclient", "journalisation", models.CharField(choices=[("ok", "OK"), ("non", "Non")], default="non", max_length=3)),
        migrations.AddField("detectionclient", "techniques", models.ManyToManyField(blank=True, related_name="detections_client", to="catalog.techniquemitre")),
        migrations.CreateModel(
            name="DetectionSource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("obligatoire", models.BooleanField(default=False)),
                ("detection", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="detection_sources", to="clients.detectionclient")),
                ("source", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="detection_sources", to="catalog.sourcelog")),
            ],
            options={"ordering": ["source__ordre", "source__nom"]},
        ),
        migrations.AddConstraint("detectionsource", models.UniqueConstraint(fields=("detection", "source"), name="detection_source_unique")),
        migrations.AddField("detectionclient", "sources", models.ManyToManyField(related_name="detections_client", through="clients.DetectionSource", to="catalog.sourcelog")),
        migrations.AlterField("detectionclient", "statut", models.CharField(choices=[("brouillon", "Brouillon"), ("en_test", "En test"), ("a_revoir", "À revoir"), ("validee", "Validé"), ("deployee", "Déployé"), ("retiree", "Retirée")], default="brouillon", max_length=10)),
        migrations.AlterModelOptions("detectionclient", options={"ordering": ["code"]}),
    ]
