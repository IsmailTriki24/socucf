import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Domaine(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom


class SourceLog(models.Model):
    nom = models.CharField(max_length=150, unique=True)
    a_activer = models.TextField("À activer / à collecter", blank=True)
    evenements_cles = models.TextField("Événements ou champs clés", blank=True)
    piege = models.TextField("Piège fréquent", blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom


class CategorieSiem(models.TextChoices):
    SIEM = "siem", "SIEM"
    XDR = "xdr", "XDR / plateforme SOC"
    NDR = "ndr", "NDR / réseau"
    GENERIQUE = "generique", "Format générique"


class Siem(models.Model):
    code = models.SlugField(max_length=30, unique=True)
    nom = models.CharField(max_length=100)
    langage_regle = models.CharField(max_length=120, help_text="XML Wazuh, SPL, KQL, EQL ou ES|QL, AQL…")
    langage_hunting = models.CharField(max_length=120)
    categorie = models.CharField(max_length=12, choices=CategorieSiem.choices, default=CategorieSiem.SIEM)
    # Mode CodeMirror : xml, sql, yaml ou texte
    mode_editeur = models.CharField(max_length=10, default="text")
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom


class GuideTraduction(models.Model):
    """Guide de traduction du Lisez-moi : une notion, un texte par SIEM."""

    notion = models.CharField(max_length=150)
    siem = models.ForeignKey(Siem, on_delete=models.CASCADE, related_name="guide")
    texte = models.TextField(blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "siem__ordre"]
        constraints = [models.UniqueConstraint(fields=["notion", "siem"], name="guide_unique")]


class AideEntree(models.Model):
    """Aide en ligne issue du Lisez-moi (5 étapes, définitions de Type, Gravité…)."""

    section = models.CharField(max_length=40)  # etapes | definitions | principe
    titre = models.CharField(max_length=150)
    texte = models.TextField()
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["section", "ordre"]
        constraints = [models.UniqueConstraint(fields=["section", "titre"], name="aide_unique")]


class TactiqueMitre(models.Model):
    shortname = models.CharField(max_length=60, unique=True)  # credential-access
    nom = models.CharField(max_length=100)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre"]

    def __str__(self):
        return self.nom


class TechniqueMitre(models.Model):
    identifiant = models.CharField(max_length=15, unique=True)  # T1110.001
    nom = models.CharField(max_length=200)
    tactiques = models.JSONField(default=list, blank=True)  # ["credential-access", ...]
    parente = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="sous_techniques")
    version_attack = models.CharField(max_length=10, blank=True)
    obsolete = models.BooleanField(default=False)
    revoquee = models.BooleanField(default=False)
    remplacee_par = models.CharField(max_length=15, blank=True)
    # False tant que l'identifiant n'a pas été retrouvé dans le référentiel STIX chargé.
    verifiee = models.BooleanField(default=False)

    class Meta:
        ordering = ["identifiant"]

    def __str__(self):
        return f"{self.identifiant} {self.nom}"


class TypeDetection(models.TextChoices):
    UNITAIRE = "Unitaire", "Unitaire"
    SEUIL = "Seuil", "Seuil"
    CORRELATION = "Corrélation", "Corrélation"


class Gravite(models.TextChoices):
    CRITIQUE = "Critique", "Critique"
    HAUTE = "Haute", "Haute"
    MOYENNE = "Moyenne", "Moyenne"
    BASSE = "Basse", "Basse"


GRAVITE_ORDRE = {"Critique": 0, "Haute": 1, "Moyenne": 2, "Basse": 3}
TYPE_ORDRE = {"Unitaire": 0, "Seuil": 1, "Corrélation": 2}


class Template(models.Model):
    """Modèle de détection de la bibliothèque. Entièrement modifiable ; chaque client reçoit sa propre copie."""

    code = models.CharField(max_length=20, unique=True)  # DET-001
    domaine = models.ForeignKey(Domaine, on_delete=models.PROTECT, related_name="templates")
    cas_usage = models.CharField(max_length=300)
    type_detection = models.CharField(max_length=15, choices=TypeDetection.choices, default=TypeDetection.UNITAIRE)
    gravite = models.CharField(max_length=10, choices=Gravite.choices, default=Gravite.MOYENNE)
    detections_similaires = models.CharField(max_length=500, blank=True)
    logs_a_collecter = models.TextField(blank=True)
    logique = models.TextField(blank=True)
    # {"seuil": 8, "fenetre": "10m", ...} : valeurs de départ des paramètres {{nom}} des règles
    parametres_defaut = models.JSONField(default=dict, blank=True)
    exclusions = models.TextField("Exclusions conseillées", blank=True)
    recommandation = models.TextField(blank=True)
    impact = models.TextField(blank=True)
    techniques = models.ManyToManyField(TechniqueMitre, blank=True, related_name="templates")
    sources = models.ManyToManyField(SourceLog, through="TemplateSource", related_name="templates")
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class TemplateSource(models.Model):
    template = models.ForeignKey(Template, on_delete=models.CASCADE, related_name="template_sources")
    source = models.ForeignKey(SourceLog, on_delete=models.PROTECT, related_name="template_sources")
    obligatoire = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["template", "source"], name="template_source_unique")]
        ordering = ["source__ordre", "source__nom"]

    def __str__(self):
        return f"{self.template} ↔ {self.source}"


