#!/usr/bin/env bash
# One-command install of Geram on a fresh or reused Ubuntu/Debian server.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/moazzamitr-bit/geram/main/deploy/install.sh)
#
# What it does:
#   1. Backs up the old website (/var/www, nginx/apache configs, docker volumes)
#      to /root/old-site-backup-<date>.tar.gz, then stops and removes it.
#   2. Installs Docker (with an Iranian registry mirror fallback).
#   3. Clones Geram to /opt/geram, asks for the Supabase keys, generates secrets.
#   4. Builds and starts the app behind Caddy with automatic HTTPS.
#   5. Installs the daily cron job.
# Re-running it updates the app to the latest code and keeps the saved settings.
set -euo pipefail

REPO="${GERAM_REPO:-https://github.com/moazzamitr-bit/geram.git}"
BRANCH="${GERAM_BRANCH:-main}"
APP_DIR=/opt/geram
ENV_FILE=$APP_DIR/.env.production
DOMAIN_DEFAULT=geram.co

say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m    %s\033[0m\n' "$*"; }
warn() { printf '\033[1;31m    %s\033[0m\n' "$*"; }
ask()  { local __v; read -r -p "$1" __v </dev/tty; printf '%s' "$__v"; }
ask_secret() { local __v; read -r -s -p "$1" __v </dev/tty; echo >&2; printf '%s' "$__v"; }
rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "${1:-40}"; }

