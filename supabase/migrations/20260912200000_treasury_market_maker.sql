-- Treasury / market-maker layer (event-sourced inventory + spread + PnL)
-- Balances are derived from events; direct balance edits are forbidden by RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Assets (agnostic): GOLD | SILVER | COPPER
-- Weights in milligrams (mg). Money in toman (bigint).
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  asset text not null check (asset in ('GOLD', 'SILVER', 'COPPER')),
  weight_mg bigint not null check (weight_mg > 0),
  remaining_mg bigint not null check (remaining_mg >= 0),
  acquisition_cost_toman bigint not null check (acquisition_cost_toman >= 0),
  unit_cost_toman_per_mg numeric(24, 12) not null,
  supplier text not null default '',
  purchased_at timestamptz not null default now(),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'DEPLETED', 'VOID')),
  procurement_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_mg <= weight_mg)
);

create index if not exists inventory_lots_asset_status_idx
  on public.inventory_lots (asset, status, purchased_at);

-- Event log — source of truth for physical inventory & WAC
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  asset text not null check (asset in ('GOLD', 'SILVER', 'COPPER')),
  movement_type text not null check (
    movement_type in (
      'PURCHASE',
      'CONSUME_CUSTOMER_BUY',
      'ACQUIRE_CUSTOMER_SELL',
      'RESERVE',
      'RELEASE_RESERVE',
      'VOID'
    )
  ),
  weight_mg bigint not null check (weight_mg > 0),
  -- signed cost impact on inventory pool (+ purchase/acquire, - consume)
  cost_toman bigint not null,
  lot_id uuid references public.inventory_lots (id),
  source text not null,
  source_ref text,
  actor_id uuid references public.profiles (id),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_asset_created_idx
  on public.inventory_movements (asset, created_at desc);

create index if not exists inventory_movements_source_ref_idx
  on public.inventory_movements (source_ref);

-- Reservations (not yet consumed)
create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  asset text not null check (asset in ('GOLD', 'SILVER', 'COPPER')),
  weight_mg bigint not null check (weight_mg > 0),
  status text not null default 'OPEN'
    check (status in ('OPEN', 'RELEASED', 'CONSUMED')),
  reason text not null default '',
  source_ref text,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists inventory_reservations_asset_status_idx
  on public.inventory_reservations (asset, status);

-- Market-maker trade legs (spread + fee separated from inventory cost)
create table if not exists public.treasury_trades (
  id uuid primary key default gen_random_uuid(),
  asset text not null check (asset in ('GOLD', 'SILVER', 'COPPER')),
  side text not null check (side in ('CUSTOMER_BUY', 'CUSTOMER_SELL')),
  weight_mg bigint not null check (weight_mg > 0),
  mid_price_toman_per_gram bigint not null,
  customer_price_toman_per_gram bigint not null,
  spread_bps integer not null default 0,
  spread_revenue_toman bigint not null default 0,
  fee_revenue_toman bigint not null default 0,
  inventory_cost_toman bigint not null default 0,
  realized_pnl_toman bigint not null default 0,
  transaction_id uuid references public.transactions (id),
  user_id uuid references public.profiles (id),
  wac_toman_per_mg numeric(24, 12),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists treasury_trades_created_idx
  on public.treasury_trades (created_at desc);

create index if not exists treasury_trades_asset_side_idx
  on public.treasury_trades (asset, side);

-- Operational costs placeholder
create table if not exists public.operational_costs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount_toman bigint not null check (amount_toman >= 0),
  category text not null default 'ops',
  incurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Replenishment recommendations — never auto-buy
create table if not exists public.replenishment_recommendations (
  id uuid primary key default gen_random_uuid(),
  asset text not null check (asset in ('GOLD', 'SILVER', 'COPPER')),
  recommended_weight_mg bigint not null check (recommended_weight_mg > 0),
  reason text not null,
  coverage_before numeric(18, 8),
  coverage_target numeric(18, 8),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED')),
  estimated_cost_toman bigint,
  supplier text,
  acquisition_cost_toman bigint,
  executed_lot_id uuid references public.inventory_lots (id),
  created_by uuid references public.profiles (id),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists replenishment_status_idx
  on public.replenishment_recommendations (status, created_at desc);

alter table public.inventory_lots
  drop constraint if exists inventory_lots_procurement_id_fkey;
alter table public.inventory_lots
  add constraint inventory_lots_procurement_id_fkey
  foreign key (procurement_id)
  references public.replenishment_recommendations (id);

-- Immutable audit trail for treasury actions
create table if not exists public.treasury_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text,
  actor_id uuid references public.profiles (id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists treasury_audit_created_idx
  on public.treasury_audit_log (created_at desc);

-- Default treasury / spread settings in platform_settings
insert into public.platform_settings (key, value)
values (
  'spread',
  '{
    "defaultBuySpreadBps": 50,
    "defaultSellSpreadBps": 50,
    "emergencyMultiplier": 1,
    "assets": {
      "GOLD": { "buySpreadBps": 50, "sellSpreadBps": 50 },
      "SILVER": { "buySpreadBps": 80, "sellSpreadBps": 80 },
      "COPPER": { "buySpreadBps": 100, "sellSpreadBps": 100 }
    },
    "volatilityHighBpsAdd": 25,
    "liquidityLowBpsAdd": 20,
    "shortageCoverageThreshold": 1.05,
    "shortageBpsAdd": 40
  }'::jsonb
)
on conflict (key) do nothing;

insert into public.platform_settings (key, value)
values (
  'treasury',
  '{
    "coverageTarget": 1.15,
    "coverageCritical": 1.0,
    "replenishmentBufferRatio": 0.2,
    "assetsEnabled": ["GOLD", "SILVER", "COPPER"]
  }'::jsonb
)
on conflict (key) do nothing;

-- RLS: admin read/write only (mutations go through service role / admin APIs)
alter table public.inventory_lots enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.treasury_trades enable row level security;
alter table public.operational_costs enable row level security;
alter table public.replenishment_recommendations enable row level security;
alter table public.treasury_audit_log enable row level security;

drop policy if exists inventory_lots_admin_all on public.inventory_lots;
create policy inventory_lots_admin_all on public.inventory_lots
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists inventory_movements_admin_select on public.inventory_movements;
create policy inventory_movements_admin_select on public.inventory_movements
  for select using (public.is_admin());

drop policy if exists inventory_reservations_admin_all on public.inventory_reservations;
create policy inventory_reservations_admin_all on public.inventory_reservations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists treasury_trades_admin_select on public.treasury_trades;
create policy treasury_trades_admin_select on public.treasury_trades
  for select using (public.is_admin());

drop policy if exists operational_costs_admin_all on public.operational_costs;
create policy operational_costs_admin_all on public.operational_costs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists replenishment_admin_all on public.replenishment_recommendations;
create policy replenishment_admin_all on public.replenishment_recommendations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists treasury_audit_admin_select on public.treasury_audit_log;
create policy treasury_audit_admin_select on public.treasury_audit_log
  for select using (public.is_admin());

comment on table public.inventory_movements is
  'Event-sourced inventory ledger. Never edit balances directly.';
comment on table public.treasury_trades is
  'Market-maker trade economics: spread revenue separate from commission fees.';
comment on table public.replenishment_recommendations is
  'Human-approved procurement only — never auto-buy metal.';
