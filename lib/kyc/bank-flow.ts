import { FinnotechError } from "@/lib/finnotech/client";
import { ibanCanReceive, type CardIban, type OwnershipMatch } from "@/lib/finnotech/bank";
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
  iban?: CardIbanRecord | null;
};

export type CardIbanRecord = {
  iban: string;
  bankName: string | null;
  owners: string | null;
  depositStatus: string | null;
  trackId: string;
  checkedAt: string;
};

export type CardDeps = {
  now?: () => number;
  configured?: boolean;
  getProfile: (userId: string) => Promise<CardProfile | null>;
  /** true / { hasIban } when the user already has this card. */
  hasCard: (userId: string, panHash: string) => Promise<boolean | { hasIban: boolean }>;
  save: (userId: string, card: NewCard) => Promise<void>;
  /** Finnotech facility:card-to-iban. Optional so a lookup outage never blocks a card. */
  lookupIban?: (card: string) => Promise<CardIban>;
  /** Stores an IBAN on a card the user already verified (re-entry of the same card). */
  saveIban?: (userId: string, panHash: string, iban: CardIbanRecord) => Promise<void>;
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
): Promise<{
  ok: true;
  card: { panMasked: string; bankName: string; bankCode: string | null; iban: string | null; ibanError?: string };
}> {
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
  const existing = await deps.hasCard(input.userId, panHash);
  const refreshIban =
    existing !== false && typeof existing === "object" && !existing.hasIban && !!deps.lookupIban && !!deps.saveIban;
  if (existing && !refreshIban) throw new KycFlowError("card_exists", 409);

  const limit = deps.limit ?? rateLimit;
  const ipLimit = limit(`kyc-card:ip:${input.ip}`, 8, 60 * 60 * 1000, now);
  const userLimit = limit(`kyc-card:user:${input.userId}`, 5, 60 * 60 * 1000, now);
  if (!ipLimit.ok || !userLimit.ok) throw new KycFlowError("rate_limited", 429);

  const bank = bankForCard(card);
  const panMasked = maskCard(card);
  const meta = { nationalCodeMasked: maskNationalCode(profile.nationalCode), panMasked, bank: bank?.code ?? null };

  // IBAN lookup runs while the full PAN is still in memory; it is never stored.
  const lookup = async (): Promise<{ record: CardIbanRecord | null; error?: string }> => {
    if (!deps.lookupIban) return { record: null };
    try {
      const found = await deps.lookupIban(card);
      if (!ibanCanReceive(found.depositStatus)) {
        await deps.audit({ userId: input.userId, action: "kyc.iban_inactive", result: "ok", meta: { ...meta, trackId: found.trackId, depositStatus: found.depositStatus } });
        return { record: null, error: "iban_inactive" };
      }
      return { record: { ...found, checkedAt: new Date(now).toISOString() } };
    } catch {
      await deps.audit({ userId: input.userId, action: "kyc.iban_failed", result: "error", meta });
      return { record: null, error: "iban_unavailable" };
    }
  };

  if (refreshIban) {
    const { record, error } = await lookup();
    if (!record) throw new KycFlowError(error === "iban_inactive" ? "iban_inactive" : "card_provider", error === "iban_inactive" ? 422 : 502);
    await deps.saveIban!(input.userId, panHash, record);
    await deps.audit({ userId: input.userId, action: "kyc.iban_saved", result: "ok", meta: { ...meta, trackId: record.trackId } });
    return { ok: true, card: { panMasked, bankName: record.bankName ?? bank?.name ?? "کارت بانکی", bankCode: bank?.code ?? null, iban: record.iban } };
  }

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

  const ibanLookup = await lookup();
  const saved: NewCard = {
    panMasked,
    panHash,
    bankCode: bank?.code ?? null,
    bankName: bank?.name ?? "کارت بانکی",
    trackId: match.trackId,
    verifiedAt: new Date(now).toISOString(),
    iban: ibanLookup.record,
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
    meta: { ...meta, trackId: match.trackId, provider: "finnotech", iban: !!ibanLookup.record },
  });
  return {
    ok: true,
    card: {
      panMasked,
      bankName: saved.bankName,
      bankCode: saved.bankCode,
      iban: ibanLookup.record?.iban ?? null,
      ...(ibanLookup.error ? { ibanError: ibanLookup.error } : {}),
    },
  };
}
