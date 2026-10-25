-- Physical withdrawal (برداشت فیزیکی). Replaces the unused delivery_requests
-- table (0 rows; the old UI never created orders). The metal itself lives only
-- in the ledger: a request moves weight+fee USER_AVAILABLE -> USER_RESERVED;
-- delivery or rejection settles that reserve. These rows hold workflow state only.

drop trigger if exists delivery_requests_guard_status on public.delivery_requests;
drop function if exists public.delivery_requests_guard_status();
drop table if exists public.delivery_requests;

create table if not exists public.physical_products (
  id uuid primary key default gen_random_uuid(),
  asset text not null check (asset in ('GOLD','SILVER','COPPER')),
  kind text not null check (kind in ('COIN','BAR')),
  title text not null,
  weight_ug bigint not null check (weight_ug > 0),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.physical_products enable row level security;
drop policy if exists physical_products_read on public.physical_products;
create policy physical_products_read on public.physical_products for select using (true);

create table if not exists public.physical_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.physical_products(id),
  product_title text not null,
  asset text not null check (asset in ('GOLD','SILVER','COPPER')),
  quantity integer not null check (quantity between 1 and 100),
  weight_ug bigint not null check (weight_ug > 0),
  fee_ug bigint not null check (fee_ug >= 0),
  cost_removed_irr bigint not null default 0,
  branch_id text not null,
  branch_name text not null,
  pickup_date date not null,
  pickup_slot text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','DELIVERED','REJECTED','CANCELLED')),
  tracking_code text not null unique,
  admin_note text,
  decided_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_withdrawals_user_idx on public.physical_withdrawals (user_id, created_at desc);
create index if not exists physical_withdrawals_status_idx on public.physical_withdrawals (status, created_at);

alter table public.physical_withdrawals enable row level security;
drop policy if exists physical_withdrawals_select_own_or_admin on public.physical_withdrawals;
create policy physical_withdrawals_select_own_or_admin on public.physical_withdrawals
  for select using (user_id = auth.uid() or public.is_admin());
-- No client writes: the server posts the ledger reserve and the row in one transaction.

insert into public.physical_products (asset, kind, title, weight_ug, sort)
select * from (values
  ('GOLD','BAR','شمش طلای ۱ گرمی (۱۸ عیار)', 1000000::bigint, 10),
  ('GOLD','BAR','شمش طلای ۵ گرمی (۱۸ عیار)', 5000000::bigint, 20),
  ('GOLD','BAR','شمش طلای ۱۰ گرمی (۱۸ عیار)', 10000000::bigint, 30),
  ('SILVER','BAR','شمش نقره ۱۰۰ گرمی', 100000000::bigint, 40)
) v(asset, kind, title, weight_ug, sort)
where not exists (select 1 from public.physical_products);

insert into public.platform_settings (key, value)
values ('physical', '{"feePercent":0.01,"branches":[{"id":"tehran","name":"دفتر مرکزی گرم - تهران","address":"آدرس دقیق پس از تأیید درخواست پیامک می‌شود","hours":"شنبه تا چهارشنبه ۱۰ تا ۱۷"}],"slots":["۱۰ تا ۱۲","۱۲ تا ۱۴","۱۴ تا ۱۷"],"minLeadDays":1}'::jsonb)
on conflict (key) do nothing;
