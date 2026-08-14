-- Admin operations console (Phase 1). Safe additive tables.
-- Existing audit_logs remains the immutable audit sink.

create table if not exists public.admin_kill_switches (
  key text primary key,
  enabled boolean not null,
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_approval_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PENDING_APPROVAL','APPROVED','EXECUTED','REJECTED')),
  maker_id uuid references public.profiles(id) on delete set null,
  checker_id uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_incidents (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'MEDIUM',
  status text not null default 'OPEN'
    check (status in ('OPEN','INVESTIGATING','MITIGATED','RESOLVED')),
  asset text,
  correlation_id text,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null default 'MANUAL_REVIEW',
  severity text not null default 'MEDIUM',
  source text,
  target text,
  expected text,
  actual text,
  delta text,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_kill_switches enable row level security;
alter table public.admin_approval_requests enable row level security;
alter table public.admin_incidents enable row level security;
alter table public.admin_reconciliation_items enable row level security;

drop policy if exists admin_ops_select on public.admin_kill_switches;
create policy admin_ops_ks_select on public.admin_kill_switches
for select using (public.is_admin());

drop policy if exists admin_ops_ks_write on public.admin_kill_switches;
create policy admin_ops_ks_write on public.admin_kill_switches
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_ops_apr_all on public.admin_approval_requests;
create policy admin_ops_apr_all on public.admin_approval_requests
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_ops_inc_all on public.admin_incidents;
create policy admin_ops_inc_all on public.admin_incidents
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_ops_recon_all on public.admin_reconciliation_items;
create policy admin_ops_recon_all on public.admin_reconciliation_items
for all using (public.is_admin()) with check (public.is_admin());

-- Explicit RBAC assignment. profiles.role remains 'admin'|'user' for is_admin().
create table if not exists public.admin_role_assignments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  admin_role text not null check (admin_role in (
    'SUPER_ADMIN','OPERATIONS_ADMIN','FINANCE_ADMIN','KYC_REVIEWER',
    'TREASURY_ADMIN','SUPPORT_AGENT','SECURITY_ADMIN','AUDITOR_READONLY'
  )),
  assigned_by uuid references public.profiles(id) on delete set null,
  reason text,
  assigned_at timestamptz not null default now()
);

alter table public.admin_role_assignments enable row level security;
drop policy if exists admin_ops_roles_all on public.admin_role_assignments;
create policy admin_ops_roles_all on public.admin_role_assignments
for all using (public.is_admin()) with check (public.is_admin());

alter table public.bank_accounts add column if not exists account_status text;
alter table public.bank_accounts add column if not exists verified_at timestamptz;
