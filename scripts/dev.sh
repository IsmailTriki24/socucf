#!/bin/sh
# Django sur 127.0.0.1:8100 et Next.js sur http://localhost:3100 (les ports 3000 et 8000 sont souvent déjà pris).
cd "$(dirname "$0")/.."
trap 'kill 0' INT TERM EXIT
( cd backend && .venv/bin/python manage.py runserver 127.0.0.1:8100 ) &
( cd frontend && BACKEND_URL=http://127.0.0.1:8100 npx next dev -p 3100 ) &
wait
