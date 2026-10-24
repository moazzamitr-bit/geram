import { finnotechConfigured } from "@/lib/finnotech/config";
import { verifyCardOwner, verifyIbanOwner } from "@/lib/finnotech/bank";
import { inquireIdentity, sendShahkarSms, verifyShahkarSms } from "@/lib/finnotech/kyc";
import { confirmBankOwnership, type BankProfile, type SavedBank } from "@/lib/kyc/bank-flow";
import { auditKyc, supabaseKycStore } from "@/lib/kyc/db";
import { confirmShahkarKyc, startShahkarKyc, type KycDeps } from "@/lib/kyc/flow";
import { FinnotechError } from "@/lib/finnotech/client";
import { KycFlowError } from "@/lib/kyc/flow";
import { createServiceClient } from "@/lib/supabase/admin";

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

async function loadBankProfile(userId: string): Promise<BankProfile | null> {
  let db;
  try {
    db = createServiceClient();
  } catch {
    throw new KycFlowError("unavailable", 503);
  }
  const { data, error } = await db
    .from("profiles")
    .select("id, kyc_status, national_code, kyc_bank_verified_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    kycStatus: data.kyc_status,
    nationalCode: data.national_code,
    bankVerifiedAt: data.kyc_bank_verified_at,
  };
}

async function saveBankAccount(userId: string, saved: SavedBank) {
  let db;
  try {
    db = createServiceClient();
  } catch {
    throw new KycFlowError("unavailable", 503);
  }
  const { error: profileError } = await db
    .from("profiles")
    .update({
      kyc_level: 2,
      kyc_bank_verified_at: saved.verifiedAt,
      kyc_bank_track_id: saved.trackId,
      kyc_bank_mask: saved.mask,
    })
    .eq("id", userId);
  if (profileError) throw new KycFlowError("unavailable", 503);
  const { error: bankError } = await db.from("bank_accounts").insert({
    user_id: userId,
    bank_name: saved.cardLast4 ? "کارت بانکی" : "شبا",
    iban: saved.iban,
    card_last4: saved.cardLast4,
    owner_track_id: saved.trackId,
    verified: true,
    verified_at: saved.verifiedAt,
    account_status: "OWNERSHIP_VERIFIED",
  });
  if (bankError) throw new KycFlowError("unavailable", 503);
}

export async function confirmUserBank(input: {
  userId: string;
  card?: string;
  iban?: string;
  ip: string;
}) {
  return confirmBankOwnership(
    {
      configured: finnotechConfigured(),
      getProfile: loadBankProfile,
      save: saveBankAccount,
      audit: auditKyc,
      matchCard: verifyCardOwner,
      matchIban: verifyIbanOwner,
    },
    input
  );
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
