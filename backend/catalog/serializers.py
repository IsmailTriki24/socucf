from rest_framework import serializers

from .models import (
    AideEntree,
    Domaine,
    GuideTraduction,
    RequeteHunting,
    Siem,
    SourceLog,
    Syntaxe,
    TechniqueMitre,
    Template,
)
from .services.contenu import technique_payload


class DomaineSerializer(serializers.ModelSerializer):
    nb_templates = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Domaine
        fields = ["id", "nom", "ordre", "nb_templates"]


class SourceLogSerializer(serializers.ModelSerializer):
    nb_cas_usage = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = SourceLog
        fields = ["id", "nom", "a_activer", "evenements_cles", "piege", "ordre", "nb_cas_usage"]


class SiemSerializer(serializers.ModelSerializer):
    nb_clients = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Siem
        fields = ["id", "code", "nom", "categorie", "langage_regle", "langage_hunting", "mode_editeur", "ordre", "nb_clients"]


class GuideSerializer(serializers.ModelSerializer):
    siem = serializers.SlugRelatedField(slug_field="code", read_only=True)

    class Meta:
        model = GuideTraduction
        fields = ["notion", "siem", "texte", "ordre"]


class AideSerializer(serializers.ModelSerializer):
    class Meta:
        model = AideEntree
        fields = ["section", "titre", "texte", "ordre"]


class TechniqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = TechniqueMitre
        fields = ["id", "identifiant", "nom", "tactiques", "obsolete", "revoquee", "remplacee_par", "verifiee", "version_attack"]


class SyntaxeSerializer(serializers.ModelSerializer):
    siem = serializers.SlugRelatedField(slug_field="code", queryset=Siem.objects.all())

    class Meta:
        model = Syntaxe
        fields = ["id", "siem", "contenu", "champs_requis", "notes"]


class HuntingSerializer(serializers.ModelSerializer):
    siem = serializers.SlugRelatedField(slug_field="code", queryset=Siem.objects.all())

    class Meta:
        model = RequeteHunting
        fields = ["id", "siem", "titre", "objectif", "requete", "periode_conseillee"]


class ContenuWriteSerializer(serializers.Serializer):
    """Champs de contenu acceptés à l'écriture (template ou détection client) ; tous facultatifs."""

    cas_usage = serializers.CharField(max_length=300, required=False)
    type_detection = serializers.ChoiceField(choices=["Simple", "Seuil", "Corrélation"], required=False)
    gravite = serializers.ChoiceField(choices=["Critique", "Haute", "Moyenne", "Basse"], required=False)
    domaine_id = serializers.IntegerField(required=False)
    detections_similaires = serializers.CharField(allow_blank=True, max_length=500, required=False)
    logs_a_collecter = serializers.CharField(allow_blank=True, required=False)
    logique = serializers.CharField(allow_blank=True, required=False)
    exclusions = serializers.CharField(allow_blank=True, required=False)
    recommandation = serializers.CharField(allow_blank=True, required=False)
    impact = serializers.CharField(allow_blank=True, required=False)
    parametres = serializers.DictField(required=False)
    parametres_defaut = serializers.DictField(required=False)
    sources = serializers.ListField(child=serializers.DictField(), required=False)
    techniques = serializers.ListField(child=serializers.CharField(), required=False)


def template_payload(t: Template, *, with_rules: bool = True) -> dict:
    out = {
        "code": t.code, "domaine": t.domaine.nom, "domaine_id": t.domaine_id,
        "cas_usage": t.cas_usage, "type_detection": t.type_detection, "gravite": t.gravite,
        "detections_similaires": t.detections_similaires, "logs_a_collecter": t.logs_a_collecter, "logique": t.logique, "parametres_defaut": t.parametres_defaut,
        "exclusions": t.exclusions, "recommandation": t.recommandation, "impact": t.impact,
        "sources": [{"source_id": ts.source_id, "nom": ts.source.nom, "obligatoire": ts.obligatoire,
                     "a_activer": ts.source.a_activer, "evenements_cles": ts.source.evenements_cles, "piege": ts.source.piege}
                    for ts in t.template_sources.all()],
        "techniques": [technique_payload(x) for x in t.techniques.all()],
        "modifie_le": t.modifie_le,
    }
    if with_rules:
        out["syntaxes"] = SyntaxeSerializer(t.syntaxes.all(), many=True).data
        out["hunting"] = HuntingSerializer(t.requetehuntings.all(), many=True).data
    return out


def template_list_item(t: Template, *, nb_clients: dict | None = None) -> dict:
    tech = list(t.techniques.all())
    out = {
        "code": t.code, "domaine": t.domaine.nom, "domaine_id": t.domaine_id, "cas_usage": t.cas_usage,
        "type_detection": t.type_detection, "gravite": t.gravite,
        "sources": [ts.source.nom for ts in t.template_sources.all()],
        "techniques": [x.identifiant for x in tech],
        "tactiques": sorted({tac for x in tech for tac in x.tactiques}),
        "siems_regle": sorted({s.siem.code for s in t.syntaxes.all()}),
        "nb_hunting": len(t.requetehuntings.all()),
        "a_exclusions": bool(t.exclusions.strip()), "a_recommandation": bool(t.recommandation.strip()), "a_impact": bool(t.impact.strip()),
    }
    if nb_clients is not None:
        out["nb_clients"] = nb_clients.get(t.pk, 0)
    return out
