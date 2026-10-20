import secrets

from django.core.management.base import BaseCommand

from accounts.models import Habilitation, RoleClient, RoleGlobal, User
from catalog.models import Domaine, Siem
from clients.models import Client, ClientSource, StatutSource
from clients.services import detections as svc


class Command(BaseCommand):
    help = "Données de démonstration (développement uniquement) : utilisateurs, et avec --avec-client un client pilote."

    def add_arguments(self, parser):
        parser.add_argument("--avec-client", action="store_true", help="Crée aussi « Client Pilote » (sinon, la plateforme démarre sans client).")

    def handle(self, **opts):
        creds = []

        def user(username, nom, role_global=""):
            u, created = User.objects.get_or_create(username=username, defaults={"first_name": nom, "role_global": role_global, "email": f"{username}@soc-ucf.local"})
            if created:
                pwd = secrets.token_urlsafe(12)
                u.set_password(pwd)
                u.is_staff = role_global == RoleGlobal.ADMIN_PLATEFORME
                u.save()
                creds.append((username, pwd, role_global or "-"))
            return u

        user("admin", "Admin Plateforme", RoleGlobal.ADMIN_PLATEFORME)
        user("catalogue", "Resp. Catalogue", RoleGlobal.RESPONSABLE_CATALOGUE)
        users = {r: user(r, r.capitalize()) for r in ("adminclient", "valideur", "contributeur", "lecteur")}

        if opts.get("avec_client"):
            client, created = Client.objects.get_or_create(nom="Client Pilote", defaults={"secteur": "Industrie"})
            if created:
                client.siems.set(Siem.objects.filter(code__in=["wazuh", "sentinel"]))
                client.domaines.set(Domaine.objects.all())
                svc.initialiser_sources(client)
                for nom in ("AD – contrôleurs de domaine", "Windows – journal Security", "Windows – Sysmon", "SSO / fournisseur d'identité", "EDR / antivirus"):
                    ClientSource.objects.filter(client=client, source__nom=nom).update(statut=StatutSource.COLLECTEE)
                svc.synchroniser(client, users["contributeur"])
                for name, role in (("adminclient", RoleClient.ADMIN_CLIENT), ("valideur", RoleClient.VALIDEUR), ("contributeur", RoleClient.CONTRIBUTEUR), ("lecteur", RoleClient.LECTEUR)):
                    Habilitation.objects.get_or_create(utilisateur=users[name], client=client, defaults={"role": role})
        if creds:
            self.stdout.write("Comptes créés (mots de passe affichés une seule fois) :")
            for u, p, r in creds:
                self.stdout.write(f"  {u:14} {p:18} {r}")
