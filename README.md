# SOC UCF

Application web de l'**UC Factory SOC** : une bibliothèque de templates de détection (82 au départ, issus du catalogue Excel v1.0), copiée pour chaque client, que le SOC adapte, teste et fait avancer jusqu'au déploiement dans son SIEM ou son XDR.

Spécification d'origine : `UC_Factory_SOC_Plan_de_developpement.md` · Données sources : `Catalogue_Detection_Generique_v1.0.xlsx`.

**Stack** : Django 5.2 LTS + Django REST Framework (API), Next.js 15 / React 19 (interface), PostgreSQL 16 (SQLite en développement local), Nginx (TLS). Interface : Tailwind CSS 4, Radix UI, lucide, cmdk (Ctrl K), sonner, dnd-kit (tableau), react-zoom-pan-pinch (matrice ATT&CK), CodeMirror 6 (règles). Tout est open source. Authentification par session Django ; SSO OpenID Connect optionnel.

## Démarrage local

```sh
./scripts/setup-dev.sh   # venv, base SQLite, catalogue, ATT&CK 19.2, comptes de démonstration (mots de passe affichés une fois)
./scripts/dev.sh         # Django :8100 + Next.js :3100  ->  http://localhost:3100
```

La plateforme démarre **sans client** : à la première connexion, tout renvoie vers l'assistant « Commencez par votre premier client ». Pour un client de démonstration : `cd backend && .venv/bin/python manage.py seed_demo --avec-client`.

Comptes de démonstration : `admin` (Administrateur plateforme), `catalogue` (Responsable catalogue), `adminclient`, `valideur`, `contributeur`, `lecteur`.

Tests : `cd backend && .venv/bin/python -m pytest` (SQLite) ou `DATABASE_URL=postgres://… pytest`. Frontend : `cd frontend && npx tsc --noEmit && npx next build`.

## Production (Docker)

```sh
cp .env.example .env            # renseigner POSTGRES_PASSWORD, DJANGO_SECRET_KEY, PUBLIC_HOST
./scripts/make-dev-certs.sh     # essai local ; en production : déposer fullchain.pem / privkey.pem dans nginx/certs/
docker compose up -d --build
docker compose exec backend python manage.py import_catalogue data/Catalogue_Detection_Generique_v1.0.xlsx
docker compose exec backend python manage.py import_attack --download
docker compose exec backend python manage.py createsuperuser     # Administrateur plateforme (compte de secours)
```

Services : `nginx` (TLS, `/api` vers Django, le reste vers Next.js), `backend` (Gunicorn), `frontend`, `db` (PostgreSQL), `backup` (pg_dump quotidien dans `./backups`, 14 jours).

**SSO** : renseigner les variables `OIDC_*` du `.env`. Le MFA est porté par l'IdP ; la connexion locale n'est alors acceptée que pour l'Administrateur plateforme. Les comptes créés par SSO n'ont aucun droit tant qu'un administrateur ne leur a pas attribué un rôle global ou un accès à un client.

## Comment ça marche

1. **Créer un client (obligatoire)**. Tant qu'aucun client n'existe, seul l'assistant de création est accessible, le reste du menu est verrouillé. Quatre étapes : nom et secteur, plateformes SIEM / XDR, domaines (**tous cochés par défaut**), vérification.
2. **Les détections du client**. À la création, chaque template des domaines choisis est **copié** chez le client en « Brouillon », avec les règles des plateformes choisies. Cette copie est entièrement modifiable sans toucher à la bibliothèque. Page *Détections* : tableau Kanban (glisser-déposer entre statuts) ou cartes, filtres (domaine, gravité, type, statut, tactique ATT&CK, journalisation, règle présente), actions groupées.
3. **Statut** (choisi librement, sans règle de passage) : Brouillon, En test, À revoir, Validé, Déployé. **Journalisation** : OK ou Non, réglable à la main, et qui passe à OK d'elle-même quand les sources de logs requises sont ajoutées.
4. **Une détection** : cas d'usage, domaine, gravité, type, logs à collecter, logique, **exclusions, recommandation, impact**, paramètres `{{seuil}}`, listes de référence, règle par plateforme (éditeur de code), hunting, sources de logs, techniques ATT&CK, tests.
5. **Sources de logs** : bouton **Ajouter** (tableau de bord et onglet « Journalisation et sources ») : affiche ce qu'il faut activer, marque la source comme ajoutée et passe les détections concernées en journalisation OK.
6. **Couverture ATT&CK** : matrice dans un cadre zoomable (molette, boutons, plein écran, mini-carte), colorée par nombre de détections ou par statut, au choix des statuts comptés (par défaut : Déployé).
7. **Bibliothèque** (*Templates*) : mêmes champs que les détections, avec filtres, création, duplication, suppression. Un template supprimé ne touche pas les détections déjà copiées chez les clients.
8. **Exports** par client : Excel (format du catalogue + colonnes client), CSV, layer ATT&CK Navigator.

