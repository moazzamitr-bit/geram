-- Drop unused balance tables, the sandbox deposit log, and the duplicate
-- kill-switch / price tables. Ledger (core_*) and market_prices stay.
-- Safe to re-run. Apply on the server with: bash deploy/check-db.sh --apply
-- Do not edit older migrations.

-- Signup must not insert a wallets row after that table is gone.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_app_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Keep the engine table. Copy audit columns from the admin copy, then drop it.
alter table if exists public.core_kill_switches
  add column if not exists reason text;
alter table if exists public.core_kill_switches
  add column if not exists actor_id uuid;

do $$
begin
  if to_regclass('public.core_kill_switches') is not null
     and to_regclass('public.admin_kill_switches') is not null then
    insert into public.core_kill_switches (key, enabled, updated_at, reason, actor_id)
    select key, enabled, updated_at, reason, actor_id
    from public.admin_kill_switches
    on conflict (key) do update set
      reason = coalesce(public.core_kill_switches.reason, excluded.reason),
      actor_id = coalesce(public.core_kill_switches.actor_id, excluded.actor_id);
  end if;
end $$;

drop table if exists public.admin_kill_switches;

-- market_prices is the table the app reads and writes. The observation log is unused.
drop table if exists public.core_price_observations;

drop table if exists public.core_sandbox_deposits;
drop table if exists public.wallets;

-- price_alert_orders.transaction_id pointed at the legacy ledger.
do $$
declare
  fk record;
begin
  if to_regclass('public.price_alert_orders') is null then
    return;
  end if;
  for fk in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'price_alert_orders'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) ilike '%transactions%'
  loop
    execute format('alter table public.price_alert_orders drop constraint %I', fk.conname);
  end loop;
end $$;

drop table if exists public.transactions;
