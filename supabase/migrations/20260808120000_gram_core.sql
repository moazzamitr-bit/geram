-- Gram core schema for Supabase project ogirzyxcamuxrsenpdal
-- Run in SQL Editor if MCP cannot apply, or via: supabase db push

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  email text,
  first_name text not null default '',
  last_name text not null default '',
  kyc_status text not null default 'UNVERIFIED'
    check (kyc_status in ('UNVERIFIED','PENDING','VERIFIED','REJECTED','NEEDS_UPDATE')),
  role text not null default 'user' check (role in ('user','admin')),
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  gold_mg bigint not null default 0 check (gold_mg >= 0),
  toman_available bigint not null default 0 check (toman_available >= 0),
  toman_pending bigint not null default 0 check (toman_pending >= 0),
  avg_buy_price_toman bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bank_name text not null,
  iban text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tracking_code text not null unique,
  type text not null check (type in ('خرید','فروش','واریز','برداشت','تحویل','کارمزد')),
  gold_mg bigint not null default 0,
  amount_toman bigint not null default 0,
  fee_toman bigint not null default 0,
  price_per_gram_toman bigint not null default 0,
  status text not null,
  payment_ref text,
  note text,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);
create index if not exists transactions_status_idx
  on public.transactions (status);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  target_toman bigint not null,
  current_toman bigint not null default 0,
  target_date text,
  monthly_toman bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_toman bigint not null,
  cadence text not null,
  status text not null default 'ACTIVE',
  next_run text,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null,
  product_name text not null,
  weight_grams numeric(12,3) not null,
  method text not null,
  fee_toman bigint not null default 0,
  status text not null default 'REQUESTED',
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  subject text not null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender text not null check (sender in ('user','support','admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  instrument text not null default 'gold18',
  price_toman bigint not null,
  price_rial bigint,
  high_toman bigint,
  low_toman bigint,
  change_percent numeric(10,4),
  source text not null,
  source_key text,
  observed_at timestamptz not null default now()
);

create index if not exists market_prices_observed_idx
  on public.market_prices (instrument, observed_at desc);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('above','below')),
  price_toman bigint not null,
  channels text[] not null default '{app}',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile + wallet on signup
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

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Admin check helper (uses profiles.role — not user_metadata)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.scheduled_purchases enable row level security;
alter table public.delivery_requests enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.market_prices enable row level security;
alter table public.price_alerts enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles policies
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Wallets
drop policy if exists wallets_select_own_or_admin on public.wallets;
create policy wallets_select_own_or_admin on public.wallets
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists wallets_update_admin on public.wallets;
create policy wallets_update_admin on public.wallets
for update using (public.is_admin()) with check (public.is_admin());

-- Generic user-owned tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_accounts','transactions','goals','scheduled_purchases',
    'delivery_requests','support_tickets','notifications','price_alerts'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t||'_own', t);
    execute format(
      'create policy %I on public.%I for select using (user_id = auth.uid() or public.is_admin())',
      t||'_select_own_or_admin', t
    );
    execute format('drop policy if exists %I_insert on public.%I', t||'_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (user_id = auth.uid() or public.is_admin())',
      t||'_insert_own_or_admin', t
    );
    execute format('drop policy if exists %I_update on public.%I', t||'_own', t);
    execute format(
      'create policy %I on public.%I for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin())',
      t||'_update_own_or_admin', t
    );
  end loop;
end $$;

-- Support messages
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
for select using (
  public.is_admin()
  or exists (
    select 1 from public.support_tickets st
    where st.id = ticket_id and st.user_id = auth.uid()
  )
);

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.support_tickets st
    where st.id = ticket_id and st.user_id = auth.uid()
  )
);

-- Market prices: public read, admin write
drop policy if exists market_prices_select on public.market_prices;
create policy market_prices_select on public.market_prices
for select using (true);

drop policy if exists market_prices_admin_write on public.market_prices;
create policy market_prices_admin_write on public.market_prices
for all using (public.is_admin()) with check (public.is_admin());

-- Audit logs: admin only
drop policy if exists audit_logs_admin on public.audit_logs;
create policy audit_logs_admin on public.audit_logs
for all using (public.is_admin()) with check (public.is_admin());

-- Seed note: create an admin after signup with:
-- update public.profiles set role = 'admin' where email = 'admin@geram.ir';
-- update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb where email = 'admin@geram.ir';
