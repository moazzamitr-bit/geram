-- Referral: per-user code, ledger-backed fee share. Replaces unused referral_events.
drop table if exists public.referral_events;

create or replace function public.profiles_default_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    loop
      new.referral_code := upper(substr(md5(random()::text || new.id::text), 1, 7));
      exit when not exists (select 1 from public.profiles where referral_code = new.referral_code);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists profiles_default_referral_code on public.profiles;
create trigger profiles_default_referral_code
  before insert on public.profiles
  for each row execute function public.profiles_default_referral_code();

alter table public.profiles disable trigger profiles_guard_privileged_columns;
update public.profiles
  set referral_code = upper(substr(md5(random()::text || id::text), 1, 7))
  where referral_code is null;
alter table public.profiles enable trigger profiles_guard_privileged_columns;

create table if not exists public.referral_rewards (
  trade_id text primary key,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid not null references public.profiles (id) on delete cascade,
  asset text not null,
  side text not null,
  fee_irr bigint not null check (fee_irr >= 0),
  reward_irr bigint not null check (reward_irr > 0),
  share_bps int not null,
  journal_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer_id, created_at desc);

alter table public.referral_rewards enable row level security;
drop policy if exists referral_rewards_own on public.referral_rewards;
create policy referral_rewards_own on public.referral_rewards
  for select using (referrer_id = auth.uid());

update public.platform_settings
  set value = jsonb_build_object('feeSharePercent', coalesce((value->>'feeSharePercent')::numeric, 0.15))
  where key = 'referral';
