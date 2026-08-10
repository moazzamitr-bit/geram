#!/usr/bin/env bash
# Run locally after: vercel login && supabase login
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ -z "${VERCEL_TOKEN:-}" ]] && ! vercel whoami &>/dev/null; then
  echo "Run: vercel login (or export VERCEL_TOKEN)"
  exit 1
fi

CRON_SECRET="${CRON_SECRET:-$(openssl rand -hex 24)}"
echo "Using CRON_SECRET (save this): $CRON_SECRET"

add_env() {
  local name="$1"
  local value="$2"
  for env in production preview development; do
    printf '%s' "$value" | vercel env add "$name" "$env" --force --cwd "$PROJECT_ROOT"
  done
}

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  add_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
fi
add_env CRON_SECRET "$CRON_SECRET"

vercel deploy --prod --yes --cwd "$PROJECT_ROOT"

echo "Done. Apply DB migration:"
echo "  supabase link --project-ref wlxlobhetjbrhbfpsmzp"
echo "  supabase db push"
