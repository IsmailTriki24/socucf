import json
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalog.services.attack import import_bundle

URL = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-{v}.json"


class Command(BaseCommand):
    help = "Charge le référentiel ATT&CK Enterprise depuis un bundle STIX (fichier local ou --download)."

    def add_arguments(self, parser):
        parser.add_argument("fichier", nargs="?")
        parser.add_argument("--download", action="store_true", help="Télécharge la version ATTACK_VERSION depuis GitHub")

    def handle(self, fichier, download, **opts):
        if download:
            url = URL.format(v=settings.ATTACK_VERSION)
            self.stdout.write(f"Téléchargement {url}")
            with urllib.request.urlopen(url, timeout=120) as r:  # noqa: S310 - URL fixe https
                data = json.load(r)
        elif fichier:
            with open(fichier, encoding="utf-8") as f:
                data = json.load(f)
        else:
            raise CommandError("Indiquez un fichier STIX ou --download.")
        report = import_bundle(data)
        self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
