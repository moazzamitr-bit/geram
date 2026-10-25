-- Savings plan (طرح پس‌انداز): recurring buys through the normal quote → trade ledger path.
-- scheduled_purchases had no rows; reshape it instead of adding a second table.
delete from public.scheduled_purchases;
alter table public.scheduled_purchases drop column if exists next_run;
alter table public.scheduled_purchases
  add column if not exists asset text not null default 'GOLD',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists fail_streak int not null default 0;
alter table public.scheduled_purchases alter column next_run_at set not null;
alter table public.scheduled_purchases drop constraint if exists scheduled_purchases_cadence_check;
alter table public.scheduled_purchases drop constraint if exists scheduled_purchases_status_check;
alter table public.scheduled_purchases drop constraint if exists scheduled_purchases_asset_check;
alter table public.scheduled_purchases drop constraint if exists scheduled_purchases_amount_check;
alter table public.scheduled_purchases
  add constraint scheduled_purchases_cadence_check check (cadence in ('DAILY', 'WEEKLY', 'MONTHLY')),
  add constraint scheduled_purchases_status_check check (status in ('ACTIVE', 'PAUSED', 'CANCELLED')),
  add constraint scheduled_purchases_asset_check check (asset in ('GOLD', 'SILVER', 'COPPER')),
  add constraint scheduled_purchases_amount_check check (amount_toman > 0);
create index if not exists scheduled_purchases_due_idx on public.scheduled_purchases (next_run_at) where status = 'ACTIVE';

create table if not exists public.scheduled_purchase_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.scheduled_purchases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  run_for timestamptz not null,
  status text not null check (status in ('RUNNING', 'SUCCESS', 'FAILED')),
  trade_id text,
  amount_irr bigint,
  weight_ug bigint,
  fee_irr bigint,
  error text,
  created_at timestamptz not null default now(),
  unique (plan_id, run_for)
);
create index if not exists scheduled_purchase_runs_user_idx on public.scheduled_purchase_runs (user_id, created_at desc);

-- Plans and runs are written by the server only (ledger + verification checks).
alter table public.scheduled_purchases enable row level security;
alter table public.scheduled_purchase_runs enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'scheduled_purchases' loop
    execute format('drop policy %I on public.scheduled_purchases', p.policyname);
  end loop;
end $$;
create policy scheduled_purchases_own_read on public.scheduled_purchases for select using (user_id = auth.uid());
create policy scheduled_purchase_runs_own_read on public.scheduled_purchase_runs for select using (user_id = auth.uid());
