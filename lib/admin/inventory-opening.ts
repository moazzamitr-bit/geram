import { PRODUCTION_ASSETS, type AssetCode } from "@/lib/core/assets";
import { gramsToUg, tomanToIrr, type Microgram } from "@/lib/core/money";
import { parseIdempotencyKey } from "@/lib/admin/wallet-credit";

export type OpeningAsset = AssetCode | "IRR";
export type OpeningAccountCode = "PLATFORM_AVAILABLE" | "PLATFORM_CASH_CONTROL";
export type InventoryRecordPlan = "insert" | "mark_executed" | "already_recorded";

export type OpeningSpec = {
  asset: "GOLD" | "SILVER" | "COPPER" | "IRR";
  accountCode: OpeningAccountCode;
  ledgerAsset: OpeningAsset;
  ledgerAmount: bigint;
  amountLabel: string;
};

export function inventoryOpeningRefId(idempotencyKey: string) {
  return `inventory-opening:${idempotencyKey}`;
}

/**
 * Metal is grams (up to 6 decimal places, posted in micrograms).
 * Operating cash is a whole toman amount, posted as IRR.
 */
export function parseOpeningAmount(assetRaw: string, amountRaw: string): OpeningSpec | null {
  const asset = assetRaw.trim().toUpperCase();
  const amountLabel = amountRaw.trim();
  if (asset === "IRR") {
    if (!/^\d+$/.test(amountLabel)) return null;
    const toman = Number(amountLabel);
    if (!Number.isSafeInteger(toman) || toman <= 0) return null;
    return {
      asset: "IRR",
      accountCode: "PLATFORM_CASH_CONTROL",
      ledgerAsset: "IRR",
      ledgerAmount: tomanToIrr(toman),
      amountLabel,
    };
  }
  if (!PRODUCTION_ASSETS.includes(asset as AssetCode)) return null;
  if (!/^\d+(\.\d{1,6})?$/.test(amountLabel)) return null;
  const grams = Number(amountLabel);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  let ledgerAmount: Microgram;
  try {
    ledgerAmount = gramsToUg(grams);
  } catch {
    return null;
  }
  if (ledgerAmount <= 0n) return null;
  return {
    asset: asset as OpeningSpec["asset"],
    accountCode: "PLATFORM_AVAILABLE",
    ledgerAsset: asset as AssetCode,
    ledgerAmount,
    amountLabel,
  };
}

export function parseStoredInventoryOpening(payload: unknown):
  | ({ ok: true; idempotencyKey: string; refId: string } & OpeningSpec)
  | { ok: false; error: string } {
  const body = (payload ?? {}) as Record<string, unknown>;
  const idempotencyKey = parseIdempotencyKey(String(body.idempotencyKey ?? ""));
  if (!idempotencyKey) return { ok: false, error: "idempotency_key_required" };
  const parsed = parseOpeningAmount(String(body.asset ?? ""), String(body.amount ?? ""));
  if (!parsed) return { ok: false, error: "invalid_amount" };
  if (body.direction != null && String(body.direction) !== "IN") {
    return { ok: false, error: "only_increase" };
  }
  if (body.ledgerAmount != null && String(body.ledgerAmount) !== parsed.ledgerAmount.toString()) {
    return { ok: false, error: "invalid_amount" };
  }
  return {
    ok: true,
    ...parsed,
    idempotencyKey,
    refId: inventoryOpeningRefId(idempotencyKey),
  };
}

/**
 * Closed-beta opening inventory posts on the submitting admin's request.
 * A prior row with the same key must match; a rejected key is not revived.
 */
export function planImmediateInventoryOpening(input: {
  asset: string;
  amount: string;
  direction?: string;
  idempotencyKey: string;
  prior: { id: string; status: string; payload: unknown } | null;
}):
  | { ok: false; error: string; status: number }
  | ({
      ok: true;
      idempotencyKey: string;
      refId: string;
      record: InventoryRecordPlan;
      priorId: string | null;
    } & OpeningSpec) {
  const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) {
    return { ok: false, error: "idempotency_key_required", status: 400 };
  }
  if (input.direction && input.direction !== "IN") {
    return { ok: false, error: "only_increase", status: 400 };
  }
  const parsed = parseOpeningAmount(input.asset, input.amount);
  if (!parsed) return { ok: false, error: "invalid_amount", status: 400 };
  const refId = inventoryOpeningRefId(idempotencyKey);
  if (!input.prior) {
    return {
      ok: true,
      ...parsed,
      idempotencyKey,
      refId,
      record: "insert",
      priorId: null,
    };
  }
  const stored = parseStoredInventoryOpening(input.prior.payload);
  if (!stored.ok) return { ok: false, error: stored.error, status: 400 };
  const same =
    stored.asset === parsed.asset &&
    stored.ledgerAmount === parsed.ledgerAmount &&
    stored.accountCode === parsed.accountCode &&
    stored.idempotencyKey === idempotencyKey;
  if (!same) return { ok: false, error: "idempotency_conflict", status: 409 };
  if (input.prior.status === "REJECTED") {
    return { ok: false, error: "opening_rejected", status: 409 };
  }
  const record: InventoryRecordPlan =
    input.prior.status === "EXECUTED" ? "already_recorded" : "mark_executed";
  return {
    ok: true,
    ...parsed,
    idempotencyKey,
    refId,
    record,
    priorId: input.prior.id,
  };
}
