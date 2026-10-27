-- Informational competitor 18k gold prices (toman/gram). Not used by trading or price guards.
create table if not exists public.competitor_price_snapshots (
  id bigserial primary key,
  competitor text not null,
  buy_toman bigint not null check (buy_toman > 0),
  sell_toman bigint not null check (sell_toman > 0),
  observed_at timestamptz not null default now()
);
create index if not exists competitor_price_snapshots_observed_idx on public.competitor_price_snapshots (observed_at desc);
alter table public.competitor_price_snapshots enable row level security;
-- No policies: service role only (admin pages read server-side).
revoke all on public.competitor_price_snapshots from anon, authenticated;
