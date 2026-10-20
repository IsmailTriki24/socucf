from django.conf import settings
from django.db import models


class JournalAudit(models.Model):
    """Trace de chaque écriture : qui, quand, quel objet, valeur avant et après."""

    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    utilisateur_nom = models.CharField(max_length=150, blank=True, default="système")
    date = models.DateTimeField(auto_now_add=True, db_index=True)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="journal")
    client_nom = models.CharField(max_length=200, blank=True)
    objet_type = models.CharField(max_length=60, db_index=True)
    objet_id = models.CharField(max_length=40)
    objet_repr = models.CharField(max_length=300, blank=True)
    action = models.CharField(max_length=20)
    avant = models.JSONField(null=True, blank=True)
    apres = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["client", "-date"])]

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError("Le journal d'audit est en ajout seul.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Le journal d'audit est en ajout seul.")
