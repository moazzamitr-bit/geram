-- Competitor-aligned commerce defaults (Wallgold/Gerami/Milli, Oct 2026).
-- All values remain editable in the admin panel (/admin/settings).
--   trade fee 0.5% (Plus 0.35%), no minimum fee; the old 50k/30k toman
--   floors made a 100k–500k ticket cost 10–50%
--   withdrawals and scheduled buys: no extra fee
--   Plus 49k toman/month
--   referral: 15% of invitees' trade fees (Gerami model) instead of fixed bonuses
--   daily caps per user (Milli-style limits page)

update public.platform_settings
set value = value || '{
  "buyFeePercentFree": 0.005,
  "buyFeeMinTomanFree": 0,
  "buyFeePercentPlus": 0.0035,
  "buyFeeMinTomanPlus": 0,
  "sellFeePercentFree": 0.005,
  "sellFeeMinTomanFree": 0,
  "sellFeePercentPlus": 0.0035,
  "sellFeeMinTomanPlus": 0,
  "withdrawFeeTomanFree": 0,
  "withdrawFeeTomanPlus": 0,
  "dcaFeeTomanFree": 0,
  "dcaFeeTomanPlus": 0
}'::jsonb,
    updated_at = now()
where key = 'fees';

update public.platform_settings
set value = value || '{"monthlyPriceToman": 49000, "maxDcaFree": 3}'::jsonb,
    updated_at = now()
where key = 'plus';

update public.platform_settings
set value = value || '{"inviterBonusToman": 0, "inviteeBonusToman": 0, "feeSharePercent": 0.15}'::jsonb,
    updated_at = now()
where key = 'referral';

insert into public.platform_settings (key, value)
values (
  'limits',
  '{"dailyBuyToman": 1000000000, "dailySellToman": 500000000, "dailyWithdrawToman": 50000000}'::jsonb
)
on conflict (key) do nothing;
