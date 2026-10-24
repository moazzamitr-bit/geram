-- KYC levels: 0 mobile, 1 Shahkar + civil registry, 2 card/IBAN ownership.
-- Users cannot write these columns. Full card numbers are not stored.

alter table public.profiles
  add column if not exists kyc_level smallint not null default 0,
  add column if not exists kyc_bank_verified_at timestamptz,
  add column if not exists kyc_bank_track_id text,
  add column if not exists kyc_bank_mask text;

alter table public.profiles drop constraint if exists profiles_kyc_level_check;
alter table public.profiles
  add constraint profiles_kyc_level_check check (kyc_level in (0, 1, 2));

update public.profiles
set kyc_level = 1
where kyc_status = 'VERIFIED' and kyc_level < 1;

alter table public.bank_accounts
  add column if not exists card_last4 text,
  add column if not exists owner_track_id text;

alter table public.bank_accounts alter column iban drop not null;

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
    or new.kyc_track_id is distinct from old.kyc_track_id
    or new.kyc_level is distinct from old.kyc_level
    or new.kyc_bank_verified_at is distinct from old.kyc_bank_verified_at
    or new.kyc_bank_track_id is distinct from old.kyc_bank_track_id
    or new.kyc_bank_mask is distinct from old.kyc_bank_mask then
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
    new.owner_track_id := null;
  elsif new.verified is distinct from old.verified
    or new.verified_at is distinct from old.verified_at
    or new.account_status is distinct from old.account_status
    or new.owner_track_id is distinct from old.owner_track_id
    or new.iban is distinct from old.iban
    or (old.verified and new.card_last4 is distinct from old.card_last4) then
    raise exception 'forbidden: bank account verification fields' using errcode = '42501';
  end if;
  return new;
end;
$$;
