-- Revenue features: fees config, Plus plan, referrals, alert orders, DCA timestamps

alter table public.profiles
  add column if not exists plan_tier text not null default 'free'
    check (plan_tier in ('free', 'plus')),
  add column if not exists plan_expires_at timestamptz,
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

create index if not exists profiles_referral_code_idx on public.profiles (referral_code);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value)
values
  (
    'fees',
    '{
      "buyFeePercentFree": 0.007,
      "buyFeeMinTomanFree": 50000,
      "buyFeePercentPlus": 0.004,
      "buyFeeMinTomanPlus": 25000,
      "sellFeePercentFree": 0.005,
      "sellFeeMinTomanFree": 30000,
      "sellFeePercentPlus": 0.003,
      "sellFeeMinTomanPlus": 15000,
      "withdrawFeeTomanFree": 15000,
      "withdrawFeeTomanPlus": 0,
      "dcaFeeTomanFree": 25000,
      "dcaFeeTomanPlus": 10000
    }'::jsonb
  ),
  (
    'plus',
    '{
      "monthlyPriceToman": 99000,
      "maxDcaFree": 1,
      "maxDcaPlus": 10,
      "smsAlertsPlusOnly": true
    }'::jsonb
  ),
  (
    'referral',
    '{
      "inviterBonusToman": 100000,
      "inviteeBonusToman": 50000,
      "minKycForPayout": true
    }'::jsonb
  )
on conflict (key) do nothing;

alter table public.scheduled_purchases
  add column if not exists last_run_at timestamptz,
  add column if not exists next_run_at timestamptz;

alter table public.price_alerts
  add column if not exists auto_buy_enabled boolean not null default false,
  add column if not exists auto_buy_toman bigint not null default 0 check (auto_buy_toman >= 0);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null unique references public.profiles (id) on delete cascade,
  inviter_bonus_toman bigint not null default 0,
  invitee_bonus_toman bigint not null default 0,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'REJECTED')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists referral_events_inviter_idx
  on public.referral_events (inviter_id, created_at desc);

create table if not exists public.price_alert_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  alert_id uuid not null references public.price_alerts (id) on delete cascade,
  amount_toman bigint not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED')),
  error_message text,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

alter table public.platform_settings enable row level security;
alter table public.referral_events enable row level security;
alter table public.price_alert_orders enable row level security;

drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings
  for select to authenticated using (true);

drop policy if exists platform_settings_admin on public.platform_settings;
create policy platform_settings_admin on public.platform_settings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists referral_events_own on public.referral_events;
create policy referral_events_own on public.referral_events
  for select using (auth.uid() = inviter_id or auth.uid() = invitee_id or public.is_admin());

drop policy if exists referral_events_insert on public.referral_events;
create policy referral_events_insert on public.referral_events
  for insert with check (auth.uid() = invitee_id);

drop policy if exists referral_events_update_admin on public.referral_events;
create policy referral_events_update_admin on public.referral_events
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists price_alert_orders_own on public.price_alert_orders;
create policy price_alert_orders_own on public.price_alert_orders
  for select using (auth.uid() = user_id or public.is_admin());

-- Generate referral codes for existing users missing one
update public.profiles
set referral_code = upper(substr(replace(id::text, '-', ''), 1, 8))
where referral_code is null;