[ "$(id -u)" -eq 0 ] || { warn "Run as root."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- 1. old site
if [ ! -f "$APP_DIR/.installed" ]; then
  say "Backing up and removing the previous website"
  BACKUP=/root/old-site-backup-$(date +%Y%m%d-%H%M%S).tar.gz
  paths=()
  for p in /var/www /etc/nginx /etc/apache2 /etc/httpd /etc/caddy /root/.pm2; do
    [ -e "$p" ] && paths+=("$p")
  done
  if [ ${#paths[@]} -gt 0 ]; then
    tar -czf "$BACKUP" "${paths[@]}" 2>/dev/null || true
    ok "Backup: $BACKUP"
  fi

  units=$(systemctl list-unit-files --no-legend 2>/dev/null || true)
  for svc in nginx apache2 httpd caddy lighttpd; do
    if printf '%s\n' "$units" | grep -q "^$svc\.service"; then
      systemctl stop "$svc" 2>/dev/null || true
      systemctl disable "$svc" 2>/dev/null || true
      ok "Stopped $svc"
    fi
  done
  if command -v pm2 >/dev/null 2>&1; then
    pm2 kill >/dev/null 2>&1 || true
    ok "Stopped pm2 apps"
  fi
  if command -v docker >/dev/null 2>&1 && [ -n "$(docker ps -aq 2>/dev/null)" ]; then
    docker stop $(docker ps -aq) >/dev/null 2>&1 || true
    docker rm $(docker ps -aq) >/dev/null 2>&1 || true
    ok "Removed old containers"
  fi
  if [ -d /var/www ]; then
    find /var/www -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    ok "Cleared /var/www (kept in the backup)"
  fi
fi

# Anything still holding 80/443 would block HTTPS.
for port in 80 443; do
  if ss -ltnp 2>/dev/null | grep -q ":$port "; then
    holder=$(ss -ltnp | grep ":$port " | head -1)
    if ! echo "$holder" | grep -q docker; then
      warn "Port $port is still in use: $holder"
      warn "Stop that program and run this script again."
      exit 1
    fi
  fi
done

# ---------------------------------------------------------------- 2. docker
say "Installing Docker and Git"
apt-get update -y >/dev/null
apt-get install -y ca-certificates curl git openssl >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  if ! curl -fsSL https://get.docker.com | sh >/dev/null 2>&1; then
    warn "get.docker.com unreachable; using the distro package"
    apt-get install -y docker.io docker-compose-v2 >/dev/null 2>&1 \
      || apt-get install -y docker.io docker-compose-plugin >/dev/null
  fi
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || { warn "docker compose plugin missing"; exit 1; }

# Docker Hub is often blocked from Iranian networks: add mirrors if a pull fails.
if ! timeout 60 docker pull -q caddy:2-alpine >/dev/null 2>&1; then
  warn "Docker Hub unreachable; configuring registry mirrors"
  mkdir -p /etc/docker
  cat >/etc/docker/daemon.json <<'JSON'
{ "registry-mirrors": ["https://docker.arvancloud.ir", "https://focker.ir", "https://registry.docker.ir"] }
JSON
  systemctl restart docker
  timeout 120 docker pull -q caddy:2-alpine >/dev/null || { warn "Could not pull images even via mirrors."; exit 1; }
fi
ok "Docker ready: $(docker --version)"

# ---------------------------------------------------------------- 3. code + config
say "Fetching Geram ($BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  # The server must run exactly what is on GitHub: drop any edits made on the
  # box (they previously broke the root layout), keep settings and markers.
  if [ -n "$(git -C "$APP_DIR" status --porcelain --untracked-files=no)" ]; then
    warn "Discarding local code edits on the server (they are not on GitHub)"
    git -C "$APP_DIR" diff --stat | tail -5 || true
  fi
  git -C "$APP_DIR" reset -q --hard
  git -C "$APP_DIR" clean -fdq -e .installed -e .env.production
  git -C "$APP_DIR" fetch -q origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
  git -C "$APP_DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone -q --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
ok "Code at $(git -C "$APP_DIR" rev-parse --short HEAD)"

if [ ! -f "$ENV_FILE" ]; then
  say "Settings (press Enter to accept the value in brackets)"
  echo "    Find the Supabase keys at: Supabase > Project Settings > API"
  domain=$(ask "    Domain [$DOMAIN_DEFAULT]: "); domain=${domain:-$DOMAIN_DEFAULT}
  mode=$(ask "    Mode SANDBOX or CLOSED_BETA [SANDBOX]: "); mode=${mode:-SANDBOX}
  sb_url=$(ask "    Supabase URL [https://wlxlobhetjbrhbfpsmzp.supabase.co]: ")
  sb_url=${sb_url:-https://wlxlobhetjbrhbfpsmzp.supabase.co}
  anon=$(ask_secret "    Supabase anon key (hidden): ")
  service=$(ask_secret "    Supabase service_role key (hidden): ")
  echo "    Database connection string: Supabase > Connect > Session pooler (Enter to skip; trading stays off)"
  db_url=$(ask_secret "    DATABASE_URL (hidden): ")
  kv_key=$(ask_secret "    Kavenegar API key for SMS login (Enter to skip): ")
  kv_tpl=""
  [ -n "$kv_key" ] && kv_tpl=$(ask "    Kavenegar OTP template name: ")

  umask 077
  cat >"$ENV_FILE" <<ENV
GERAM_EXECUTION_MODE=$mode
GERAM_DOMAIN=$domain
NEXT_PUBLIC_SUPABASE_URL=$sb_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$service
DATABASE_URL=$db_url
KAVENEGAR_API_KEY=$kv_key
KAVENEGAR_OTP_TEMPLATE=$kv_tpl
OTP_HASH_SECRET=$(rand 48)
PHONE_AUTH_PEPPER=$(rand 48)
CRON_SECRET=$(rand 40)
DEMO_OTP=123456
ENV
  chmod 600 "$ENV_FILE"
  ok "Saved to $ENV_FILE (only root can read it)"
else
  ok "Keeping existing settings in $ENV_FILE"
fi

# ---------------------------------------------------------------- self-hosted supabase
# A self-hosted gateway on http://IP:8000 cannot be called from the https site
# (mixed content). Serve it through Caddy at https://DOMAIN/sb instead.
SB_CURRENT=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
if printf '%s' "$SB_CURRENT" | grep -Eq '^http://[^/]+:8000/?$'; then
  DOMAIN_NOW=$(grep '^GERAM_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
  sed -i "s#^NEXT_PUBLIC_SUPABASE_URL=.*#NEXT_PUBLIC_SUPABASE_URL=https://$DOMAIN_NOW/sb#" "$ENV_FILE"
  ok "Self-hosted Supabase now served at https://$DOMAIN_NOW/sb (was $SB_CURRENT)"
fi

# ---------------------------------------------------------------- network checks
say "Checking outside services from this server"
if ! grep -q '^NPM_REGISTRY=' "$ENV_FILE"; then
  if curl -fs -m 15 https://registry.npmjs.org/react >/dev/null; then
    echo "NPM_REGISTRY=https://registry.npmjs.org/" >>"$ENV_FILE"
  else
    warn "registry.npmjs.org unreachable; using the Liara npm mirror"
    echo "NPM_REGISTRY=https://package-mirror.liara.ir/repository/npm/" >>"$ENV_FILE"
  fi
fi
SB_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
if curl -s -m 15 -o /dev/null "$SB_URL/auth/v1/health"; then
  ok "Supabase reachable"
else
  warn "Supabase ($SB_URL) is NOT reachable from this server."
  warn "Login and data will fail until the server can reach it (sanctions/filtering)."
fi
if curl -fs -m 15 -o /dev/null https://call1.tgju.org/ajax.json; then
  ok "Price source (TGJU) reachable"
else
  warn "TGJU price source not reachable; prices will fall back to cached values."
fi

# ---------------------------------------------------------------- 4. build + run
say "Building and starting (first build takes 5-10 minutes)"
cd "$APP_DIR/deploy"
docker compose --env-file "$ENV_FILE" up -d --build
touch "$APP_DIR/.installed"

say "Waiting for the app"
for i in $(seq 1 60); do
  if curl -fs http://127.0.0.1/api/health >/dev/null 2>&1; then ok "App is up"; break; fi
  sleep 3
  [ "$i" -eq 60 ] && { warn "App did not answer; logs: docker compose -f $APP_DIR/deploy/docker-compose.yml logs app"; exit 1; }
done

# ---------------------------------------------------------------- 5. cron
CRON_SECRET_VALUE=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2-)
CRON_LINE="0 6 * * * curl -fs -H 'Authorization: Bearer $CRON_SECRET_VALUE' http://127.0.0.1/api/cron/revenue >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -v '/api/cron/revenue' ; echo "$CRON_LINE" ) | crontab -
ok "Daily cron installed"

# ---------------------------------------------------------------- report
say "Status"
curl -fs http://127.0.0.1/api/core/readiness || true
echo
DOMAIN_VALUE=$(grep '^GERAM_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
cat <<DONE

  Done.
  - Now:        http://$(hostname -I | awk '{print $1}')
  - With DNS:   https://$DOMAIN_VALUE  (point an A record for $DOMAIN_VALUE and www to this server;
                HTTPS is issued automatically within a few minutes)
  - Update:     run this same command again
  - Logs:       cd $APP_DIR/deploy && docker compose --env-file $ENV_FILE logs -f app
  - Settings:   nano $ENV_FILE  then  docker compose --env-file $ENV_FILE up -d

  Security: change the root password now with:  passwd
DONE
