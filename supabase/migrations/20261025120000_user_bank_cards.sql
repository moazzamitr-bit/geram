-- Bank cards verified against the owner's national code (Finnotech
-- kyc:card-owner-verification). This table is the only record of card
-- ownership; the profile/bank_accounts card columns from 1024 are dropped.
-- Full card numbers are never stored: a masked PAN for display and a salted
-- SHA-256 hash for duplicate detection.

create table if not exists public.user_bank_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pan_masked text not null,
  pan_hash text not null,
  bank_code text,
  bank_name text not null,
  status text not null default 'VERIFIED' check (status in ('VERIFIED', 'DISABLED')),
  owner_track_id text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, pan_hash)
);

create index if not exists user_bank_cards_user_idx on public.user_bank_cards (user_id);

alter table public.user_bank_cards enable row level security;

drop policy if exists user_bank_cards_select_own_or_admin on public.user_bank_cards;
create policy user_bank_cards_select_own_or_admin on public.user_bank_cards
  for select using (user_id = auth.uid() or public.is_admin());
-- No insert/update/delete policy: only the server (service role) writes, after Finnotech matches.

alter table public.profiles
  drop column if exists kyc_level,
  drop column if exists kyc_bank_verified_at,
  drop column if exists kyc_bank_track_id,
  drop column if exists kyc_bank_mask;

alter table public.bank_accounts
  drop column if exists card_last4,
  drop column if exists owner_track_id;

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.kyc_status is distinct from old.kyc_status
    or new.plan_tier is distinct from old.plan_tier
    or new.plan_expires_at is distinct from old.plan_expires_at
    or new.referral_code is distinct from old.referral_code
    or new.phone is distinct from old.phone
    or new.email is distinct from old.email
    or new.id is distinct from old.id
    or new.national_code is distinct from old.national_code
    or new.father_name is distinct from old.father_name
    or new.kyc_birth_date is distinct from old.kyc_birth_date
    or new.kyc_verified_at is distinct from old.kyc_verified_at
    or new.kyc_checked_at is distinct from old.kyc_checked_at
    or new.kyc_provider is distinct from old.kyc_provider
    or new.kyc_track_id is distinct from old.kyc_track_id then
    raise exception 'forbidden: privileged profile column' using errcode = '42501';
  end if;
  if old.kyc_status = 'VERIFIED'
    and (new.first_name is distinct from old.first_name
      or new.last_name is distinct from old.last_name) then
    raise exception 'forbidden: verified name is immutable' using errcode = '42501';
  end if;
  if new.referred_by is distinct from old.referred_by
    and (old.referred_by is not null or new.referred_by = new.id) then
    raise exception 'forbidden: referred_by is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.bank_accounts_guard_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verified := false;
    new.verified_at := null;
    new.account_status := null;
  elsif new.verified is distinct from old.verified
    or new.verified_at is distinct from old.verified_at
    or new.account_status is distinct from old.account_status
    or new.iban is distinct from old.iban then
    raise exception 'forbidden: bank account verification fields' using errcode = '42501';
  end if;
  return new;
end;
$$;
