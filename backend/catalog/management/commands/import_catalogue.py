import json

from django.core.management.base import BaseCommand, CommandError

from catalog.services.importer import ImportError_, import_workbook


class Command(BaseCommand):
    help = "Importe le catalogue Excel (Detections, Sources_logs, Lisez-moi). --dry-run simule sans écrire."

    def add_arguments(self, parser):
        parser.add_argument("fichier")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, fichier, dry_run, **opts):
        try:
            with open(fichier, "rb") as f:
                report = import_workbook(f, fichier.rsplit("/", 1)[-1], dry_run=dry_run)
        except (ImportError_, OSError) as exc:
            raise CommandError(str(exc))
        self.stdout.write(json.dumps({k: v for k, v in report.items() if k != "lignes"}, ensure_ascii=False, indent=2))
