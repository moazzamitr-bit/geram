#!/bin/sh
# Server crontab entry (every 15 min):
#   */15 * * * * /opt/geram/deploy/run-cron.sh >> /var/log/geram-cron.log 2>&1
# Calls the app on this host; the secret is read from the env file, never logged.
set -eu
ENV_FILE="${GERAM_ENV_FILE:-/opt/geram/.env.production}"
SECRET=$(sed -n 's/^CRON_SECRET=//p' "$ENV_FILE" | tr -d '"\r' | head -n1)
[ -n "$SECRET" ] || { echo "$(date -u +%FT%TZ) CRON_SECRET missing"; exit 1; }
printf 'header = "Authorization: Bearer %s"\n' "$SECRET" | \
  curl -sS --max-time 120 --resolve geram.co:443:127.0.0.1 -K - \
    -o /tmp/geram-cron.json -w "$(date -u +%FT%TZ) %{http_code} " \
    https://geram.co/api/cron/revenue
head -c 400 /tmp/geram-cron.json; echo
