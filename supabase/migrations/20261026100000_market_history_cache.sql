-- Last good TGJU history per instrument:range, so a fresh deploy or a slow
-- upstream (10–60 s) never blocks chart requests. Server-only (service role).
create table if not exists public.market_history_cache (
  key text primary key,
  points jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.market_history_cache enable row level security;
revoke all on public.market_history_cache from anon, authenticated;
