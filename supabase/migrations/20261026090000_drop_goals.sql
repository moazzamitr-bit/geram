-- Savings goals (اهداف پس‌انداز) were a demo-only feature with no ledger link.
-- Recurring buys live in savings_plans. The table is empty in production.
drop table if exists public.goals cascade;
