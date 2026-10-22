#!/usr/bin/env bash
# Create (or promote) an admin account on the self-hosted Supabase.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/moazzamitr-bit/geram/fix/p0-security/deploy/create-admin.sh)
#
# You type the email and password yourself (hidden); nothing is stored in the
# script or printed. The admin then signs in at https://DOMAIN/admin/login.
set -euo pipefail

ENV_FILE=/opt/geram/.env.production
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
GATEWAY="${SUPABASE_GATEWAY:-http://127.0.0.1:8000}"

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE — run install.sh first"; exit 1; }
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)
[ -n "$SERVICE_KEY" ] || { echo "SUPABASE_SERVICE_ROLE_KEY is empty in $ENV_FILE"; exit 1; }

read -r -p "Admin email: " EMAIL </dev/tty
case "$EMAIL" in *@*.*) ;; *) echo "Invalid email"; exit 1 ;; esac
read -r -s -p "Password (min 12 chars, hidden): " PASS </dev/tty; echo
[ ${#PASS} -ge 12 ] || { echo "Password too short"; exit 1; }
read -r -s -p "Repeat password: " PASS2 </dev/tty; echo
[ "$PASS" = "$PASS2" ] || { echo "Passwords do not match"; exit 1; }

# JSON-encode safely (password may contain quotes/backslashes).
BODY=$(python3 -c 'import json,sys; print(json.dumps({"email":sys.argv[1],"password":sys.argv[2],"email_confirm":True}))' "$EMAIL" "$PASS" 2>/dev/null \
  || docker run --rm -i node:22-alpine node -e 'const [e,p]=process.argv.slice(1);process.stdout.write(JSON.stringify({email:e,password:p,email_confirm:true}))' "$EMAIL" "$PASS")

STATUS=$(curl -s -o /tmp/geram-admin.json -w '%{http_code}' -X POST "$GATEWAY/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" --data "$BODY")
unset PASS PASS2 BODY

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  echo "Auth user created."
elif grep -qi 'already' /tmp/geram-admin.json; then
  echo "User already exists; promoting it (password unchanged)."
else
  echo "Could not create the user (HTTP $STATUS):"; head -c 300 /tmp/geram-admin.json; echo; rm -f /tmp/geram-admin.json; exit 1
fi
rm -f /tmp/geram-admin.json

docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -v email="$EMAIL" <<'SQL'
update public.profiles p set role = 'admin', email = u.email
from auth.users u where u.id = p.id and lower(u.email) = lower(:'email');
insert into public.admin_role_assignments (user_id, admin_role, reason)
select u.id, 'SUPER_ADMIN', 'created by deploy/create-admin.sh'
from auth.users u where lower(u.email) = lower(:'email')
on conflict (user_id) do update set admin_role = excluded.admin_role;
select 'admin ready: ' || count(*) from public.profiles p join auth.users u on u.id = p.id
where lower(u.email) = lower(:'email') and p.role = 'admin';
SQL

DOMAIN=$(grep '^GERAM_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
echo "Sign in at: https://${DOMAIN:-your-domain}/admin/login"
