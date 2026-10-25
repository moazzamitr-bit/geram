import { FinnotechError } from "@/lib/finnotech/client";
import type { OwnershipMatch } from "@/lib/finnotech/bank";
import { hashCard, normalizeIranCard } from "@/lib/kyc/bank-id";
import { bankForCard, maskCard } from "@/lib/kyc/card";
import { KycFlowError, type KycAudit } from "@/lib/kyc/flow";
import { maskNationalCode } from "@/lib/kyc/national-id";
import { rateLimit } from "@/lib/rate-limit";

export type CardProfile = {
  id: string;
  kycStatus: string | null;
  nationalCode: string | null;
};

export type NewCard = {
  panMasked: string;
  panHash: string;
  bankCode: string | null;
  bankName: string;
  trackId: string;
  verifiedAt: string;
};

export type CardDeps = {
  now?: () => number;
  configured?: boolean;
  getProfile: (userId: string) => Promise<CardProfile | null>;
  hasCard: (userId: string, panHash: string) => Promise<boolean>;
  save: (userId: string, card: NewCard) => Promise<void>;
  audit: (event: KycAudit) => Promise<void>;
  matchCard: (card: string, nationalCode: string) => Promise<OwnershipMatch>;
  limit?: (key: string, max: number, windowMs: number, now: number) => { ok: boolean; retryAfterSec: number };
};

function providerError(err: unknown): KycFlowError {
  if (err instanceof KycFlowError) return err;
  if (err instanceof FinnotechError && err.code === "not_configured") {
    return new KycFlowError("not_configured", 503);
  }
  if (err instanceof FinnotechError && (err.code === "token_rejected" || err.code === "no_scope")) {
    return new KycFlowError("provider_config", 503);
  }
  return new KycFlowError("card_provider", 502);
}

/** Adds a card only when Finnotech says it belongs to the verified national code. */
export async function addVerifiedCard(
  deps: CardDeps,
  input: { userId: string; card?: string; ip: string }
): Promise<{ ok: true; card: { panMasked: string; bankName: string; bankCode: string | null } }> {
  if (deps.configured === false) throw new KycFlowError("not_configured", 503);
  const raw = (input.card ?? "").trim();
  if (!raw) throw new KycFlowError("bank_required", 400);
  const card = normalizeIranCard(raw);
  if (!card) throw new KycFlowError("invalid_card", 400);

  const now = deps.now?.() ?? Date.now();
  const profile = await deps.getProfile(input.userId);
  if (!profile) throw new KycFlowError("unavailable", 503);
  if (profile.kycStatus !== "VERIFIED" || !profile.nationalCode) {
    throw new KycFlowError("identity_required", 409);
  }

  const panHash = hashCard(card);
  if (await deps.hasCard(input.userId, panHash)) throw new KycFlowError("card_exists", 409);

  const limit = deps.limit ?? rateLimit;
  const ipLimit = limit(`kyc-card:ip:${input.ip}`, 8, 60 * 60 * 1000, now);
  const userLimit = limit(`kyc-card:user:${input.userId}`, 5, 60 * 60 * 1000, now);
  if (!ipLimit.ok || !userLimit.ok) throw new KycFlowError("rate_limited", 429);

  const bank = bankForCard(card);
  const panMasked = maskCard(card);
  const meta = { nationalCodeMasked: maskNationalCode(profile.nationalCode), panMasked, bank: bank?.code ?? null };

  let match: OwnershipMatch;
  try {
    match = await deps.matchCard(card, profile.nationalCode);
  } catch (err) {
    await deps.audit({ userId: input.userId, action: "kyc.card_failed", result: "error", meta });
    throw providerError(err);
  }
  if (!match.matched) {
    await deps.audit({ userId: input.userId, action: "kyc.card_mismatch", result: "ok", meta: { ...meta, trackId: match.trackId } });
    throw new KycFlowError("bank_mismatch", 422);
  }

  const saved: NewCard = {
    panMasked,
    panHash,
    bankCode: bank?.code ?? null,
    bankName: bank?.name ?? "کارت بانکی",
    trackId: match.trackId,
    verifiedAt: new Date(now).toISOString(),
  };
  try {
    await deps.save(input.userId, saved);
  } catch (err) {
    if (err instanceof KycFlowError) throw err;
    throw new KycFlowError("unavailable", 503);
  }
  await deps.audit({
    userId: input.userId,
    action: "kyc.card_verified",
    result: "ok",
    meta: { ...meta, trackId: match.trackId, provider: "finnotech" },
  });
  return { ok: true, card: { panMasked, bankName: saved.bankName, bankCode: saved.bankCode } };
}
