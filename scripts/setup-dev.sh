#!/bin/sh
# Installation locale (SQLite) : venv Python, dépendances, base, catalogue v1.0, ATT&CK 19.2, données de démonstration.
set -e
cd "$(dirname "$0")/.."
( cd backend
  [ -d .venv ] || python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
  .venv/bin/python manage.py migrate --noinput
  .venv/bin/python manage.py import_catalogue data/Catalogue_Detection_Generique_v1.0.xlsx > /dev/null
  .venv/bin/python manage.py import_attack --download > /dev/null || echo "ATT&CK non chargé (réseau ?) : relancer manage.py import_attack --download"
  .venv/bin/python manage.py seed_examples
  .venv/bin/python manage.py seed_conseils
  .venv/bin/python manage.py seed_demo )  # comptes seulement : la plateforme démarre sans client (ajouter --avec-client pour un client pilote)
( cd frontend && npm install --no-audit --no-fund )
echo "Terminé. Lancer : ./scripts/dev.sh"
