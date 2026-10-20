from django.core.management.base import BaseCommand, CommandError

from catalog.examples import EXCLUSIONS_DET001, HUNTING_SENTINEL, IMPACT_DET001, PARAMS_DET001, RECOMMANDATION_DET001, SYNTAXES_DET001
from catalog.models import RequeteHunting, Siem, Syntaxe, Template
from catalog.services.referentiels import ensure_siems

class Command(BaseCommand):
    help = "Ajoute à DET-001 les règles des plateformes d'exemple, la requête de hunting et les textes exclusions / recommandation / impact."

    def handle(self, **opts):
        ensure_siems()
        t = Template.objects.filter(code="DET-001").first()
        if t is None:
            raise CommandError("DET-001 absent : importez d'abord le catalogue.")
        if t.syntaxes.exists():
            self.stdout.write("DET-001 a déjà des règles : rien à faire.")
            return
        t.parametres_defaut = PARAMS_DET001
        t.exclusions, t.recommandation, t.impact = EXCLUSIONS_DET001, RECOMMANDATION_DET001, IMPACT_DET001
        t.save()
        for code, (contenu, champs, notes) in SYNTAXES_DET001.items():
            Syntaxe.objects.create(template=t, siem=Siem.objects.get(code=code), contenu=contenu, champs_requis=champs, notes=notes)
        RequeteHunting.objects.create(
            template=t, siem=Siem.objects.get(code="sentinel"), titre="Échecs puis succès sur 7 jours",
            objectif="Comptes ayant subi beaucoup d'échecs puis un succès, sans la contrainte des 10 min.",
            requete=HUNTING_SENTINEL, periode_conseillee="7 jours",
        )
        self.stdout.write("DET-001 : règles, hunting, exclusions, recommandation et impact ajoutés.")
