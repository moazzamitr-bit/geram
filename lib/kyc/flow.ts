import {
  isShahkarConfigError,
  type IdentityInquiry,
  type ShahkarScope,
  type ShahkarSend,
} from "@/lib/finnotech/kyc";
import { FinnotechError } from "@/lib/finnotech/client";
import { redactSecrets } from "@/lib/finnotech/redact";
import { KYC_MESSAGES, type KycErrorCode } from "@/lib/kyc/messages";
import {
  isValidIranianNationalCode,
  maskNationalCode,
  normalizeJalaliBirthDate,
  normalizeNationalCode,
} from "@/lib/kyc/national-id";
import { isAtLeast18Jalali } from "@/lib/kyc/age";
import { rateLimit } from "@/lib/rate-limit";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export class KycFlowError extends Error {
  constructor(
    public code: KycErrorCode,
    public httpStatus = 400,
    message?: string
  ) {
    super(message?.trim() ? message.trim() : KYC_MESSAGES[code]);
    this.name = "KycFlowError";
  }
}

export type KycProfile = {
  id: string;
  phone: string | null;
  kycStatus: string | null;
  nationalCode: string | null;
  birthDate: string | null;
  verifiedAt?: string | null;
};

export type KycChallenge = {
  nationalCode: string;
  birthDate: string;
  inquiryTrackId: string;
  /** Scope whose smsSend succeeded. Absent on challenges saved before this field. */
  sendScope?: ShahkarScope;
  expiresAt: number;
  attempts: number;
  shahkarMatched: boolean;
  createdAt: number;
};

/** Keep the send scope next to the track id without a new column. */
export function packInquiryTrack(trackId: string, scope?: ShahkarScope): string {
  if (scope !== "kyc" && scope !== "facility") return trackId;
  return `${scope}|${trackId}`;
}

export function unpackInquiryTrack(stored: string): { trackId: string; scope?: ShahkarScope } {
  const match = /^(kyc|facility)\|([\s\S]+)$/.exec(stored);
  if (!match) return { trackId: stored };
  return { scope: match[1] as ShahkarScope, trackId: match[2] };
}

export type VerifiedIdentity = {
  firstName: string;
  lastName: string;
  fatherName: string;
  nationalCode: string;
  birthDate: string;
  trackId: string;
  verifiedAt: string;
  checkedAt?: string;
};

export type KycStore = {
  getProfile(userId: string): Promise<KycProfile | null>;
  getChallenge(userId: string): Promise<KycChallenge | null>;
  saveChallenge(userId: string, challenge: KycChallenge): Promise<void>;
  clearChallenge(userId: string): Promise<void>;
  markVerified(userId: string, identity: VerifiedIdentity): Promise<void>;
  markRejected(userId: string, checkedAt: string, trackId: string): Promise<void>;
};

export type KycAudit = {
  userId: string;
  action: string;
  result: "ok" | "error";
  meta: Record<string, unknown>;
};

export type KycDeps = {
  now?: () => number;
  store: KycStore;
  audit: (event: KycAudit) => Promise<void>;
  sendShahkar: (mobile: string, nationalCode: string) => Promise<ShahkarSend>;
  verifyShahkar: (
    otp: string,
    inquiryTrackId: string,
    mobile: string,
    nationalCode: string,
    scope?: ShahkarScope
  ) => Promise<{ matched: boolean; trackId: string }>;
  inquire: (nationalCode: string, birthDate: string) => Promise<IdentityInquiry>;
  limit?: (key: string, max: number, windowMs: number, now: number) => { ok: boolean; retryAfterSec: number };
  configured?: boolean;
};

export type KycStartResult =
  | { ok: true; step: "otp" }
  | { ok: true; step: "verified"; firstName: string; lastName: string };

function depsNow(deps: KycDeps) {
  return deps.now?.() ?? Date.now();
}

/** Persian provider text only. Drop the reason when it still carries an id or a secret. */
export function safeShahkarReason(message: string): string | null {
  const trimmed = message.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 180) return null;
  if (/\d{10,}/.test(trimmed)) return null;
  if (/bearer|client_secret|access_token|authorization/i.test(trimmed)) return null;
  const cleaned = redactSecrets(trimmed);
  if (!/[\u0600-\u06FF]/.test(cleaned)) return null;
  if (/\d{6,}/.test(cleaned)) return null;
  return cleaned;
}

