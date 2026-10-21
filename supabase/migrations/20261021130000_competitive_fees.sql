-- Competitive fee schedule: 0.5% (Plus 0.35%) with no minimum fee.
-- The old 50k/30k toman floors made a 100k–500k ticket cost 10–50%.
-- Only trade-fee keys change; withdraw/DCA fees keep their current values.

update public.platform_settings
set value = value || '{
  "buyFeePercentFree": 0.005,
  "buyFeeMinTomanFree": 0,
  "buyFeePercentPlus": 0.0035,
  "buyFeeMinTomanPlus": 0,
  "sellFeePercentFree": 0.005,
  "sellFeeMinTomanFree": 0,
  "sellFeePercentPlus": 0.0035,
  "sellFeeMinTomanPlus": 0
}'::jsonb,
    updated_at = now()
where key = 'fees';
