-- Finnotech Shahkar KYC. Users cannot write these columns (service role only).
-- Raw OAuth tokens are never stored. The national code lives on the profile
-- so a code cannot be verified twice; logs and audit rows keep only a mask.
-- kyc_challenges holds the in-progress Shahkar SMS until it expires.

alter table public.profiles
  add column if not exists national_code text,
  add column if not exists father_name text not null default '',
  add column if not exists kyc_birth_date text,
  add column if not exists kyc_verified_at timestamptz,
  add column if not exists kyc_checked_at timestamptz,
  add column if not exists kyc_provider text,
  add column if not exists kyc_track_id text;

create unique index if not exists profiles_national_code_unique
  on public.profiles (national_code)
  where national_code is not null;

create table if not exists public.kyc_challenges (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  national_code text not null,
  birth_date text not null,
  inquiry_track_id text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  shahkar_matched boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.kyc_challenges enable row level security;

alter table public.auth_otp_codes
  add column if not exists provider text not null default 'local',
  add column if not exists provider_ref text;

-- Extend the lockdown guard. Do not edit the already-applied migration.
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
