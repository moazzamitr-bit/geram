-- Milestone 1.1: harden financial-core constraints, immutability, and quote/idempotency semantics.
-- Safe to apply on databases that already ran 20260814180000_financial_core.sql.

-- Account policy + status CHECKs
alter table public.core_ledger_accounts
  drop constraint if exists core_ledger_accounts_account_code_check;
alter table public.core_ledger_accounts
  add constraint core_ledger_accounts_account_code_check check (account_code in (
    'USER_AVAILABLE','USER_RESERVED',
    'PLATFORM_AVAILABLE','PLATFORM_RESERVED','PLATFORM_CLEARING',
    'PLATFORM_FEE_REVENUE','PAYMENT_GATEWAY_CLEARING','BANK_SETTLEMENT_CLEARING',
    'PLATFORM_CASH_CONTROL','PLATFORM_OPENING','PLATFORM_RESTRICTED'
  ));

alter table public.core_ledger_accounts
  drop constraint if exists core_ledger_accounts_asset_check;
alter table public.core_ledger_accounts
  add constraint core_ledger_accounts_asset_check
  check (asset in ('IRR','GOLD','SILVER','COPPER','TEST_METAL'));

alter table public.core_ledger_accounts
  drop constraint if exists core_account_asset_policy;
alter table public.core_ledger_accounts
  add constraint core_account_asset_policy check (
    (account_code in (
      'PLATFORM_FEE_REVENUE','PAYMENT_GATEWAY_CLEARING',
      'BANK_SETTLEMENT_CLEARING','PLATFORM_CASH_CONTROL'
    ) and asset = 'IRR')
    or (account_code not in (
      'PLATFORM_FEE_REVENUE','PAYMENT_GATEWAY_CLEARING',
      'BANK_SETTLEMENT_CLEARING','PLATFORM_CASH_CONTROL'
    ))
  );

-- Journal line XOR + FKs that never cascade financial history
alter table public.core_journal_lines
  drop constraint if exists core_journal_lines_journal_id_fkey;
alter table public.core_journal_lines
  add constraint core_journal_lines_journal_id_fkey
  foreign key (journal_id) references public.core_journals(id)
  on delete restrict on update restrict;

alter table public.core_journal_lines
  drop constraint if exists core_journal_line_xor;
alter table public.core_journal_lines
  add constraint core_journal_line_xor check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  );

alter table public.core_journal_lines
  drop constraint if exists core_journal_lines_asset_check;
alter table public.core_journal_lines
  add constraint core_journal_lines_asset_check
  check (asset in ('IRR','GOLD','SILVER','COPPER','TEST_METAL'));

-- Quote request model: exactly one authoritative input
alter table public.core_quotes alter column requested_irr drop not null;
alter table public.core_quotes alter column requested_weight_ug drop not null;

update public.core_quotes
  set requested_weight_ug = null
  where input_mode = 'RIAL_AMOUNT';
update public.core_quotes
  set requested_irr = null
  where input_mode = 'METAL_WEIGHT';

alter table public.core_quotes
  drop constraint if exists core_quotes_asset_check;
alter table public.core_quotes
  add constraint core_quotes_asset_check
  check (asset in ('GOLD','SILVER','COPPER','TEST_METAL'));

alter table public.core_quotes
  drop constraint if exists core_quotes_side_check;
alter table public.core_quotes
  add constraint core_quotes_side_check check (side in ('BUY','SELL'));

alter table public.core_quotes
  drop constraint if exists core_quotes_status_check;
alter table public.core_quotes
  add constraint core_quotes_status_check
  check (status in ('ACTIVE','USED','EXPIRED','CANCELLED'));

alter table public.core_quotes
  drop constraint if exists core_quote_request_mode;
alter table public.core_quotes
  add constraint core_quote_request_mode check (
    (input_mode = 'RIAL_AMOUNT' and requested_irr > 0 and requested_weight_ug is null)
    or (input_mode = 'METAL_WEIGHT' and requested_weight_ug > 0 and requested_irr is null)
  );

-- Reservations / trades FKs
alter table public.core_reservations
  drop constraint if exists core_reservations_quote_id_fkey;
alter table public.core_reservations
  add constraint core_reservations_quote_id_fkey
  foreign key (quote_id) references public.core_quotes(id)
  on delete restrict on update restrict;

alter table public.core_reservations
  drop constraint if exists core_reservations_status_check;
alter table public.core_reservations
  add constraint core_reservations_status_check
  check (status in ('OPEN','CONSUMED','RELEASED'));

alter table public.core_trades
  drop constraint if exists core_trades_quote_id_fkey;
alter table public.core_trades
  add constraint core_trades_quote_id_fkey
  foreign key (quote_id) references public.core_quotes(id)
  on delete restrict on update restrict;

alter table public.core_trades
  drop constraint if exists core_trades_status_check;
alter table public.core_trades
  add constraint core_trades_status_check
  check (status in ('CREATED','RESERVED','LEDGER_POSTED','SETTLED','FAILED','CANCELLED'));

create unique index if not exists core_trades_one_settled_per_quote
  on public.core_trades (quote_id) where status = 'SETTLED';

create unique index if not exists core_trades_settled_idempotency
  on public.core_trades (user_id, idempotency_key) where status = 'SETTLED';

-- Idempotency: (user_id, operation, key)
alter table public.core_idempotency add column if not exists operation text;
update public.core_idempotency
  set operation = case
    when path like '%deposit%' then 'SANDBOX_DEPOSIT'
    else 'TRADE_EXECUTE'
  end
  where operation is null;
alter table public.core_idempotency alter column operation set not null;

alter table public.core_idempotency
  drop constraint if exists core_idempotency_pkey;
alter table public.core_idempotency
  add primary key (user_id, operation, key);

alter table public.core_idempotency
  drop constraint if exists core_idempotency_status_check;
alter table public.core_idempotency
  add constraint core_idempotency_status_check
  check (status in ('IN_PROGRESS','COMPLETED'));

-- Journal immutability
create or replace function public.core_reject_journal_mutation()
returns trigger as $$
begin
  raise exception 'journals are immutable; use a reversal journal';
end;
$$ language plpgsql;

drop trigger if exists core_journals_immutable_upd on public.core_journals;
create trigger core_journals_immutable_upd
before update or delete on public.core_journals
for each row execute procedure public.core_reject_journal_mutation();

drop trigger if exists core_journal_lines_immutable_upd on public.core_journal_lines;
create trigger core_journal_lines_immutable_upd
before update or delete on public.core_journal_lines
for each row execute procedure public.core_reject_journal_mutation();

create or replace function public.core_assert_journal_balanced()
returns trigger as $$
declare
  unbalanced text;
begin
  select l.asset into unbalanced
  from public.core_journal_lines l
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

drop trigger if exists core_journal_lines_balanced on public.core_journal_lines;
create constraint trigger core_journal_lines_balanced
after insert on public.core_journal_lines
deferrable initially deferred
for each row execute procedure public.core_assert_journal_balanced();
