"""Isolation des clients : un utilisateur sans habilitation reçoit un refus partout, y compris par URL directe."""
import pytest

from clients.models import DetectionClient, PreuveTest
from tests.conftest import api


@pytest.fixture
def det_a(world):
    return DetectionClient.objects.get(client=world.a, code="DET-001")


def client_urls(c, d):
    return [
        ("get", f"/api/clients/{c.pk}"),
        ("patch", f"/api/clients/{c.pk}"),
        ("delete", f"/api/clients/{c.pk}"),
        ("get", f"/api/clients/{c.pk}/sources"),
        ("put", f"/api/clients/{c.pk}/sources"),
        ("post", f"/api/clients/{c.pk}/sources/1/ajouter"),
        ("get", f"/api/clients/{c.pk}/detections"),
        ("post", f"/api/clients/{c.pk}/detections"),
        ("post", f"/api/clients/{c.pk}/detections/groupe"),
        ("get", f"/api/clients/{c.pk}/bibliotheque"),
        ("get", f"/api/clients/{c.pk}/dashboard"),
        ("get", f"/api/clients/{c.pk}/couverture"),
        ("get", f"/api/clients/{c.pk}/audit"),
        ("get", f"/api/clients/{c.pk}/habilitations"),
        ("get", f"/api/clients/{c.pk}/export.xlsx"),
        ("get", f"/api/clients/{c.pk}/export.csv"),
        ("get", f"/api/clients/{c.pk}/export.navigator.json"),
        ("get", f"/api/detections/{d.pk}"),
        ("patch", f"/api/detections/{d.pk}"),
        ("delete", f"/api/detections/{d.pk}"),
        ("post", f"/api/detections/{d.pk}/reinitialiser"),
        ("put", f"/api/detections/{d.pk}/syntaxes/wazuh"),
        ("post", f"/api/detections/{d.pk}/hunting"),
        ("post", f"/api/detections/{d.pk}/preuves"),
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("who", ["nobody", "user_b", "catalogue"])
def test_no_access_to_other_client_anywhere(world, det_a, who):
    user = getattr(world, who)
    c = api(user)
    for method, url in client_urls(world.a, det_a):
        r = getattr(c, method)(url, {}, format="json")
        assert r.status_code in (403, 404), f"{who} {method} {url} -> {r.status_code}"
        assert r.status_code != 200


@pytest.mark.django_db
def test_anonymous_refused(world, det_a):
    c = api()
    for method, url in client_urls(world.a, det_a):
        assert getattr(c, method)(url).status_code in (401, 403)


@pytest.mark.django_db
def test_client_list_is_filtered(world):
    ids = lambda u: {c["id"] for c in api(u).get("/api/clients").json()}
    assert ids(world.valideur) == {world.a.pk}
    assert ids(world.user_b) == {world.b.pk}
    assert ids(world.nobody) == set()
    assert ids(world.catalogue) == set()
    assert ids(world.admin) == {world.a.pk, world.b.pk}


@pytest.mark.django_db
def test_nothing_was_changed_by_refused_requests(world, det_a):
    before = (DetectionClient.objects.count(), det_a.statut, det_a.cas_usage)
    for who in (world.nobody, world.user_b, world.catalogue):
        c = api(who)
        for method, url in client_urls(world.a, det_a):
            if method in ("patch", "put", "delete", "post"):
                getattr(c, method)(url, {"statut": "deployee", "cas_usage": "piraté", "confirmation": world.a.nom}, format="json")
    det_a.refresh_from_db()
    assert (DetectionClient.objects.count(), det_a.statut, det_a.cas_usage) == before


@pytest.mark.django_db
def test_capture_download_isolated(world, det_a, tmp_path, settings):
    from django.core.files.uploadedfile import SimpleUploadedFile

    settings.MEDIA_ROOT = tmp_path
    p = PreuveTest.objects.create(detection=det_a, date=det_a.cree_le, resultat="reussi", auteur=world.contrib,
                                  capture=SimpleUploadedFile("preuve.txt", b"log"))
    assert api(world.lecteur).get(f"/api/preuves/{p.pk}/capture").status_code == 200
    assert api(world.user_b).get(f"/api/preuves/{p.pk}/capture").status_code == 404
    assert api(world.nobody).get(f"/api/preuves/{p.pk}/capture").status_code == 404


@pytest.mark.django_db
def test_catalogue_manager_sees_only_counts(world, det_a):
    r = api(world.catalogue).get("/api/templates?q=DET-001").json()
    row = next(t for t in r if t["code"] == "DET-001")
    assert row["nb_clients"] == 2  # nombre seulement : jamais les noms des clients
    assert "Client A" not in str(r)
    # un lecteur ne reçoit pas le décompte
    row = next(t for t in api(world.lecteur).get("/api/templates?q=DET-001").json() if t["code"] == "DET-001")
    assert "nb_clients" not in row


@pytest.mark.django_db
def test_inactive_client_hidden_from_members(world):
    world.a.actif = False
    world.a.save()
    assert api(world.valideur).get(f"/api/clients/{world.a.pk}").status_code == 404
    assert api(world.admin).get(f"/api/clients/{world.a.pk}").status_code == 200


@pytest.mark.django_db
def test_only_platform_admin_creates_client(world):
    payload = {"nom": "Nouveau", "siems": ["wazuh"]}
    assert api(world.adminclient).post("/api/clients", payload, format="json").status_code == 403
    assert api(world.catalogue).post("/api/clients", payload, format="json").status_code == 403
    r = api(world.admin).post("/api/clients", payload, format="json")
    assert r.status_code == 201
    assert api(world.admin).get(f"/api/clients/{r.json()['id']}/sources").json().__len__() == 28
    assert r.json()["nb_detections"] == 82  # tous les domaines cochés par défaut


@pytest.mark.django_db
def test_habilitation_management_scoped(world):
    # un Admin client gère son client, pas les autres
    r = api(world.adminclient).post(f"/api/clients/{world.a.pk}/habilitations", {"utilisateur_id": world.nobody.pk, "role": "lecteur"}, format="json")
    assert r.status_code == 201
    r = api(world.adminclient).post(f"/api/clients/{world.b.pk}/habilitations", {"utilisateur_id": world.nobody.pk, "role": "lecteur"}, format="json")
    assert r.status_code == 404
    # un Valideur ne gère pas les habilitations
    r = api(world.valideur).post(f"/api/clients/{world.a.pk}/habilitations", {"utilisateur_id": world.nobody.pk, "role": "lecteur"}, format="json")
    assert r.status_code == 403
    # pas d'auto-modification
    hab = world.adminclient.habilitations.get()
    assert api(world.adminclient).patch(f"/api/habilitations/{hab.pk}", {"role": "lecteur"}, format="json").status_code == 400
    # habilitation d'un autre client inaccessible
    hab_b = world.user_b.habilitations.get()
    assert api(world.adminclient).patch(f"/api/habilitations/{hab_b.pk}", {"role": "lecteur"}, format="json").status_code == 404


@pytest.mark.django_db
def test_user_admin_only_platform_admin(world):
    assert api(world.adminclient).get("/api/users").status_code == 403
    assert api(world.admin).get("/api/users").status_code == 200