### Plateformes prises en charge (modifiables dans *Plateformes et sources*)

SIEM : Wazuh, Splunk (Cisco), Microsoft Sentinel / Defender XDR, Elastic Security, IBM QRadar, FortiSIEM, Google SecOps, CrowdStrike Falcon Next-Gen SIEM, Sekoia.io, Sumo Logic, Rapid7 InsightIDR, Graylog, Exabeam, OpenText ArcSight, Logpoint, Securonix, Datadog Cloud SIEM. XDR / plateformes SOC : Cortex XDR / XSIAM, Trend Vision One, Cisco XDR, SentinelOne Singularity. Réseau : Cisco Secure Network Analytics. Format générique : Sigma.

Toutes ne sont pas des « SIEM » au sens strict, d'où les familles. Seules les cinq premières plateformes et les règles de DET-001 viennent du plan ; les langages de règles des autres sont des repères à confirmer sur votre version du produit.

## Décisions prises

- **Plus de versions de template** : un template est un objet unique, modifiable. Plus de brouillon / publication / comparaison / « nouvelle version disponible ».
- **Plus de double validation, de preuve de test obligatoire ni de revue automatique J+14** : le statut se change librement. Les tests restent consignables (onglet Tests), sans bloquer. La commande `refresh_reviews` et le service `reviews` de Docker ont disparu.
- **Retrait → suppression** : supprimer une détection ou un client est définitif (journal d'audit conservé). Un client ne se supprime qu'en saisissant son nom.
- **Périmètre et Proposition supprimés**. Les plateformes et domaines se règlent dans *Paramètres* du client ; la décision « applicable / bloqué » est remplacée par la journalisation OK / Non de chaque détection. Les statuts de sources du client (Collectée / À activer) restent derrière le bouton **Ajouter**.
- **Habilitations** : l'onglet par client a disparu, la gestion des accès est dans *Utilisateurs et accès* (Admin client pour ses clients, Administrateur plateforme pour tous). Le cloisonnement des clients est inchangé.
- **Isolation** : toute lecture de données client passe par `Client.objects.visible_to(user)` ou `get_client_or_404` ; un client hors périmètre renvoie 404, des droits insuffisants 403. `test_isolation.py` vérifie une vingtaine de routes pour un utilisateur sans accès, un utilisateur d'un autre client, le Responsable catalogue et un visiteur anonyme.
- **Rôles** : Admin client, Valideur et Contributeur modifient les détections ; Lecteur lit et exporte. Seuls l'Administrateur plateforme (client) et le Responsable catalogue (bibliothèque, référentiels, imports) créent et modifient ces objets.
- **Journal d'audit** : chaque écriture est tracée (qui, quand, avant / après), en ajout seul.
- **Réimport Excel** : un import réel écrase le contenu des templates existants avec celui du fichier (utilisez la simulation d'abord).
- **Techniques ATT&CK inconnues** : l'import garde le lien et marque la technique « non vérifiée ».
- **Migration depuis la v1** : les migrations `catalog 0003-0005` et `clients 0002-0004` conservent les données (contenu de la version courante copié dans le template, détections clients rendues autonomes, statut « Retirée » supprimé). Faites une sauvegarde avant de migrer une base existante.

## Limites connues

- Le SSO OIDC est configuré mais n'a pas pu être éprouvé contre un fournisseur d'identité réel.
- Pas de déploiement automatique dans les SIEM ni de génération depuis Sigma.
- Seul DET-001 porte des exemples de règles (5 plateformes) ; les autres templates attendent d'être rédigés.
- Exclusions, recommandation et impact sont renseignés pour les 82 templates (`manage.py seed_conseils`, sources dans `backend/catalog/content/`). Ce sont des textes de départ : les exclusions décrivent des familles de faux positifs, à remplacer par les comptes, hôtes et outils réels de chaque client. La commande ne remplit que les champs vides.
- Les paramètres par défaut (`seuil`, `fenetre`…) ne sont pas extraits automatiquement des textes de logique.
