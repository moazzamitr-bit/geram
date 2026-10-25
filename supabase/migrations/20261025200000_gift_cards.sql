-- Gift cards (کارت هدیه): sender's metal is escrowed in USER_RESERVED until a
-- verified recipient redeems it, the sender cancels it, or it expires.
create table if not exists public.gift_cards (
  id uuid primary key,
  code text not null unique,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  recipient_id uuid references public.profiles (id) on delete restrict,
  asset text not null check (asset in ('GOLD', 'SILVER', 'COPPER')),
  weight_ug bigint not null check (weight_ug > 0),
  cost_removed_irr bigint not null default 0,
  message text check (char_length(message) <= 140),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REDEEMED', 'CANCELLED', 'EXPIRED')),
  expires_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gift_cards_sender_idx on public.gift_cards (sender_id, created_at desc);
create index if not exists gift_cards_recipient_idx on public.gift_cards (recipient_id, settled_at desc);
create index if not exists gift_cards_expiry_idx on public.gift_cards (expires_at) where status = 'ACTIVE';

alter table public.gift_cards enable row level security;
create policy gift_cards_party_read on public.gift_cards
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());
