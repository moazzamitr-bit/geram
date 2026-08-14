# Geram operational subledger

This is **not** a conventional IFRS general ledger. It is a double-entry operational book for customer claims, platform inventory pools, fees, and cash control.

`core_ledger_accounts.balance` is a **projection/cache**. Immutable `core_journals` + `core_journal_lines` are the auditable financial history. Recompute with `recomputeAccountBalanceFromJournal` / `reconcileAllLedgerBalances`.

## Stored balance

- Always `>= 0` (no negative operational balances).
- **Credit-normal:** `stored_balance += credit - debit`
- **Debit-normal:** `stored_balance += debit - credit`
- Each asset dimension (IRR, GOLD, SILVER, COPPER, TEST_METAL) must balance independently. Rial may not numerically offset metal.

## Account catalog

| AccountCode | Economic meaning | Normal | Stored calc | Negative | Assets | Holder |
|---|---|---|---|---|---|---|
| USER_AVAILABLE | Liability to a customer for spendable IRR or allocated metal | credit | credit − debit | no | IRR + metals | user |
| USER_RESERVED | Customer funds/metal reserved for an in-flight operation | credit | credit − debit | no | IRR + metals | user |
| PLATFORM_AVAILABLE | Platform-controlled free inventory/cash pool available to allocate | credit | credit − debit | no | IRR + metals | platform |
| PLATFORM_RESERVED | Soft-reserved platform inventory against an ACTIVE buy quote | credit | credit − debit | no | metals (IRR unused in MVP) | platform |
| PLATFORM_CLEARING | Intra-platform clearing bucket | credit | credit − debit | no | IRR + metals | platform |
| PLATFORM_FEE_REVENUE | Accumulated trading fee income | credit | credit − debit | no | IRR only | platform |
| PAYMENT_GATEWAY_CLEARING | Inbound PSP / sandbox funding asset | debit | debit − credit | no | IRR only | platform |
| BANK_SETTLEMENT_CLEARING | Outbound bank payout clearing (future) | debit | debit − credit | no | IRR only | platform |
| PLATFORM_CASH_CONTROL | Booked controlled IRR from trading | credit | credit − debit | no | IRR only | platform |
| PLATFORM_OPENING | Opening/seed contra. Runtime Trade/Deposit must never post here | debit | debit − credit | no | IRR + metals | platform |
| PLATFORM_RESTRICTED | Restricted inventory that cannot be sold | credit | credit − debit | no | IRR + metals | platform |

## Why these four are credit-normal

**USER_AVAILABLE** — customer claim. A credit increases what the platform owes the user (deposit, sell proceeds, metal allocation). A debit decreases the claim (buy payment, sell metal).

**PLATFORM_AVAILABLE** — operational *pool*, not a textbook inventory asset. Seeding/inflow credits the pool; reservation/sale debits it. Reservation is then `Dr AVAILABLE / Cr RESERVED` with both credit-normal.

**PLATFORM_FEE_REVENUE** — income. Credits increase recognized fee revenue.

**PLATFORM_CASH_CONTROL** — kept credit-normal so buy (Cr cash book) and sell (Dr cash book) stay consistent with the pool convention used for inventory. A future conventional GL would likely map this to a debit-normal cash asset.

## PLATFORM_OPENING

Postable only for:

- `SYSTEM_SEED` (sandbox / explicit seed flag only; **forbidden in PRODUCTION**)
- `MIGRATION`
- `APPROVED_OPENING_BALANCE`

## Sandbox deposit

```
Dr PAYMENT_GATEWAY_CLEARING  IRR
Cr USER_AVAILABLE            IRR
```

This is **simulated funding**, labeled `SANDBOX_DEPOSIT`. It is not a real PSP settlement. Blocked in PRODUCTION.

## Future conventional GL mapping (not implemented)

| Operational account | Textbook-ish mapping |
|---|---|
| USER_AVAILABLE | Customer liability (credit-normal) — already aligned |
| PLATFORM_AVAILABLE metal | Inventory *asset* would be debit-normal in a GL |
| PLATFORM_FEE_REVENUE | Income (credit-normal) — already aligned |
| PLATFORM_CASH_CONTROL | Cash *asset* would be debit-normal in a GL |
| PAYMENT_GATEWAY_CLEARING | PSP receivable/asset (debit-normal) — already aligned |

Do not redesign working journals solely to match that mapping.

## Treasury honesty

Until the Treasury milestone, public treasury views are `CORE_MILESTONE_PLACEHOLDER`. Customer metal liability is not aggregated here and must not be reported as `0`.
