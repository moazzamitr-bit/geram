/** Hardened financial-core schema. Applied as-is in PGlite tests. */

export const CORE_SCHEMA_SQL = `
create table if not exists core_ledger_accounts (
  id text primary key,
  holder_id text not null,
  account_code text not null
    check (account_code in (
      'USER_AVAILABLE','USER_RESERVED',
      'PLATFORM_AVAILABLE','PLATFORM_RESERVED','PLATFORM_CLEARING',
      'PLATFORM_FEE_REVENUE','PAYMENT_GATEWAY_CLEARING','BANK_SETTLEMENT_CLEARING',
      'PLATFORM_CASH_CONTROL','PLATFORM_OPENING','PLATFORM_RESTRICTED'
    )),
  asset text not null
    check (asset in ('IRR','GOLD','SILVER','COPPER','TEST_METAL')),
  balance bigint not null default 0 check (balance >= 0),
  unique (holder_id, account_code, asset),
  constraint core_account_asset_policy check (
    (account_code in ('PLATFORM_FEE_REVENUE','PAYMENT_GATEWAY_CLEARING','BANK_SETTLEMENT_CLEARING','PLATFORM_CASH_CONTROL') and asset = 'IRR')
    or (account_code not in ('PLATFORM_FEE_REVENUE','PAYMENT_GATEWAY_CLEARING','BANK_SETTLEMENT_CLEARING','PLATFORM_CASH_CONTROL'))
  )
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
  journal_id text not null references core_journals(id) on delete restrict on update restrict,
  account_code text not null
    check (account_code in (
      'USER_AVAILABLE','USER_RESERVED',
      'PLATFORM_AVAILABLE','PLATFORM_RESERVED','PLATFORM_CLEARING',
      'PLATFORM_FEE_REVENUE','PAYMENT_GATEWAY_CLEARING','BANK_SETTLEMENT_CLEARING',
      'PLATFORM_CASH_CONTROL','PLATFORM_OPENING','PLATFORM_RESTRICTED'
    )),
  holder_id text not null,
  asset text not null check (asset in ('IRR','GOLD','SILVER','COPPER','TEST_METAL')),
  debit bigint not null check (debit >= 0),
  credit bigint not null check (credit >= 0),
  constraint core_journal_line_xor check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create table if not exists core_quotes (
  id text primary key,
  user_id text not null,
  asset text not null check (asset in ('GOLD','SILVER','COPPER','TEST_METAL')),
  side text not null check (side in ('BUY','SELL')),
  input_mode text not null check (input_mode in ('RIAL_AMOUNT','METAL_WEIGHT')),
  requested_irr bigint,
  requested_weight_ug bigint,
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
  status text not null check (status in ('ACTIVE','USED','EXPIRED','CANCELLED')),
  constraint core_quote_request_mode check (
    (input_mode = 'RIAL_AMOUNT' and requested_irr > 0 and requested_weight_ug is null)
    or (input_mode = 'METAL_WEIGHT' and requested_weight_ug > 0 and requested_irr is null)
  )
);

create table if not exists core_reservations (
  id text primary key,
  quote_id text not null unique references core_quotes(id) on delete restrict on update restrict,
  asset text not null check (asset in ('GOLD','SILVER','COPPER','TEST_METAL')),
  quantity_ug bigint not null check (quantity_ug > 0),
  status text not null check (status in ('OPEN','CONSUMED','RELEASED')),
  created_at timestamptz not null
);

create table if not exists core_trades (
  id text primary key,
  user_id text not null,
  quote_id text not null references core_quotes(id) on delete restrict on update restrict,
  asset text not null check (asset in ('GOLD','SILVER','COPPER','TEST_METAL')),
  side text not null check (side in ('BUY','SELL')),
  status text not null check (status in ('CREATED','RESERVED','LEDGER_POSTED','SETTLED','FAILED','CANCELLED')),
  weight_ug bigint not null,
  gross_irr bigint not null,
  fee_irr bigint not null,
  net_irr bigint not null,
  idempotency_key text not null,
  created_at timestamptz not null,
  tracking_code text not null unique
);

create unique index if not exists core_trades_one_settled_per_quote
  on core_trades (quote_id) where status = 'SETTLED';

create unique index if not exists core_trades_settled_idempotency
  on core_trades (user_id, idempotency_key) where status = 'SETTLED';

create table if not exists core_idempotency (
  user_id text not null,
  operation text not null,
  key text not null,
  method text not null,
  path text not null,
  request_hash text not null,
  response_json text,
  status text not null check (status in ('IN_PROGRESS','COMPLETED')),
  created_at timestamptz not null,
  primary key (user_id, operation, key)
);

create table if not exists core_outbox (
  id text primary key,
  topic text not null,
  payload_json text not null,
  created_at timestamptz not null,
  processed_at timestamptz,
  attempts integer not null default 0,
  status text not null check (status in ('PENDING','PROCESSED','FAILED')),
  last_error text
);

create table if not exists core_cost_basis (
  holder_id text not null,
  asset text not null check (asset in ('GOLD','SILVER','COPPER','TEST_METAL')),
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
create index if not exists core_journal_lines_journal_idx on core_journal_lines (journal_id);
create index if not exists core_journal_lines_account_idx on core_journal_lines (holder_id, account_code, asset);

create or replace function core_reject_journal_mutation()
returns trigger as $$
begin
  raise exception 'journals are immutable; use a reversal journal';
end;
$$ language plpgsql;

drop trigger if exists core_journals_immutable_upd on core_journals;
create trigger core_journals_immutable_upd
before update or delete on core_journals
for each row execute procedure core_reject_journal_mutation();

drop trigger if exists core_journal_lines_immutable_upd on core_journal_lines;
create trigger core_journal_lines_immutable_upd
before update or delete on core_journal_lines
for each row execute procedure core_reject_journal_mutation();

create or replace function core_assert_journal_balanced()
returns trigger as $$
declare
  unbalanced text;
begin
  select l.asset into unbalanced
  from core_journal_lines l
  where l.journal_id = new.journal_id
  group by l.asset
  having sum(l.debit) <> sum(l.credit)
  limit 1;
  if unbalanced is not null then
    raise exception 'unbalanced journal % asset %', new.journal_id, unbalanced;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists core_journal_lines_balanced on core_journal_lines;
create constraint trigger core_journal_lines_balanced
after insert on core_journal_lines
deferrable initially deferred
for each row execute procedure core_assert_journal_balanced();
`;
