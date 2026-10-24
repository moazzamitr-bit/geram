import { FinnotechError } from "@/lib/finnotech/client";
import type { OwnershipMatch } from "@/lib/finnotech/bank";
import { fingerprintCard, maskPayment, normalizeIranCard, normalizeIranIban } from "@/lib/kyc/bank-id";
import { KycFlowError, type KycAudit } from "@/lib/kyc/flow";
import { KYC_MESSAGES } from "@/lib/kyc/messages";
import { maskNationalCode } from "@/lib/kyc/national-id";
import { rateLimit } from "@/lib/rate-limit";

export type BankProfile = {
  id: string;
  kycStatus: string | null;
  nationalCode: string | null;
  bankVerifiedAt: string | null;
};

export type SavedBank = {
  mask: string;
  trackId: string;
  verifiedAt: string;
  cardLast4: string | null;
  iban: string | null;
};

export type BankDeps = {
  now?: () => number;
  configured?: boolean;
  getProfile: (userId: string) => Promise<BankProfile | null>;
  save: (userId: string, saved: SavedBank) => Promise<void>;
  audit: (event: KycAudit) => Promise<void>;
  matchCard: (card: string, nationalCode: string) => Promise<OwnershipMatch>;
  matchIban: (iban: string, nationalCode: string) => Promise<OwnershipMatch>;
  limit?: (key: string, max: number, windowMs: number, now: number) => { ok: boolean; retryAfterSec: number };
};

function providerError(err: unknown): KycFlowError {
  if (err instanceof KycFlowError) return err;
  if (err instanceof FinnotechError && err.code === "not_configured") {
    return new KycFlowError("not_configured", 503);
  }
  return new KycFlowError("provider", 502);
}

export async function confirmBankOwnership(
  deps: BankDeps,
  input: { userId: string; card?: string; iban?: string; ip: string }
): Promise<{ ok: true; level: 2; mask: string }> {
  if (deps.configured === false) throw new KycFlowError("not_configured", 503);
  const cardRaw = (input.card ?? "").trim();
  const ibanRaw = (input.iban ?? "").trim();
  if (!cardRaw && !ibanRaw) throw new KycFlowError("bank_required", 400);

  const card = cardRaw ? normalizeIranCard(cardRaw) : null;
  if (cardRaw && !card) throw new KycFlowError("invalid_card", 400);
  const iban = ibanRaw ? normalizeIranIban(ibanRaw) : null;
  if (ibanRaw && !iban) throw new KycFlowError("invalid_iban", 400);

  const now = deps.now?.() ?? Date.now();
  const profile = await deps.getProfile(input.userId);
  if (!profile) throw new KycFlowError("unavailable", 503);
  if (profile.bankVerifiedAt) {
    return { ok: true, level: 2, mask: "حساب تأییدشده" };
  }
  if (profile.kycStatus !== "VERIFIED" || !profile.nationalCode) {
    throw new KycFlowError("identity_required", 409);
  }

  const limit = deps.limit ?? rateLimit;
  const ipLimit = limit(`kyc-bank:ip:${input.ip}`, 8, 60 * 60 * 1000, now);
  const userLimit = limit(`kyc-bank:user:${input.userId}`, 5, 60 * 60 * 1000, now);
  if (!ipLimit.ok || !userLimit.ok) throw new KycFlowError("rate_limited", 429);

  let trackId = "";
  try {
    if (card) {
      const cardMatch = await deps.matchCard(card, profile.nationalCode);
      trackId = cardMatch.trackId;
      if (!cardMatch.matched) throw new KycFlowError("bank_mismatch", 422);
    }
    if (iban) {
      const ibanMatch = await deps.matchIban(iban, profile.nationalCode);
      trackId = ibanMatch.trackId || trackId;
      if (!ibanMatch.matched) throw new KycFlowError("bank_mismatch", 422);
    }
  } catch (err) {
    if (err instanceof KycFlowError && err.code === "bank_mismatch") {
      await deps.audit({
        userId: input.userId,
        action: "kyc.bank_mismatch",
        result: "ok",
        meta: {
          nationalCodeMasked: maskNationalCode(profile.nationalCode),
          mask: maskPayment({ card, iban }),
        },
      });
      throw err;
    }
    await deps.audit({
      userId: input.userId,
      action: "kyc.bank_failed",
      result: "error",
      meta: { nationalCodeMasked: maskNationalCode(profile.nationalCode) },
    });
    throw providerError(err);
  }

  const verifiedAt = new Date(now).toISOString();
  const mask = maskPayment({ card, iban });
  try {
    await deps.save(input.userId, {
      mask,
      trackId,
      verifiedAt,
      cardLast4: card ? card.slice(-4) : null,
      iban,
    });
  } catch (err) {
    if (err instanceof KycFlowError) throw err;
    throw new KycFlowError("unavailable", 503);
  }

  await deps.audit({
    userId: input.userId,
    action: "kyc.bank_verified",
    result: "ok",
    meta: {
      nationalCodeMasked: maskNationalCode(profile.nationalCode),
      mask,
      trackId,
      cardFingerprint: card ? fingerprintCard(card) : null,
      provider: "finnotech",
    },
  });
  return { ok: true, level: 2, mask };
}

export function bankErrorMessage(code: string) {
  if (code in KYC_MESSAGES) return KYC_MESSAGES[code as keyof typeof KYC_MESSAGES];
  return KYC_MESSAGES.provider;
}
