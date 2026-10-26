-- Physical catalog matching what Iranian platforms actually hand out (Wallgold,
-- Gerami, Oct 2026): 18k (750) gold bars from Zarbod and Parsian, and 999 silver
-- granules. Each product carries its own minting/packing fee (lighter bars cost
-- more per gram), replacing the single global feePercent. The old placeholder
-- products are deactivated, not deleted (past withdrawals reference them).

alter table public.physical_products add column if not exists fee_percent numeric(6,4)
  check (fee_percent is null or (fee_percent >= 0 and fee_percent <= 0.2));
alter table public.physical_products add column if not exists brand text;
alter table public.physical_products drop constraint if exists physical_products_kind_check;
alter table public.physical_products add constraint physical_products_kind_check
  check (kind in ('COIN','BAR','GRANULE'));

update public.physical_products set active = false where brand is null;

insert into public.physical_products (asset, kind, brand, title, weight_ug, fee_percent, sort)
select v.* from (values
  ('GOLD','BAR','زربد','شمش طلای ۱۸ عیار زربد ۰٫۵ گرم', 500000::bigint, 0.13::numeric, 10),
  ('GOLD','BAR','زربد','شمش طلای ۱۸ عیار زربد ۱ گرم', 1000000::bigint, 0.07, 20),
  ('GOLD','BAR','زربد','شمش طلای ۱۸ عیار زربد ۲٫۵ گرم', 2500000::bigint, 0.04, 30),
  ('GOLD','BAR','زربد','شمش طلای ۱۸ عیار زربد ۵ گرم', 5000000::bigint, 0.03, 40),
  ('GOLD','BAR','زربد','شمش طلای ۱۸ عیار زربد ۱۰ گرم', 10000000::bigint, 0.018, 50),
  ('GOLD','BAR','زربد','شمش طلای ۱۸ عیار زربد ۲۰ گرم', 20000000::bigint, 0.015, 60),
  ('GOLD','BAR','پارسیان','شمش طلای ۱۸ عیار پارسیان ۰٫۳ گرم', 300000::bigint, 0.015, 70),
  ('GOLD','BAR','پارسیان','شمش طلای ۱۸ عیار پارسیان ۰٫۵ گرم', 500000::bigint, 0.012, 80),
  ('GOLD','BAR','پارسیان','شمش طلای ۱۸ عیار پارسیان ۱ گرم', 1000000::bigint, 0.01, 90),
  ('GOLD','BAR','پارسیان','شمش طلای ۱۸ عیار پارسیان ۲ گرم', 2000000::bigint, 0.009, 100),
  ('SILVER','GRANULE','گرم','ساچمه نقره ۹۹۹ - ۱۰ گرم', 10000000::bigint, 0.005, 200),
  ('SILVER','GRANULE','گرم','ساچمه نقره ۹۹۹ - ۵۰ گرم', 50000000::bigint, 0.005, 210),
  ('SILVER','GRANULE','گرم','ساچمه نقره ۹۹۹ - ۱۰۰ گرم', 100000000::bigint, 0.005, 220)
) v(asset, kind, brand, title, weight_ug, fee_percent, sort)
where not exists (select 1 from public.physical_products p where p.title = v.title);

update public.platform_settings
set value = jsonb_set(value, '{branches}', '[{"id":"tehran","name":"شعبه تهران - پارک‌وی","address":"تهران، خیابان ولیعصر، نرسیده به چهارراه پارک‌وی، کوچه مهناز، پلاک ۲۷","hours":"شنبه تا چهارشنبه ۱۰ تا ۱۷"}]'::jsonb),
    updated_at = now()
where key = 'physical';
