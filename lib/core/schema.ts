export const CORE_SCHEMA_SQL = `
create table if not exists core_ledger_accounts (
  id text primary key,
  holder_id text not null,
  account_code text not null,
  asset text not null,
  balance bigint not null default 0 check (balance >= 0),
  unique (holder_id, account_code, asset)
);

create table if not exists core_journals (
  id text primary key,
  created_at timestamptz not null,
  reason text not null,
  ref_type text not null,
  ref_id text not null
);

create table if not exists core_journal_lines (
  id bigserial primary key,
  journal_id text not null references core_journals(id),
  account_code text not null,
  holder_id text not null,
  asset text not null,
  debit bigint not null default 0 check (debit >= 0),
  credit bigint not null default 0 check (credit >= 0)
);

create table if not exists core_quotes (
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

create table if not exists core_reservations (
  id text primary key,
  quote_id text not null unique,
  asset text not null,
  quantity_ug bigint not null,
  status text not null,
  created_at timestamptz not null
);

create table if not exists core_trades (
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

create table if not exists core_idempotency (
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

create table if not exists core_outbox (
  id text primary key,
  topic text not null,
  payload_json text not null,
  created_at timestamptz not null,
  processed_at timestamptz,
  attempts integer not null default 0,
  status text not null,
  last_error text
);

create table if not exists core_cost_basis (
  holder_id text not null,
  asset text not null,
  quantity_ug bigint not null default 0,
  cost_irr bigint not null default 0,
  primary key (holder_id, asset)
);

create table if not exists core_sandbox_deposits (
  id text primary key,
  user_id text not null,
  irr bigint not null,
  created_at timestamptz not null,
  tracking_code text not null
);

create table if not exists core_kill_switches (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

create table if not exists core_price_observations (
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

create index if not exists core_quotes_user_idx on core_quotes (user_id, created_at desc);
create index if not exists core_trades_user_idx on core_trades (user_id, created_at desc);
create index if not exists core_outbox_pending_idx on core_outbox (status) where status = 'PENDING';
create index if not exists core_reservations_open_idx on core_reservations (asset) where status = 'OPEN';
`;
