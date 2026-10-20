from django.conf import settings
from django.db import models

from catalog.models import Gravite, TypeDetection


class ClientQuerySet(models.QuerySet):
    def visible_to(self, user):
        """Seuls les clients sur lesquels l'utilisateur est habilité (tous pour l'Admin plateforme)."""
        if not user or not user.is_authenticated or not user.is_active:
            return self.none()
        if user.is_platform_admin:
            return self
        return self.filter(actif=True, habilitations__utilisateur=user).distinct()


class Client(models.Model):
    nom = models.CharField(max_length=200, unique=True)
    secteur = models.CharField(max_length=100, blank=True)
    siems = models.ManyToManyField("catalog.Siem", blank=True, related_name="clients")
    domaines = models.ManyToManyField("catalog.Domaine", blank=True, related_name="clients")
    actif = models.BooleanField(default=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    objects = ClientQuerySet.as_manager()

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class StatutSource(models.TextChoices):
    COLLECTEE = "collectee", "Collectée"
    A_ACTIVER = "a_activer", "À activer"
    SANS_OBJET = "sans_objet", "Sans objet"


class ClientSource(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="sources")
    source = models.ForeignKey("catalog.SourceLog", on_delete=models.PROTECT, related_name="client_sources")
    statut = models.CharField(max_length=12, choices=StatutSource.choices, default=StatutSource.A_ACTIVER)
    commentaire = models.TextField(blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["client", "source"], name="client_source_unique")]
        ordering = ["source__ordre", "source__nom"]

    def __str__(self):
        return f"{self.client} · {self.source} · {self.statut}"


class StatutDetection(models.TextChoices):
    BROUILLON = "brouillon", "Brouillon"
    EN_TEST = "en_test", "En test"
    A_REVOIR = "a_revoir", "À revoir"
    VALIDEE = "validee", "Validé"
    DEPLOYEE = "deployee", "Déployé"


# Avancement pour la matrice ATT&CK client (« statut le plus avancé »)
STATUT_AVANCEMENT = {"brouillon": 1, "en_test": 2, "a_revoir": 3, "validee": 4, "deployee": 5}


class Journalisation(models.TextChoices):
    OK = "ok", "OK"
    NON = "non", "Non"


class DetectionClient(models.Model):
    """Copie autonome et modifiable d'un template pour un client (ou détection créée directement chez lui)."""

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="detections")
    # Le template d'origine peut disparaître de la bibliothèque : la détection du client reste.
    template = models.ForeignKey("catalog.Template", null=True, blank=True, on_delete=models.SET_NULL, related_name="detections_client")
    code = models.CharField(max_length=20)
    domaine = models.ForeignKey("catalog.Domaine", on_delete=models.PROTECT, related_name="detections_client")
    cas_usage = models.CharField(max_length=300)
    type_detection = models.CharField(max_length=15, choices=TypeDetection.choices, default=TypeDetection.UNITAIRE)
    gravite = models.CharField(max_length=10, choices=Gravite.choices, default=Gravite.MOYENNE)
    detections_similaires = models.CharField(max_length=500, blank=True)
    logs_a_collecter = models.TextField(blank=True)
    logique = models.TextField(blank=True)
    # Valeurs des paramètres {{nom}} utilisés par les règles (seuil, fenêtre…), copiées du template puis ajustées.
    parametres = models.JSONField(default=dict, blank=True)
    # {"liste_admins": ["adm1", "adm2"], "serveurs": [...], "ioc": [...]}
    listes_reference = models.JSONField(default=dict, blank=True)
    exclusions = models.TextField(blank=True)
    recommandation = models.TextField(blank=True)
    impact = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    techniques = models.ManyToManyField("catalog.TechniqueMitre", blank=True, related_name="detections_client")
    sources = models.ManyToManyField("catalog.SourceLog", through="DetectionSource", related_name="detections_client")
    statut = models.CharField(max_length=10, choices=StatutDetection.choices, default=StatutDetection.BROUILLON)
    journalisation = models.CharField(max_length=3, choices=Journalisation.choices, default=Journalisation.NON)
    proprietaire = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    date_deploiement = models.DateField(null=True, blank=True)
    reference_siem = models.CharField(max_length=200, blank=True)
    modifie_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    modifie_le = models.DateTimeField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    mis_a_jour_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        constraints = [models.UniqueConstraint(fields=["client", "code"], name="detection_client_code_unique")]
        indexes = [models.Index(fields=["client", "statut"])]

    def __str__(self):
        return f"{self.client} · {self.code}"

    def valeurs_parametres(self) -> dict:
        valeurs = dict(self.parametres or {})
        for nom, liste in (self.listes_reference or {}).items():
            valeurs[nom] = ", ".join(str(v) for v in liste) if isinstance(liste, (list, tuple)) else liste
        return valeurs


class DetectionSource(models.Model):
    detection = models.ForeignKey(DetectionClient, on_delete=models.CASCADE, related_name="detection_sources")
    source = models.ForeignKey("catalog.SourceLog", on_delete=models.PROTECT, related_name="detection_sources")
    obligatoire = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["detection", "source"], name="detection_source_unique")]
        ordering = ["source__ordre", "source__nom"]

    def __str__(self):
        return f"{self.detection} ↔ {self.source}"


class PreuveTest(models.Model):
    class Resultat(models.TextChoices):
        REUSSI = "reussi", "Réussi"
        ECHOUE = "echoue", "Échoué"

    detection = models.ForeignKey(DetectionClient, on_delete=models.CASCADE, related_name="preuves")
    date = models.DateTimeField()
    resultat = models.CharField(max_length=10, choices=Resultat.choices)
    description = models.TextField(blank=True, help_text="Événement simulé ou ligne de log rejouée")
    capture = models.FileField(upload_to="preuves/%Y/%m/", blank=True)
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"Test {self.detection} · {self.resultat}"
