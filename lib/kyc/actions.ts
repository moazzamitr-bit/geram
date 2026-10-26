import { finnotechConfigured } from "@/lib/finnotech/config";
import { cardToIban, verifyCardOwner } from "@/lib/finnotech/bank";
import { inquireIdentity, sendShahkarSms, verifyShahkarSms } from "@/lib/finnotech/kyc";
import { addVerifiedCard, type CardIbanRecord, type CardProfile, type NewCard } from "@/lib/kyc/bank-flow";
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

function serviceDb() {
  try {
    return createServiceClient();
  } catch {
    throw new KycFlowError("unavailable", 503);
  }
}

async function loadCardProfile(userId: string): Promise<CardProfile | null> {
  const { data, error } = await serviceDb()
    .from("profiles")
    .select("id, kyc_status, national_code")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, kycStatus: data.kyc_status, nationalCode: data.national_code };
}

async function hasCard(userId: string, panHash: string) {
  const { data, error } = await serviceDb()
    .from("user_bank_cards")
    .select("id, iban")
    .eq("user_id", userId)
    .eq("pan_hash", panHash)
    .maybeSingle();
  if (error) throw new KycFlowError("unavailable", 503);
  return data ? { hasIban: !!data.iban } : false;
}

function ibanColumns(iban: CardIbanRecord | null | undefined) {
  if (!iban) return {};
  return {
    iban: iban.iban,
    iban_bank_name: iban.bankName,
    iban_owners: iban.owners,
    iban_deposit_status: iban.depositStatus,
    iban_track_id: iban.trackId,
    iban_checked_at: iban.checkedAt,
  };
}

async function saveIban(userId: string, panHash: string, iban: CardIbanRecord) {
  const { error } = await serviceDb()
    .from("user_bank_cards")
    .update(ibanColumns(iban))
    .eq("user_id", userId)
    .eq("pan_hash", panHash);
  if (error) throw new KycFlowError("unavailable", 503);
}

async function saveCard(userId: string, card: NewCard) {
  const { error } = await serviceDb().from("user_bank_cards").insert({
    user_id: userId,
    pan_masked: card.panMasked,
    pan_hash: card.panHash,
    bank_code: card.bankCode,
    bank_name: card.bankName,
    status: "VERIFIED",
    owner_track_id: card.trackId,
    verified_at: card.verifiedAt,
    ...ibanColumns(card.iban),
  });
  if (error?.code === "23505") throw new KycFlowError("card_exists", 409);
  if (error) throw new KycFlowError("unavailable", 503);
}

export async function addUserCard(input: { userId: string; card?: string; ip: string }) {
  return addVerifiedCard(
    {
      configured: finnotechConfigured(),
      getProfile: loadCardProfile,
      hasCard,
      save: saveCard,
      audit: auditKyc,
      matchCard: verifyCardOwner,
      lookupIban: cardToIban,
      saveIban,
    },
    input
  );
}

export async function listUserCards(userId: string) {
  const { data, error } = await serviceDb()
    .from("user_bank_cards")
    .select("id, pan_masked, bank_code, bank_name, status, verified_at, iban, iban_bank_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new KycFlowError("unavailable", 503);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    panMasked: row.pan_masked as string,
    bankCode: (row.bank_code as string | null) ?? null,
    bankName: row.bank_name as string,
    status: row.status as string,
    verifiedAt: (row.verified_at as string | null) ?? null,
    iban: (row.iban as string | null) ?? null,
    ibanBankName: (row.iban_bank_name as string | null) ?? null,
  }));
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
