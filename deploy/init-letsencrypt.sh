#!/bin/sh
set -eu

if [ ! -f .env ]; then
  echo "Missing .env. Copy deploy/.env.production.example to .env and fill secrets first." >&2
  exit 1
fi

set -a
. ./.env
set +a

DOMAIN="${DOMAIN:-crm.qoima.com.kz}"
EMAIL="${CERTBOT_EMAIL:-${DJANGO_SUPERUSER_EMAIL:-}}"
STAGING="${CERTBOT_STAGING:-0}"
RSA_KEY_SIZE="${CERTBOT_RSA_KEY_SIZE:-4096}"

if [ -z "$EMAIL" ]; then
  echo "CERTBOT_EMAIL is required in .env" >&2
  exit 1
fi

if docker compose --env-file .env --profile certbot run --rm --entrypoint sh certbot -c "\
  test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem && \
  test -f /etc/letsencrypt/live/$DOMAIN/privkey.pem"; then
  echo "Certificate for $DOMAIN already exists. Checking renewal..."
  docker compose --env-file .env --profile certbot run --rm certbot renew \
    --webroot \
    --webroot-path /var/www/certbot
  docker compose --env-file .env exec nginx nginx -s reload || true
  exit 0
fi

echo "Creating temporary certificate for $DOMAIN..."
docker compose --env-file .env --profile certbot run --rm --entrypoint sh certbot -c "\
  mkdir -p /etc/letsencrypt/live/$DOMAIN && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost'"

echo "Starting nginx..."
docker compose --env-file .env up -d --build nginx

echo "Removing temporary certificate..."
docker compose --env-file .env --profile certbot run --rm --entrypoint sh certbot -c "\
  rm -rf /etc/letsencrypt/live/$DOMAIN && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -f /etc/letsencrypt/renewal/$DOMAIN.conf"

staging_arg=""
if [ "$STAGING" = "1" ]; then
  staging_arg="--staging"
fi

echo "Requesting Let's Encrypt certificate for $DOMAIN..."
docker compose --env-file .env --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  $staging_arg \
  --email "$EMAIL" \
  --rsa-key-size "$RSA_KEY_SIZE" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN"

echo "Reloading nginx with real certificate..."
docker compose --env-file .env up -d --build nginx
docker compose --env-file .env exec nginx nginx -s reload

echo "HTTPS is ready for https://$DOMAIN"
