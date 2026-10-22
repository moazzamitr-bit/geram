#!/usr/bin/env bash
# Configure sms.ir OTP for login/sign-up and restart the app.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/moazzamitr-bit/geram/fix/p0-security/deploy/set-sms.sh)
#
# The API key is typed here (hidden) and stored only in /opt/geram/.env.production
# (root-only). Template 123456 is sms.ir's sandbox template: it delivers only to
# the panel owner's number. Use an approved template ID for real users.
set -euo pipefail

ENV_FILE=/opt/geram/.env.production
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE — run install.sh first"; exit 1; }

set_var() {
  local key=$1 value=$2
  if grep -q "^$key=" "$ENV_FILE"; then
    # Use a delimiter that cannot appear in the values we accept.
    sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
  else
    echo "$key=$value" >>"$ENV_FILE"
  fi
}

read -r -s -p "sms.ir API key (hidden; Enter = keep current / disable): " KEY </dev/tty; echo
read -r -p "Template ID [123456 = sandbox, owner's number only]: " TPL </dev/tty
TPL=${TPL:-123456}
read -r -p "Template parameter name [Code]: " PARAM </dev/tty
PARAM=${PARAM:-Code}

case "$TPL" in *[!0-9]*) echo "Template ID must be a number"; exit 1 ;; esac
case "$PARAM" in *[!A-Za-z0-9_]*) echo "Parameter name: letters/digits only"; exit 1 ;; esac
case "$KEY" in *[\|\ ]*) echo "Unexpected characters in the key"; exit 1 ;; esac

if [ -n "$KEY" ]; then set_var SMSIR_API_KEY "$KEY"; fi
set_var SMSIR_TEMPLATE_ID "$TPL"
set_var SMSIR_PARAM_NAME "$PARAM"
unset KEY
chmod 600 "$ENV_FILE"

if ! grep -q '^SMSIR_API_KEY=.\+' "$ENV_FILE"; then
  echo "No sms.ir key stored: login keeps using the sandbox code."
fi

echo "Restarting the app with the new settings..."
cd /opt/geram/deploy
docker compose --env-file "$ENV_FILE" up -d app >/dev/null
sleep 5
curl -fs http://127.0.0.1/api/health >/dev/null && echo "App is up." || echo "App did not answer yet; check: docker compose logs app"
echo "Test: open the login page, enter the panel owner's mobile, and wait for the SMS."
