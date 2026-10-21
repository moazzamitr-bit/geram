-- P0 security: users may own a row without owning every column on it.
-- Before this migration any authenticated user could, through the public
-- anon key, set profiles.role='admin' (→ SUPER_ADMIN), self-verify KYC,
-- grant themselves Plus, mark their own IBAN verified, forge support replies
-- and choose their own referral bonus. Privileged changes now require an
-- admin session or the service role.

-- Privileged = service-role API key, a direct database connection (migrations,
-- the financial core's pg pool; PostgREST always sets JWT claims, so their
-- absence means "not via the public API"), or an admin session.
-- Do not use current_user here: inside SECURITY DEFINER it is the owner.
create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') = ''
    or public.is_admin();
$$;

-- Profiles: only display fields and onboarding are user-editable.
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
    or new.id is distinct from old.id then
    raise exception 'forbidden: privileged profile column' using errcode = '42501';
  end if;
  -- referred_by may be set once, from empty, and never to oneself.
  if new.referred_by is distinct from old.referred_by
    and (old.referred_by is not null or new.referred_by = new.id) then
    raise exception 'forbidden: referred_by is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
before update on public.profiles
for each row execute function public.profiles_guard_privileged_columns();

-- Bank accounts: verification is an operator decision, never the user's.
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

drop trigger if exists bank_accounts_guard_verification on public.bank_accounts;
create trigger bank_accounts_guard_verification
before insert or update on public.bank_accounts
for each row execute function public.bank_accounts_guard_verification();

-- Legacy transactions are a server-side record; users only read them.
drop policy if exists transactions_insert_own_or_admin on public.transactions;
create policy transactions_insert_admin on public.transactions
for insert with check (public.is_admin());
drop policy if exists transactions_update_own_or_admin on public.transactions;
create policy transactions_update_admin on public.transactions
for update using (public.is_admin()) with check (public.is_admin());

-- Delivery requests: users create REQUESTED rows; status and fee are operator-owned.
create or replace function public.delivery_requests_guard_status()
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
    new.status := 'REQUESTED';
  elsif new.status is distinct from old.status
    or new.fee_toman is distinct from old.fee_toman
    or new.weight_grams is distinct from old.weight_grams then
    raise exception 'forbidden: delivery status/fee' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_requests_guard_status on public.delivery_requests;
create trigger delivery_requests_guard_status
before insert or update on public.delivery_requests
for each row execute function public.delivery_requests_guard_status();

-- Support: a user can only speak as the user.
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
for insert with check (
  public.is_admin()
  or (
    sender = 'user'
    and exists (
      select 1 from public.support_tickets st
      where st.id = ticket_id and st.user_id = auth.uid()
    )
  )
);

-- Referral events: bonuses and status come from platform settings, not the client.
create or replace function public.referral_events_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg jsonb;
begin
  if public.is_privileged() then
    return new;
  end if;
  select value into cfg from public.platform_settings where key = 'referral';
  new.status := 'PENDING';
  new.paid_at := null;
  new.inviter_bonus_toman := coalesce((cfg ->> 'inviterBonusToman')::bigint, 0);
  new.invitee_bonus_toman := coalesce((cfg ->> 'inviteeBonusToman')::bigint, 0);
  if new.inviter_id = new.invitee_id then
    raise exception 'forbidden: self referral' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists referral_events_guard_insert on public.referral_events;
create trigger referral_events_guard_insert
before insert on public.referral_events
for each row execute function public.referral_events_guard_insert();
