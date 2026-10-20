from pathlib import Path

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import Habilitation, RoleClient, RoleGlobal, User
from catalog.models import Domaine, Siem, SourceLog
from clients.models import Client, ClientSource, StatutSource
from clients.services import detections as svc

XLSX = Path(__file__).resolve().parent.parent / "data" / "Catalogue_Detection_Generique_v1.0.xlsx"


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Catalogue v1.0 importé une fois pour toute la session de tests (82 templates)."""
    with django_db_blocker.unblock():
        call_command("import_catalogue", str(XLSX))
        call_command("seed_examples")


def make_user(username, role_global=""):
    return User.objects.create_user(username=username, password="x" * 16, role_global=role_global, email=f"{username}@t.local")


def make_client(nom, collectees=None, domaines=("Identité & AD", "Poste & serveur Windows"), siems=("wazuh", "sentinel")):
    c = Client.objects.create(nom=nom)
    c.siems.set(Siem.objects.filter(code__in=siems))
    c.domaines.set(Domaine.objects.filter(nom__in=domaines))
    collectees = set(collectees or [])
    for s in SourceLog.objects.all():
        ClientSource.objects.create(client=c, source=s, statut=StatutSource.COLLECTEE if s.nom in collectees else StatutSource.A_ACTIVER)
    svc.synchroniser(c, None)
    return c


def api(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user=user)
    return client


@pytest.fixture
def world(db):
    """Deux clients étanches, un utilisateur de chaque rôle chez A, un utilisateur chez B seulement."""
    sources = ["AD – contrôleurs de domaine", "Windows – journal Security", "SSO / fournisseur d'identité", "VPN / accès distant", "Windows – Sysmon"]
    a = make_client("Client A", sources)
    b = make_client("Client B", sources)
    w = type("World", (), {})()
    w.a, w.b = a, b
    w.admin = make_user("admin_p", RoleGlobal.ADMIN_PLATEFORME)
    w.catalogue = make_user("resp_cat", RoleGlobal.RESPONSABLE_CATALOGUE)
    w.adminclient = make_user("admin_a")
    w.valideur = make_user("valideur_a")
    w.valideur2 = make_user("valideur2_a")
    w.contrib = make_user("contrib_a")
    w.lecteur = make_user("lecteur_a")
    w.user_b = make_user("user_b")
    w.nobody = make_user("nobody")
    for u, role in ((w.adminclient, RoleClient.ADMIN_CLIENT), (w.valideur, RoleClient.VALIDEUR), (w.valideur2, RoleClient.VALIDEUR),
                    (w.contrib, RoleClient.CONTRIBUTEUR), (w.lecteur, RoleClient.LECTEUR)):
        Habilitation.objects.create(utilisateur=u, client=a, role=role)
    Habilitation.objects.create(utilisateur=w.user_b, client=b, role=RoleClient.ADMIN_CLIENT)
    return w
