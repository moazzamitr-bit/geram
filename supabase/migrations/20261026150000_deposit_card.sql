-- The card a user picked for future gateway deposits (one per user).
alter table public.user_bank_cards add column if not exists is_deposit_default boolean not null default false;
create unique index if not exists user_bank_cards_one_deposit_default
  on public.user_bank_cards (user_id) where is_deposit_default;
