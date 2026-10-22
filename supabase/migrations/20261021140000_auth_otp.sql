-- One-time login codes for real SMS OTP. Only the server (service role)
-- touches this table: RLS is on with no policies, so the public API sees nothing.
-- Codes are stored as salted SHA-256 hashes, never in plain text.

create table if not exists public.auth_otp_codes (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_count integer not null default 1,
  window_started_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);

alter table public.auth_otp_codes enable row level security;
