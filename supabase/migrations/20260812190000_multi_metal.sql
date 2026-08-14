-- Multi-metal wallets: silver + copper alongside gold
-- Safe to re-run (IF NOT EXISTS / additive columns)

alter table public.wallets
  add column if not exists silver_mg bigint not null default 0
    check (silver_mg >= 0);

alter table public.wallets
  add column if not exists copper_mg bigint not null default 0
    check (copper_mg >= 0);

alter table public.wallets
  add column if not exists avg_buy_price_silver_toman bigint not null default 0;

alter table public.wallets
  add column if not exists avg_buy_price_copper_toman bigint not null default 0;

-- transactions.gold_mg stores milligrams of the instrument metal
alter table public.transactions
  add column if not exists instrument text not null default 'gold18';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_instrument_check'
  ) then
    alter table public.transactions
      add constraint transactions_instrument_check
      check (instrument in ('gold18', 'silver925', 'copper'));
  end if;
end $$;

create index if not exists transactions_user_instrument_idx
  on public.transactions (user_id, instrument, created_at desc);

create index if not exists market_prices_instrument_observed_idx
  on public.market_prices (instrument, observed_at desc);
