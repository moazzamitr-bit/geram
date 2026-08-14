-- Financial core tables + revoke direct wallet writes.
-- Wallet balances become ledger projections. Users must not UPDATE/INSERT wallets.

drop policy if exists wallets_update_own on public.wallets;
drop policy if exists wallets_insert_own on public.wallets;
drop policy if exists wallets_update_admin on public.wallets;

-- Keep wallets readable by owner/admin for legacy views; writes are service-role only.
-- wallets_select_own_or_admin remains from core schema.

create table if not exists public.core_ledger_accounts (
  id text primary key,
  holder_id text not null,
  account_code text not null,
  asset text not null,
  balance bigint not null default 0 check (balance >= 0),
  unique (holder_id, account_code, asset)
);

create table if not exists public.core_journals (
  id text primary key,
  created_at timestamptz not null,
  reason text not null,
  ref_type text not null,
  ref_id text not null
);

create table if not exists public.core_journal_lines (
  id bigserial primary key,
  journal_id text not null references public.core_journals(id),
  account_code text not null,
  holder_id text not null,
  asset text not null,
  debit bigint not null default 0 check (debit >= 0),
  credit bigint not null default 0 check (credit >= 0)
);

create table if not exists public.core_quotes (
  id text primary key,
  user_id text not null,
  asset text not null,
  side text not null,
  input_mode text not null,
  requested_irr bigint not null,
  requested_weight_ug bigint not null,
  reference_price_irr_per_gram bigint not null,
  execution_price_irr_per_gram bigint not null,
  gross_irr bigint not null,
  fee_irr bigint not null,
  net_irr bigint not null,
  weight_ug bigint not null,
  fee_snapshot_json text not null,
  spread_snapshot_json text not null,
  price_source_snapshot_json text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null
);

create table if not exists public.core_reservations (
  id text primary key,
  quote_id text not null unique,
  asset text not null,
  quantity_ug bigint not null,
  status text not null,
  created_at timestamptz not null
);

create table if not exists public.core_trades (
  id text primary key,
  user_id text not null,
  quote_id text not null,
  asset text not null,
  side text not null,
  status text not null,
  weight_ug bigint not null,
  gross_irr bigint not null,
  fee_irr bigint not null,
  net_irr bigint not null,
  idempotency_key text not null,
  created_at timestamptz not null,
  tracking_code text not null unique
);

create table if not exists public.core_idempotency (
  user_id text not null,
  key text not null,
  method text not null,
  path text not null,
  request_hash text not null,
  response_json text,
  status text not null,
  created_at timestamptz not null,
  primary key (user_id, key)
);

create table if not exists public.core_outbox (
  id text primary key,
  topic text not null,
  payload_json text not null,
  created_at timestamptz not null,
  processed_at timestamptz,
  attempts integer not null default 0,
  status text not null,
  last_error text
);

create table if not exists public.core_cost_basis (
  holder_id text not null,
  asset text not null,
  quantity_ug bigint not null default 0,
  cost_irr bigint not null default 0,
  primary key (holder_id, asset)
);

create table if not exists public.core_sandbox_deposits (
  id text primary key,
  user_id text not null,
  irr bigint not null,
  created_at timestamptz not null,
  tracking_code text not null
);

create table if not exists public.core_kill_switches (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.core_price_observations (
  id bigserial primary key,
  asset text not null,
  instrument text not null,
  irr_per_gram bigint not null,
  source text not null,
  source_mode text not null,
  permitted_for_production boolean not null,
  health text not null,
  observed_at timestamptz not null
);

create index if not exists core_quotes_user_idx on public.core_quotes (user_id, created_at desc);
create index if not exists core_trades_user_idx on public.core_trades (user_id, created_at desc);

alter table public.core_ledger_accounts enable row level security;
alter table public.core_journals enable row level security;
alter table public.core_journal_lines enable row level security;
alter table public.core_quotes enable row level security;
alter table public.core_reservations enable row level security;
alter table public.core_trades enable row level security;
alter table public.core_idempotency enable row level security;
alter table public.core_outbox enable row level security;
alter table public.core_cost_basis enable row level security;
alter table public.core_sandbox_deposits enable row level security;
alter table public.core_kill_switches enable row level security;
alter table public.core_price_observations enable row level security;

comment on table public.core_ledger_accounts is 'Append-only financial ledger accounts. No client writes.';