class _RattachementMixin(models.Model):
    """Syntaxe et RequeteHunting se rattachent soit à un Template, soit à une DetectionClient."""

    template = models.ForeignKey(Template, null=True, blank=True, on_delete=models.CASCADE, related_name="%(class)ss")
    detection_client = models.ForeignKey(
        "clients.DetectionClient", null=True, blank=True, on_delete=models.CASCADE, related_name="%(class)ss"
    )

    class Meta:
        abstract = True

    @property
    def proprietaire(self):
        return self.template or self.detection_client

    def proprietaire_label(self) -> str:
        """Code du propriétaire, sans lever d'erreur si celui-ci vient d'être supprimé (suppression en cascade)."""
        if self.template_id:
            return Template.objects.filter(pk=self.template_id).values_list("code", flat=True).first() or "template supprimé"
        from clients.models import DetectionClient

        row = DetectionClient.objects.filter(pk=self.detection_client_id).values_list("code", "client__nom").first()
        return f"{row[0]} chez {row[1]}" if row else "détection supprimée"

    def clean(self):
        if bool(self.template_id) == bool(self.detection_client_id):
            raise ValidationError("Rattacher à un template OU à une détection client.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class Syntaxe(_RattachementMixin):
    siem = models.ForeignKey(Siem, on_delete=models.PROTECT, related_name="syntaxes")
    contenu = models.TextField()
    champs_requis = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(template__isnull=False, detection_client__isnull=True)
                    | models.Q(template__isnull=True, detection_client__isnull=False)
                ),
                name="syntaxe_un_seul_rattachement",
            ),
            models.UniqueConstraint(fields=["template", "siem"], condition=models.Q(template__isnull=False), name="syntaxe_unique_template"),
            models.UniqueConstraint(fields=["detection_client", "siem"], condition=models.Q(detection_client__isnull=False), name="syntaxe_unique_client"),
        ]
        ordering = ["siem__ordre"]

    def __str__(self):
        return f"Règle {Siem.objects.filter(pk=self.siem_id).values_list('nom', flat=True).first() or self.siem_id} · {self.proprietaire_label()}"


class RequeteHunting(_RattachementMixin):
    siem = models.ForeignKey(Siem, on_delete=models.PROTECT, related_name="requetes_hunting")
    titre = models.CharField(max_length=200)
    objectif = models.TextField(blank=True)
    requete = models.TextField()
    periode_conseillee = models.CharField(max_length=40, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(template__isnull=False, detection_client__isnull=True)
                    | models.Q(template__isnull=True, detection_client__isnull=False)
                ),
                name="hunting_un_seul_rattachement",
            ),
        ]
        ordering = ["siem__ordre", "titre"]

    def __str__(self):
        return f"Hunting {self.titre}"


PARAM_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def render_parametres(texte: str, valeurs: dict) -> tuple[str, list[str]]:
    """Remplace {{nom}} par la valeur du client ; retourne (texte, noms non résolus)."""
    manquants: list[str] = []

    def repl(m):
        nom = m.group(1)
        if nom in valeurs and valeurs[nom] not in (None, ""):
            return str(valeurs[nom])
        if nom not in manquants:
            manquants.append(nom)
        return m.group(0)

    return PARAM_RE.sub(repl, texte or ""), manquants
