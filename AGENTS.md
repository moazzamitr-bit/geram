# AGENTS.md — read this before changing anything

Geram (گرم) is a Persian/RTL platform for buying and selling 18k gold, silver and copper.
Stack: Next.js 15 (App Router) + React 19 + TypeScript, Tailwind v4, self-hosted Supabase
(Postgres + GoTrue), a server-side double-entry ledger in `lib/core/`.

The owner is not a developer. Explain changes in plain Persian, keep changes small,
and never leave production broken.

---

## 1. Where things run (state on 2026-10-23)

| What | Where |
|---|---|
| Live site | https://geram.co (ArvanCloud CDN, HTTPS at the edge, origin HTTPS) |
| Server | Ubuntu VM `80.91.208.136`, app + Caddy in Docker (`deploy/docker-compose.yml`) |
| Supabase | **Self-hosted** on the same server (`supabase-*` containers, gateway on host port 8000). The browser reaches it at `https://geram.co/sb` (Caddy proxies only API paths). The old cloud project is no longer used. |
| Code on the server | `/opt/geram`, a clean checkout of branch **`fix/p0-security`** |
| Settings / secrets | `/opt/geram/.env.production` on the server only (root-only). Never in git. |
| Execution mode | `SANDBOX` (simulated deposits; no real payment rails yet) |
| Login | `AUTH_METHOD=password` (mobile + password, number NOT verified). SMS OTP code exists but is off. |

## 2. Hard rules

1. **Never edit code directly on the server.** Every change goes: edit in the repo → tests pass →
   commit → push to `fix/p0-security` → owner runs the installer on the server:
   `GERAM_BRANCH=fix/p0-security bash <(curl -fsSL https://raw.githubusercontent.com/moazzamitr-bit/geram/fix/p0-security/deploy/install.sh)`
   The installer hard-resets `/opt/geram` to GitHub, so server-side edits are wiped anyway.
2. **Never commit secrets** (API keys, service-role key, DB URL, passwords). The repo is PUBLIC.
   New settings go in `.env.example` (empty value) and are set on the server in `.env.production`.
3. **Never change money balances directly.** Balances are ledger projections
   (`core_ledger_accounts` updated only by `postJournal` in `lib/core/ledger.ts`). No
   `UPDATE wallets ...`, no "edit balance" admin button. Closed-beta wallet IRR credit is one
   admin action: `FINANCIAL_ADJUSTMENT` posts `APPROVED_OPENING_BALANCE` to `USER_AVAILABLE`
   immediately and writes an audit log (`app/api/admin/approvals`). Opening metal inventory and
   other corrections stay on the maker-checker queue. The legacy `wallets` table is read-only.
4. **Keep the RLS lockdown.** `supabase/migrations/20261021120000_rls_lockdown.sql` stops users from
   changing `profiles.role/kyc_status/plan_*`, verifying their own IBAN, forging support replies or
   choosing referral bonuses. Any new user-writable table needs RLS + a guard for privileged columns.
   Inside SECURITY DEFINER functions never use `current_user` for privilege checks (it is the owner);
   use `public.is_privileged()`.
5. **Migrations**: add a new file in `supabase/migrations/` (timestamped, idempotent: `if not exists`,
   `drop ... if exists`). Apply on the server with
   `bash <(curl -fsSL .../deploy/check-db.sh) --apply` and verify with `check-db.sh`.
   Never edit an already-applied migration.
6. **Docker**: the build WORKDIR must NOT be `/app` (it made Next.js pick `app/app/layout.tsx` as the
   root layout → blank site). Keep `/srv/geram`.
7. **No build-time downloads from blocked services** (server is in Iran): no `next/font/google`
   (the font is local in `app/fonts/`), no new external fetches during `next build`.
8. **Don't hide errors to make a build pass.** `useAuth` must keep throwing outside `AuthProvider`.
   If the build fails, find the cause.
9. **Before every commit**: `npx tsc --noEmit`, `npx eslint app lib components tests`, `npm test`
   all clean; `npm run build` for anything touching routes/layouts.
10. Do not merge to `main` or deploy without the owner's OK. `main` is behind `fix/p0-security`.

## 3. Map of the code

| Area | Files |
|---|---|
| Ledger / trading engine | `lib/core/engine.ts` (quotes, trades, idempotency, kill switches, reservations), `ledger.ts`, `pg-store.ts`, `store.ts` (memory, tests) |
| Core API | `app/api/core/*` (quotes, trades, wallet, transactions, limits, readiness) |
| Fees / commerce settings | `lib/commerce/types.ts` (defaults), `platform_settings` table, admin form `components/admin/CommerceSettingsForm.tsx`; per-user fees in `lib/core/user-fees.ts` |
| Daily limits | `lib/core/limits.ts`, page `app/app/profile/limits` |
| Auth | `lib/auth/method.ts` (AUTH_METHOD), `app/api/auth/{register,password-login,config}`, OTP: `lib/auth/otp.ts` (sms.ir + Kavenegar), `app/api/auth/{otp/request,phone-login}`; client `lib/auth/auth-context.tsx`; middleware gates `/app` and `/admin` |
| Admin | `app/admin/*`, RBAC `lib/admin/rbac.ts`, approvals + opening inventory `app/api/admin/approvals/route.ts` |
| Deploy | `Dockerfile`, `deploy/{install.sh,docker-compose.yml,Caddyfile,check-db.sh,create-admin.sh,set-sms.sh}`, guide `docs/DEPLOY.md` |
| Tests | `tests/core/*` (vitest, PGlite for Postgres) |

## 4. Known open items

- **Trading needs opening inventory**: platform metal starts at 0. Two admins (maker + checker)
  register real stock in Admin → تأیید دو مرحله‌ای → ثبت موجودی اولیه خزانه, then Approve + Execute.
  Admins are created with `deploy/create-admin.sh`.
- **Wallet credit is single-admin**: واریز or the user page posts rial balance immediately.
  A second approver is not required. User self-deposit stays off unless `SANDBOX_DEPOSIT_ENABLED`.
- **SMS OTP**: sms.ir rejects templates without eNamad. Template `123456` (sandbox) only reaches the
  panel owner's number. Before setting `AUTH_METHOD=otp`: the OTP service-role path rotates the user's
  password on every login — switch it to `admin.generateLink` + `verifyOtp` first, or password
  users will be locked out.
- Password mode does not verify the number → require OTP + KYC (Shahkar) before real money.
- Not built yet: payment gateway deposits, bank withdrawals (Paya/Satna), Shahkar KYC, supplier/custody
  contracts, executable price source (TGJU is public data), eNamad/licence.
- `lib/data.ts` → `contactInfo` still has placeholder phone/address; replace with real company data.
- Unmerged `backup/treasury-mm-20260912` branch: has an unauthenticated `/api/treasury/book-trade`.
  Do not merge as is.

## 5. How to check the live system without touching it

- `https://geram.co/api/health` → 200
- `https://geram.co/api/core/readiness` → `databaseBacked`, `serviceRoleConfigured`, `phoneAuthReady`
- `https://geram.co/api/auth/config` → current login method
