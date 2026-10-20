#!/bin/sh
# Certificat auto-signé pour essai local. En production, déposer le certificat de l'organisation dans nginx/certs/.
set -e
mkdir -p "$(dirname "$0")/../nginx/certs"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=${1:-localhost}" \
  -keyout "$(dirname "$0")/../nginx/certs/privkey.pem" -out "$(dirname "$0")/../nginx/certs/fullchain.pem"
