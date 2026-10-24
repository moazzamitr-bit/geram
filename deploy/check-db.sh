#!/usr/bin/env bash
# Read-only health check of the self-hosted Supabase database.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/moazzamitr-bit/geram/fix/p0-security/deploy/check-db.sh)
#
# Prints counts and yes/no flags only — no personal data, no secrets.
# With --apply it runs any missing Geram migrations (each in its own transaction).
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
APP_DIR=/opt/geram
psql_q() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 "$@"; }

docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" || { echo "Container $DB_CONTAINER not found"; exit 1; }

echo "== Geram database check ($DB_CONTAINER)"
psql_q <<'SQL'
select 'auth users:           ' || count(*) from auth.users;
select 'profiles:             ' || coalesce((select count(*)::text from public.profiles), 'MISSING TABLE');
select 'admins:               ' || coalesce((select count(*)::text from public.profiles where role = 'admin'), '-');
select 'core ledger journals: ' || case when to_regclass('public.core_journals') is null then 'MISSING TABLE'
                                        else (select count(*)::text from public.core_journals) end;
select 'migration 0808 core:        ' || (to_regclass('public.profiles') is not null);
select 'migration 0810 revenue:     ' || (to_regclass('public.platform_settings') is not null);
select 'migration 0812 multi-metal: ' || exists(select 1 from pg_indexes where indexname='market_prices_instrument_observed_idx');
select 'migration 0814 core:        ' || (to_regclass('public.core_ledger_accounts') is not null);
select 'migration 0814 hardening:   ' || exists(select 1 from pg_trigger where tgname='core_journal_lines_balanced');
select 'migration 0814 admin ops:   ' || (to_regclass('public.admin_role_assignments') is not null);
select 'migration 1021 RLS lockdown:' || exists(select 1 from pg_trigger where tgname='profiles_guard_privileged_columns');
select 'migration 1021 fees:        ' || coalesce((select (value->>'buyFeeMinTomanFree') = '0' from public.platform_settings where key='fees'), false);
select 'migration 1021 otp:         ' || (to_regclass('public.auth_otp_codes') is not null);
select 'migration 1024 finnotech kyc:' || exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='kyc_verified_at');
select 'migration 1024 legacy drop: ' || (to_regclass('public.wallets') is null and to_regclass('public.transactions') is null);
select 'migration 1024 kyc level:   ' || exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='kyc_level');
select 'tracked migrations:         ' || case when to_regclass('public.geram_schema_migrations') is null then 'NOT TRACKED'
  else (select count(*)::text from public.geram_schema_migrations) end;
select 'wallets:                    ' || case when to_regclass('public.wallets') is null then 'DROPPED' else 'STILL PRESENT' end;
select 'transactions:               ' || case when to_regclass('public.transactions') is null then 'DROPPED' else 'STILL PRESENT' end;
select 'core_sandbox_deposits:      ' || case when to_regclass('public.core_sandbox_deposits') is null then 'DROPPED' else 'STILL PRESENT' end;
select 'admin_kill_switches:        ' || case when to_regclass('public.admin_kill_switches') is null then 'DROPPED' else 'STILL PRESENT' end;
select 'core_price_observations:    ' || case when to_regclass('public.core_price_observations') is null then 'DROPPED' else 'STILL PRESENT' end;
select 'core_kill_switches kept:    ' || (to_regclass('public.core_kill_switches') is not null);
select 'market_prices kept:         ' || (to_regclass('public.market_prices') is not null);
select 'wallets_update_own policy:  ' || exists(select 1 from pg_policies where tablename='wallets' and policyname='wallets_update_own') || '  (must be false)';
SQL

if [ "${1:-}" = "--apply" ]; then
  [ -d "$APP_DIR/supabase/migrations" ] || { echo "No migrations at $APP_DIR"; exit 1; }
  # Files at or after this timestamp are NOT assumed to be applied on an
  # existing database. Older files were re-run by the previous script.
  BASELINE_BEFORE=20261024210000
  echo "== Migration ledger"
  psql_q <<'SQL'
create table if not exists public.geram_schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
SQL
  tracked=$(psql_q -c "select count(*) from public.geram_schema_migrations")
  profiles=$(psql_q -c "select to_regclass('public.profiles') is not null")
  if [ "$tracked" = "0" ] && [ "$profiles" = "t" ]; then
    echo "Existing database. Recording migrations before ${BASELINE_BEFORE} without running them again."
    for f in "$APP_DIR"/supabase/migrations/*.sql; do
      base=$(basename "$f")
      ts=${base%%_*}
      if [[ "$base" =~ ^[0-9]+_[A-Za-z0-9_]+\.sql$ ]] && [[ "$ts" =~ ^[0-9]+$ ]] && [ "$ts" -lt "$BASELINE_BEFORE" ]; then
        psql_q -c "insert into public.geram_schema_migrations (filename) values ('${base}') on conflict do nothing"
      fi
    done
  fi
  echo "== Applying migrations that are not in geram_schema_migrations"
  for f in "$APP_DIR"/supabase/migrations/*.sql; do
    base=$(basename "$f")
    if ! [[ "$base" =~ ^[0-9]+_[A-Za-z0-9_]+\.sql$ ]]; then
      echo "  $base ... SKIPPED (unexpected name)"
      continue
    fi
    already=$(psql_q -c "select 1 from public.geram_schema_migrations where filename = '${base}'")
    if [ "$already" = "1" ]; then
      echo "  $base ... skip"
      continue
    fi
    printf '  %s ... ' "$base"
    if docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -1 >/dev/null 2>/tmp/geram-mig.err <"$f"; then
      psql_q -c "insert into public.geram_schema_migrations (filename) values ('${base}') on conflict do nothing"
      echo ok
    else
      echo FAILED; sed 's/^/      /' /tmp/geram-mig.err | head -5; exit 1
    fi
  done
  echo "== Done. Run again without --apply to verify."
fi