function providerError(err: unknown, clientError?: KycErrorCode): KycFlowError {
  if (err instanceof KycFlowError) return err;
  if (err instanceof FinnotechError && err.code === "not_configured") {
    return new KycFlowError("not_configured", 503);
  }
  if (err instanceof FinnotechError && (err.code === "token_rejected" || err.code === "no_scope")) {
    return new KycFlowError("provider_config", 503);
  }
  if (clientError && err instanceof FinnotechError && err.httpStatus === 400) {
    return new KycFlowError(clientError, 400, safeShahkarReason(err.providerMessage) ?? undefined);
  }
  return new KycFlowError("provider", 502);
}

/** Wrong or expired SMS code. VALIDATION_ERROR and FN-BRFH are configuration, not a typo. */
function isOtpMismatchError(err: FinnotechError): boolean {
  if (isShahkarConfigError(err)) return false;
  const blob = `${err.code} ${err.providerMessage}`;
  return /otp|mismatch|not[_\s-]?match|invalid[_\s-]?code|wrong[_\s-]?code|expired|رمز|کد\s*(تایید|تأیید|وارد)/i.test(
    blob
  );
}

function verifyProviderError(err: unknown): KycFlowError {
  if (err instanceof KycFlowError) return err;
  if (err instanceof FinnotechError && err.code === "not_configured") {
    return new KycFlowError("not_configured", 503);
  }
  if (err instanceof FinnotechError && isShahkarConfigError(err)) {
    return new KycFlowError("provider_config", 503);
  }
  if (err instanceof FinnotechError && isOtpMismatchError(err)) {
    return new KycFlowError("invalid_otp", 400, safeShahkarReason(err.providerMessage) ?? undefined);
  }
  return new KycFlowError("provider", 502);
}

async function finishInquiry(
  deps: KycDeps,
  userId: string,
  nationalCode: string,
  birthDate: string,
  shahkarTrackId: string
): Promise<KycStartResult> {
  let identity: IdentityInquiry;
  try {
    identity = await deps.inquire(nationalCode, birthDate);
  } catch (err) {
    await deps.audit({
      userId,
      action: "kyc.inquiry_failed",
      result: "error",
      meta: { nationalCodeMasked: maskNationalCode(nationalCode), shahkarTrackId },
    });
    throw providerError(err);
  }
  if (!identity.alive) {
    await deps.store.markRejected(userId, new Date(depsNow(deps)).toISOString(), identity.trackId);
    await deps.store.clearChallenge(userId);
    await deps.audit({
      userId,
      action: "kyc.rejected_deceased",
      result: "ok",
      meta: { nationalCodeMasked: maskNationalCode(nationalCode), trackId: identity.trackId },
    });
    throw new KycFlowError("deceased", 422);
  }
  if (!identity.firstName || !identity.lastName) {
    throw new KycFlowError("inquiry_failed", 502);
  }
  const verifiedAt = new Date(depsNow(deps)).toISOString();
  try {
    await deps.store.markVerified(userId, {
      firstName: identity.firstName,
      lastName: identity.lastName,
      fatherName: identity.fatherName,
      nationalCode,
      birthDate,
      trackId: identity.trackId,
      verifiedAt,
    });
  } catch (err) {
    if (err instanceof KycFlowError) throw err;
    throw new KycFlowError("unavailable", 503);
  }
  await deps.store.clearChallenge(userId);
  await deps.audit({
    userId,
    action: "kyc.verified",
    result: "ok",
    meta: {
      nationalCodeMasked: maskNationalCode(nationalCode),
      trackId: identity.trackId,
      shahkarTrackId,
      provider: "finnotech",
      verifiedAt,
    },
  });
  return { ok: true, step: "verified", firstName: identity.firstName, lastName: identity.lastName };
}

