-- Allow users to update their own wallet balances (client/app sync).
-- Financial writes should move to RPC/edge later; this unblocks live mode.

drop policy if exists wallets_update_own on public.wallets;
create policy wallets_update_own on public.wallets
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists wallets_insert_own on public.wallets;
create policy wallets_insert_own on public.wallets
for insert with check (user_id = auth.uid());
