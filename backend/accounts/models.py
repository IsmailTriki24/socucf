from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class RoleGlobal(models.TextChoices):
    AUCUN = "", "Aucun"
    ADMIN_PLATEFORME = "admin_plateforme", "Administrateur plateforme"
    RESPONSABLE_CATALOGUE = "responsable_catalogue", "Responsable catalogue"


class RoleClient(models.TextChoices):
    ADMIN_CLIENT = "admin_client", "Admin client"
    VALIDEUR = "valideur", "Valideur"
    CONTRIBUTEUR = "contributeur", "Contributeur"
    LECTEUR = "lecteur", "Lecteur"


class User(AbstractUser):
    role_global = models.CharField(max_length=32, choices=RoleGlobal.choices, blank=True, default="")

    @property
    def is_platform_admin(self) -> bool:
        return self.is_active and (self.is_superuser or self.role_global == RoleGlobal.ADMIN_PLATEFORME)

    @property
    def is_catalogue_manager(self) -> bool:
        return self.is_active and (self.is_platform_admin or self.role_global == RoleGlobal.RESPONSABLE_CATALOGUE)

    @property
    def nom_affiche(self) -> str:
        return self.get_full_name() or self.username


class Habilitation(models.Model):
    """Droit d'un utilisateur sur un client : (utilisateur, client, rôle)."""

    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="habilitations")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="habilitations")
    role = models.CharField(max_length=20, choices=RoleClient.choices)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["utilisateur", "client"], name="habilitation_unique")]
        ordering = ["client__nom", "utilisateur__username"]

    def __str__(self):
        return f"{self.utilisateur} · {self.client} · {self.role}"
