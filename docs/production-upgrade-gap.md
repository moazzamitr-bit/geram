# Production upgrade gap — Legacy UI → Financial Core

**Date:** 2026-08-14  
**UI freeze:** customer presentation on `cursor/silver-copper-trading-fcc2` is approved. This audit maps data sources only.  
**Financial-core reuse:** no separate Geram financial-core repo was present locally. Concepts below are implemented in-tree under `lib/core/` (not a third product UI).

---

## Legend

| Tag | Meaning |
|---|---|
| DemoStore | `lib/app/demo-store.tsx` client mutations / localStorage |
| Supabase direct | browser `platform-sync` upserts |
| Next API | existing `app/api/*` |
| static | hardcoded / seed |
| **Core API** | target `app/api/core/*` + `lib/core-api` |

---

## Feature map

| Feature | CURRENT | TARGET (this milestone unless noted) |
|---|---|---|
| **Dashboard** | DemoStore metals + rial + `unrealizedPnl`; prices from `/api/market/price` | Core `GET /api/core/portfolio` + market read API. Layout unchanged. |
| **Market** | Next `/api/market/price` + history; alerts DemoStore | Keep visual market. Prices via Core market facade (TGJU, `TEMPORARY_PUBLIC`). Alerts stay DemoStore behind `ALERT_AUTOBUY_ENABLED=false` for money. |
| **Buy** | Client `buyQuote` + `buyMetal`; 30s timer cosmetic | Core `POST /quotes` + `POST /trades`. Same form. |
| **Sell** | Client `sellQuote` + `sellMetal` | Core quotes/trades. Bank destination not in this milestone (wallet-funded sell only; UI dest wallet). |
| **Portfolio** | DemoStore + client PnL | Core portfolio projection from Ledger + WAC. |
| **Wallet** | DemoStore rialAvailable/pending | Core `GET /wallet` (Ledger USER_AVAILABLE / USER_RESERVED). |
| **Deposit** | `store.deposit` instant | Core `POST /sandbox/deposit` only if `GERAM_EXECUTION_MODE=SANDBOX`. Blocked in PRODUCTION. |
| **Withdrawal** | DemoStore pending + KYC | **Deferred.** UI remains; action returns sandbox-disabled / coming soon unless flagged. No DemoStore money mutation. |
| **Transactions** | DemoStore list + optional supabase upsert | Core `GET /transactions` (trades + sandbox deposits). |
| **Transaction Detail** | DemoStore by id | Core `GET /transactions/:id` |
| **KYC** | Client `setKycStatus` simulate VERIFIED | **Deferred** (Phase 18). UI freeze; no new redesign. |
| **Bank Accounts** | DemoStore | **Deferred** |
| **Trust** | Infers from user gold | **Deferred** (Phase 19). Must not infer custody from ledger. |
| **Goals** | DemoStore | Flag `GOALS_ENABLED`; no ledger writes this milestone |
| **DCA** | DemoStore + cron gold wallet updates | Flag `DCA_ENABLED=false`; cron must not mutate ledger |
| **Alerts** | DemoStore + cron auto-buy gold | `ALERT_AUTOBUY_ENABLED=false` |
| **Referral** | Next `/api/referral/apply` | `REFERRAL_ENABLED`; no wallet credit this milestone |
| **Geram Plus** | sandbox activate | `GERAM_PLUS_ENABLED`; fees still snapshotted at quote time from settings |
| **Delivery** | DemoStore gold deduct | `PHYSICAL_REDEMPTION_ENABLED=false` |
| **Admin** | Lists + fee JSON | Unchanged visually. No Edit Wallet. Fees read by quote engine. |

---

## DemoStore financial mutations to retire

`buyMetal`, `sellMetal`, `buyGold`, `sellGold`, `deposit`, `withdraw`, `persistWallet` / `wallets_update_own`.

Allowed to remain as UI helpers: notifications, tickets, goals (non-money), pin, market price display cache.

---

## Canonical mapping (UI instrument → AssetSpec)

| UI `instrument` query | Asset code | Spec |
|---|---|---|
| `gold18` | `GOLD` | Iran 18k / 750 |
| `silver925` (legacy query key, frozen) | `SILVER` | **999** — no 925 pricing |
| `copper` | `COPPER` | configurable; theoretical LME×FX until supplier executable |

---

## Milestone boundary

In scope: audit, API client, AssetSpec, IRR+µg, Ledger, Quote, Trade SM, idempotency, outbox, wallet-funded buy/sell all three metals, UI data swap, drop user wallet writes, tests.

Out of scope: real PSP, payout, custody, physical delivery, DCA, referral payouts, Plus billing, Shahkar KYC.

---

## Milestone 1 status (2026-08-14)

Implemented in-tree under `lib/core/` + `app/api/core/*`. Customer screens were not redesigned.

| Item | Status |
|---|---|
| Canonical IRR + µg | `lib/core/money.ts` |
| AssetSpec GOLD / SILVER 999 / COPPER / TEST_METAL | `lib/core/assets.ts` |
| Ledger + journals | `lib/core/ledger.ts` |
| Server Quote + soft reservation | `FinancialCore.issueQuote` |
| Trade SM + idempotency + outbox | `FinancialCore.executeTrade` |
| Wallet-funded buy/sell 3 metals | generic ledger |
| UI data swap | Buy/Sell/Portfolio/Wallet read ledger via DemoStore cache |
| Direct wallet writes | `persistWallet` no-op; RLS drops `wallets_update_own` / `wallets_insert_own` |
| Tests | vitest unit + concurrency + PGlite |

**Runtime:** `getFinancialCore()` uses Postgres (`DATABASE_URL` / `SUPABASE_DB_URL`) when set. `GERAM_EXECUTION_MODE=PRODUCTION` fails closed without a database URL. SANDBOX may use in-memory ledger for local/dev. PGlite integration tests cover the SQL store.
