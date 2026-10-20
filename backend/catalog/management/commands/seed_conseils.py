from django.core.management.base import BaseCommand

from catalog.content import CONSEILS
from catalog.models import Template
from clients.models import DetectionClient

CHAMPS = ("exclusions", "recommandation", "impact")


class Command(BaseCommand):
    help = (
        "Renseigne exclusions, recommandation et impact des templates (et des détections clients qui en sont issues) "
        "quand ces champs sont vides. Ne remplace jamais un texte déjà saisi."
    )

    def handle(self, **opts):
        templates = detections = 0
        for code, textes in CONSEILS.items():
            t = Template.objects.filter(code=code).first()
            if t is None:
                continue
            vides = [c for c in CHAMPS if not getattr(t, c).strip()]
            if vides:
                for c in vides:
                    setattr(t, c, textes[c])
                t.save()
                templates += 1
            for d in DetectionClient.objects.filter(template=t):
                vides_d = [c for c in CHAMPS if not getattr(d, c).strip()]
                if vides_d:
                    for c in vides_d:
                        setattr(d, c, textes[c])
                    d.save()
                    detections += 1
        self.stdout.write(f"{templates} template(s) et {detections} détection(s) client complétés.")
