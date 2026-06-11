# Qoima Deploy

This deployment uses one server, Docker Compose, and nginx.

## GitHub Secrets

Create these secrets in GitHub repository settings:

```text
DEPLOY_HOST=your-server-ip
DEPLOY_USER=ubuntu
DEPLOY_SSH_KEY=private SSH key for the ubuntu user
PRODUCTION_ENV_FILE=full contents of the production .env file
```

Do not store server passwords or production passwords in git.

## GitHub Variables

Optional repository variable:

```text
DEPLOY_PATH=/home/ubuntu/projects/qoima-crm
```

## Production .env

Use `deploy/.env.production.example` as the template for `PRODUCTION_ENV_FILE`.

Required superuser values:

```text
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_PASSWORD=strong-password
```

The deploy workflow runs:

```bash
docker compose --env-file .env up -d --build
docker compose --env-file .env exec -T backend python manage.py ensure_superuser
docker compose --env-file .env restart backend frontend nginx
```

## Manual Deploy On Server

```bash
cd /home/ubuntu/projects/qoima-crm
cp deploy/.env.production.example .env
# edit .env
docker compose --env-file .env up -d --build
```

## HTTPS Setup

The production domain is `crm.qoima.com.kz`. Its DNS A record must point to
`185.22.67.18`, and ports `80` and `443` must be open on the server.

On the first deployment, issue the Let's Encrypt certificate:

```bash
cd /home/ubuntu/projects/qoima-crm
chmod +x deploy/init-letsencrypt.sh
./deploy/init-letsencrypt.sh
```

After the first certificate is issued, normal deploys can use:

```bash
docker compose --env-file .env up -d --build
```

Renew certificates periodically with:

```bash
./deploy/init-letsencrypt.sh
```
