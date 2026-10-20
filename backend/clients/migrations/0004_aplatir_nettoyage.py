"""Étape 3/3 : retrait des champs liés aux versions de template, à la revue automatique J+14 et au retrait."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("clients", "0003_aplatir_donnees")]

    operations = [
        migrations.RemoveField("detectionclient", "version_origine"),
        migrations.RemoveField("detectionclient", "prochaine_revue"),
        migrations.RemoveField("detectionclient", "motif_revue"),
        migrations.RemoveField("detectionclient", "revue_initiale_faite"),
        migrations.RemoveField("detectionclient", "motif_retrait"),
        migrations.AlterField("detectionclient", "domaine", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="detections_client", to="catalog.domaine")),
        migrations.AlterField("detectionclient", "code", models.CharField(max_length=20)),
        migrations.AlterField("detectionclient", "statut", models.CharField(choices=[("brouillon", "Brouillon"), ("en_test", "En test"), ("a_revoir", "À revoir"), ("validee", "Validé"), ("deployee", "Déployé")], default="brouillon", max_length=10)),
        migrations.AddConstraint("detectionclient", models.UniqueConstraint(fields=("client", "code"), name="detection_client_code_unique")),
    ]