export async function startShahkarKyc(
  deps: KycDeps,
  input: { userId: string; nationalCode: string; birthDate: string; ip: string }
): Promise<KycStartResult> {
  const nationalCode = normalizeNationalCode(input.nationalCode);
  if (!isValidIranianNationalCode(nationalCode)) {
    throw new KycFlowError("invalid_national_code", 400);
  }
  const birthDate = normalizeJalaliBirthDate(input.birthDate);
  if (!birthDate) throw new KycFlowError("invalid_birth_date", 400);
  if (!isAtLeast18Jalali(birthDate)) {
    throw new KycFlowError("underage", 422);
  }
  if (deps.configured === false) throw new KycFlowError("not_configured", 503);

  const now = depsNow(deps);
  const profile = await deps.store.getProfile(input.userId);
  if (!profile) throw new KycFlowError("unavailable", 503);
  if (profile.kycStatus === "VERIFIED") throw new KycFlowError("already_verified", 409);
  const phone = (profile.phone ?? "").replace(/\D/g, "");
  if (!/^09\d{9}$/.test(phone)) throw new KycFlowError("no_phone", 400);

  const existing = await deps.store.getChallenge(input.userId);
  if (existing && now - existing.createdAt < COOLDOWN_MS && existing.expiresAt > now) {
    throw new KycFlowError("cooldown", 429);
  }

  const limit = deps.limit ?? rateLimit;
  const ipLimit = limit(`kyc-send:ip:${input.ip}`, 8, 60 * 60 * 1000, now);
  const userLimit = limit(`kyc-send:user:${input.userId}`, 5, 60 * 60 * 1000, now);
  if (!ipLimit.ok || !userLimit.ok) throw new KycFlowError("rate_limited", 429);

  let sent: ShahkarSend;
  try {
    sent = await deps.sendShahkar(phone, nationalCode);
  } catch (err) {
    await deps.audit({
      userId: input.userId,
      action: "kyc.shahkar_send_failed",
      result: "error",
      meta: { nationalCodeMasked: maskNationalCode(nationalCode) },
    });
    throw providerError(err, "invalid_input");
  }

  if (sent.outcome === "mismatch") {
    await deps.audit({
      userId: input.userId,
      action: "kyc.shahkar_mismatch",
      result: "ok",
      meta: { nationalCodeMasked: maskNationalCode(nationalCode), trackId: sent.trackId },
    });
    throw new KycFlowError("mismatch", 422);
  }

  if (sent.outcome === "matched_without_otp") {
    return finishInquiry(deps, input.userId, nationalCode, birthDate, sent.trackId);
  }

  await deps.store.saveChallenge(input.userId, {
    nationalCode,
    birthDate,
    inquiryTrackId: sent.trackId,
    sendScope: sent.scope,
    expiresAt: now + CHALLENGE_TTL_MS,
    attempts: 0,
    shahkarMatched: false,
    createdAt: now,
  });
  await deps.audit({
    userId: input.userId,
    action: "kyc.shahkar_otp_sent",
    result: "ok",
    meta: { nationalCodeMasked: maskNationalCode(nationalCode), trackId: sent.trackId },
  });
  return { ok: true, step: "otp" };
}

export async function confirmShahkarKyc(
  deps: KycDeps,
  input: { userId: string; otp: string; ip: string }
): Promise<KycStartResult> {
  if (deps.configured === false) throw new KycFlowError("not_configured", 503);
  const otp = input.otp.replace(/\D/g, "");
  if (!/^\d{4,8}$/.test(otp)) throw new KycFlowError("invalid_otp", 400);

  const now = depsNow(deps);
  const limit = deps.limit ?? rateLimit;
  if (!limit(`kyc-verify:ip:${input.ip}`, 20, 10 * 60 * 1000, now).ok) {
    throw new KycFlowError("rate_limited", 429);
  }

  const challenge = await deps.store.getChallenge(input.userId);
  if (!challenge || challenge.expiresAt <= now) throw new KycFlowError("expired", 400);
  if (challenge.attempts >= MAX_OTP_ATTEMPTS) throw new KycFlowError("too_many", 429);

  let trackId = challenge.inquiryTrackId;
  if (!challenge.shahkarMatched) {
    const profile = await deps.store.getProfile(input.userId);
    if (!profile) throw new KycFlowError("unavailable", 503);
    const phone = (profile.phone ?? "").replace(/\D/g, "");
    if (!/^09\d{9}$/.test(phone)) throw new KycFlowError("no_phone", 400);
    let verified: { matched: boolean; trackId: string };
    try {
      verified = await deps.verifyShahkar(
        otp,
        challenge.inquiryTrackId,
        phone,
        challenge.nationalCode,
        challenge.sendScope
      );
    } catch (err) {
      throw verifyProviderError(err);
    }
    if (!verified.matched) {
      await deps.store.saveChallenge(input.userId, {
        ...challenge,
        attempts: challenge.attempts + 1,
      });
      await deps.audit({
        userId: input.userId,
        action: "kyc.shahkar_otp_rejected",
        result: "error",
        meta: {
          nationalCodeMasked: maskNationalCode(challenge.nationalCode),
          trackId: verified.trackId,
        },
      });
      throw new KycFlowError("invalid_otp", 400);
    }
    trackId = verified.trackId;
    await deps.store.saveChallenge(input.userId, {
      ...challenge,
      shahkarMatched: true,
    });
  }

  return finishInquiry(deps, input.userId, challenge.nationalCode, challenge.birthDate, trackId);
}
