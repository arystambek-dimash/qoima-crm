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
DEPLOY_PATH=/opt/qoima-crm
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
cd /opt/qoima-crm
cp deploy/.env.production.example .env
# edit .env
docker compose --env-file .env up -d --build
```
