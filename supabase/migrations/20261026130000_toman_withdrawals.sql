-- Toman withdrawal (برداشت تومانی) only to the IBAN of the user's own verified
-- card. The IBAN is derived from the card by Finnotech facility:card-to-iban at
-- card verification time, so user_bank_cards becomes the single source of bank
-- details and the manual-IBAN bank_accounts table (0 rows, never verified) goes.
-- Money lives only in the ledger: a request moves amount+fee
-- USER_AVAILABLE -> USER_RESERVED (IRR); paid settles the reserve (amount to
-- PLATFORM_CLEARING = cash sent out, fee to PLATFORM_FEE_REVENUE); reject or
-- cancel releases it. This table holds workflow state only.

alter table public.user_bank_cards
  add column if not exists iban text check (iban is null or iban ~ '^IR[0-9]{24}$'),
  add column if not exists iban_bank_name text,
  add column if not exists iban_owners text,
  add column if not exists iban_deposit_status text,
  add column if not exists iban_track_id text,
  add column if not exists iban_checked_at timestamptz;

drop trigger if exists bank_accounts_guard_verification on public.bank_accounts;
drop function if exists public.bank_accounts_guard_verification() cascade;
drop table if exists public.bank_accounts cascade;

create table if not exists public.toman_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  card_id uuid not null references public.user_bank_cards(id) on delete restrict,
  iban text not null check (iban ~ '^IR[0-9]{24}$'),
  bank_name text not null,
  pan_masked text not null,
  amount_irr bigint not null check (amount_irr > 0),
  fee_irr bigint not null default 0 check (fee_irr >= 0),
  status text not null default 'PENDING' check (status in ('PENDING','PAID','REJECTED','CANCELLED')),
  payout_ref text,
  admin_note text,
  decided_by uuid,
  tracking_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'PAID' or payout_ref is not null)
);

create index if not exists toman_withdrawals_user_idx on public.toman_withdrawals (user_id, created_at desc);
create index if not exists toman_withdrawals_status_idx on public.toman_withdrawals (status, created_at);

alter table public.toman_withdrawals enable row level security;
drop policy if exists toman_withdrawals_select_own_or_admin on public.toman_withdrawals;
create policy toman_withdrawals_select_own_or_admin on public.toman_withdrawals
  for select using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.toman_withdrawals from anon, authenticated;
