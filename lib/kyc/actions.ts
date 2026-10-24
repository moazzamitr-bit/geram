import { finnotechConfigured } from "@/lib/finnotech/config";
import { inquireIdentity, sendShahkarSms, verifyShahkarSms } from "@/lib/finnotech/kyc";
import { auditKyc, supabaseKycStore } from "@/lib/kyc/db";
import { confirmShahkarKyc, startShahkarKyc, type KycDeps } from "@/lib/kyc/flow";
import { FinnotechError } from "@/lib/finnotech/client";
import { KycFlowError } from "@/lib/kyc/flow";

function liveDeps(): KycDeps {
  let store;
  try {
    store = supabaseKycStore();
  } catch {
    throw new KycFlowError("unavailable", 503);
  }
  return {
    store,
    audit: auditKyc,
    configured: finnotechConfigured(),
    sendShahkar: sendShahkarSms,
    verifyShahkar: verifyShahkarSms,
    inquire: inquireIdentity,
  };
}

export async function startUserKyc(input: {
  userId: string;
  nationalCode: string;
  birthDate: string;
  ip: string;
}) {
  return startShahkarKyc(liveDeps(), input);
}

export async function confirmUserKyc(input: { userId: string; otp: string; ip: string }) {
  return confirmShahkarKyc(liveDeps(), input);
}

/** Admin retry: re-read the civil registry. Does not send another Shahkar SMS. */
export async function refreshStoredIdentity(userId: string) {
  if (!finnotechConfigured()) throw new KycFlowError("not_configured", 503);
  const deps = liveDeps();
  const profile = await deps.store.getProfile(userId);
  if (!profile?.nationalCode || !profile.birthDate) {
    return { ok: false as const, error: "no_stored_identity" as const };
  }
  try {
    const identity = await inquireIdentity(profile.nationalCode, profile.birthDate);
    if (!identity.alive) {
      await deps.store.markRejected(userId, new Date().toISOString(), identity.trackId);
      return { ok: true as const, status: "REJECTED" as const, trackId: identity.trackId };
    }
    if (!identity.firstName || !identity.lastName) {
      throw new FinnotechError("inquiry_empty", 200);
    }
    const checkedAt = new Date().toISOString();
    await deps.store.markVerified(userId, {
      firstName: identity.firstName,
      lastName: identity.lastName,
      fatherName: identity.fatherName,
      nationalCode: profile.nationalCode,
      birthDate: profile.birthDate,
      trackId: identity.trackId,
      verifiedAt: profile.verifiedAt ?? checkedAt,
      checkedAt,
    });
    return { ok: true as const, status: "VERIFIED" as const, trackId: identity.trackId };
  } catch (err) {
    if (err instanceof KycFlowError) throw err;
    throw new KycFlowError("provider", 502);
  }
}
