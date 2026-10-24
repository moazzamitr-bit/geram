import { tomanToIrr, type Irr } from "@/lib/core/money";

/** Closed-beta fat-finger cap. One billion toman. */
export const MAX_WALLET_CREDIT_TOMAN = 1_000_000_000;

export function normalizeIranMobile(raw: string): string | null {
  let digits = raw.trim().replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  if (digits.startsWith("98") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("9")) digits = `0${digits}`;
  if (!/^09\d{9}$/.test(digits)) return null;
  return digits;
}

export function phoneLookupVariants(digits: string): string[] {
  return [digits, `+98${digits.slice(1)}`, `98${digits.slice(1)}`];
}

export function parseIdempotencyKey(raw: string | undefined): string | null {
  const key = (raw ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(key)) return null;
  return key;
}

export function walletCreditRefId(idempotencyKey: string) {
  return `wallet-credit:${idempotencyKey}`;
}

export function parseTomanAmount(raw: string): { toman: number; irr: Irr } | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const toman = Number(trimmed);
  if (!Number.isSafeInteger(toman) || toman <= 0 || toman > MAX_WALLET_CREDIT_TOMAN) return null;
  return { toman, irr: tomanToIrr(toman) };
}

export type CreditTarget = { id: string; phone: string | null };

export async function resolveCreditTarget(input: {
  userId?: string;
  phone?: string;
  lookupById: (id: string) => Promise<CreditTarget | null>;
  lookupByPhones: (phones: string[]) => Promise<CreditTarget[]>;
}): Promise<
  | { ok: true; userId: string; phone: string | null }
  | { ok: false; error: string; status: number }
> {
  const userId = (input.userId ?? "").trim();
  const phoneRaw = (input.phone ?? "").trim();
  const phone = phoneRaw ? normalizeIranMobile(phoneRaw) : null;
  if (phoneRaw && !phone) {
    return { ok: false, error: "invalid_phone", status: 400 };
  }
  if (!userId && !phone) {
    return { ok: false, error: "user_required", status: 400 };
  }
  if (userId) {
    const row = await input.lookupById(userId);
    if (!row) return { ok: false, error: "user_not_found", status: 404 };
    if (phone) {
      const stored = row.phone ? normalizeIranMobile(row.phone) : null;
      if (stored !== phone) {
        return { ok: false, error: "user_phone_mismatch", status: 400 };
      }
    }
    return { ok: true, userId: row.id, phone: row.phone };
  }
  const rows = await input.lookupByPhones(phoneLookupVariants(phone!));
  if (rows.length === 0) return { ok: false, error: "user_not_found", status: 404 };
  if (rows.length > 1) return { ok: false, error: "ambiguous_phone", status: 409 };
  return { ok: true, userId: rows[0].id, phone: rows[0].phone };
}

export type WalletCreditRecordPlan = "insert" | "mark_executed" | "already_recorded";

/**
 * Closed-beta wallet credit posts on the submitting admin's request.
 * A prior row with the same key must match; a rejected key is not revived.
 */
export function planImmediateWalletCredit(input: {
  userId: string;
  amountToman: number;
  idempotencyKey: string;
  prior: { id: string; status: string; payload: unknown } | null;
}):
  | { ok: false; error: string; status: number }
  | {
      ok: true;
      refId: string;
      amountIrr: Irr;
      record: WalletCreditRecordPlan;
      priorId: string | null;
    } {
  const amount = parseTomanAmount(String(input.amountToman));
  if (!amount || amount.toman !== input.amountToman) {
    return { ok: false, error: "invalid_amount", status: 400 };
  }
  const refId = walletCreditRefId(input.idempotencyKey);
  if (!input.prior) {
    return { ok: true, refId, amountIrr: amount.irr, record: "insert", priorId: null };
  }
  const stored = parseStoredWalletCredit(input.prior.payload);
  if (!stored.ok) return { ok: false, error: stored.error, status: 400 };
  const same =
    stored.userId === input.userId &&
    stored.amountToman === input.amountToman &&
    stored.idempotencyKey === input.idempotencyKey;
  if (!same) return { ok: false, error: "idempotency_conflict", status: 409 };
  if (input.prior.status === "REJECTED") {
    return { ok: false, error: "credit_rejected", status: 409 };
  }
  if (input.prior.status === "EXECUTED") {
    return {
      ok: true,
      refId,
      amountIrr: amount.irr,
      record: "already_recorded",
      priorId: input.prior.id,
    };
  }
  return {
    ok: true,
    refId,
    amountIrr: amount.irr,
    record: "mark_executed",
    priorId: input.prior.id,
  };
}

export function parseStoredWalletCredit(payload: unknown):
  | {
      ok: true;
      userId: string;
      amountToman: number;
      amountIrr: Irr;
      idempotencyKey: string;
      refId: string;
    }
  | { ok: false; error: string } {
  const body = (payload ?? {}) as Record<string, unknown>;
  const userId = String(body.userId ?? "").trim();
  const amount = parseTomanAmount(String(body.amount ?? ""));
  const idempotencyKey = parseIdempotencyKey(String(body.idempotencyKey ?? ""));
  if (!userId) return { ok: false, error: "user_required" };
  if (!amount) return { ok: false, error: "invalid_amount" };
  if (!idempotencyKey) return { ok: false, error: "idempotency_key_required" };
  if (String(body.direction ?? "CREDIT") !== "CREDIT") {
    return { ok: false, error: "only_credit" };
  }
  const asset = body.asset == null ? "IRR" : String(body.asset);
  if (asset !== "IRR") return { ok: false, error: "only_irr" };
  return {
    ok: true,
    userId,
    amountToman: amount.toman,
    amountIrr: amount.irr,
    idempotencyKey,
    refId: walletCreditRefId(idempotencyKey),
  };
}
