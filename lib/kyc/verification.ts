import { CoreError } from "@/lib/core/types";
import { resolveKycLevel, type KycLevel } from "@/lib/kyc/levels";
import { VERIFICATION_REQUIRED_MESSAGE } from "@/lib/kyc/messages";

export type VerificationStep = "identity" | "card";

export type VerificationState = {
  identity: boolean;
  card: boolean;
  level: KycLevel;
  /** First step still missing, or null when fully verified. */
  nextStep: VerificationStep | null;
};

export function verificationState(kycStatus: string | null | undefined, verifiedCards: number): VerificationState {
  const identity = kycStatus === "VERIFIED";
  const card = identity && verifiedCards > 0;
  return {
    identity,
    card,
    level: resolveKycLevel({ identity, card }),
    nextStep: !identity ? "identity" : !card ? "card" : null,
  };
}

/** Reads with the service role: the gate must not depend on the user's RLS view. */
export async function readVerification(userId: string): Promise<VerificationState> {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const db = createServiceClient();
  const [profile, cards] = await Promise.all([
    db.from("profiles").select("kyc_status").eq("id", userId).maybeSingle(),
    db
      .from("user_bank_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "VERIFIED"),
  ]);
  if (profile.error || cards.error) {
    throw new CoreError("verification_unavailable", "وضعیت احراز هویت خوانده نشد. دوباره تلاش کنید.", 503);
  }
  return verificationState(profile.data?.kyc_status, cards.count ?? 0);
}

export function verificationRequiredError(state: VerificationState) {
  return new CoreError("verification_required", VERIFICATION_REQUIRED_MESSAGE[state.nextStep ?? "identity"], 403, {
    nextStep: state.nextStep,
  });
}

/** Quotes, trades, deposits and withdrawals: identity AND a verified card. */
export async function assertVerified(userId: string): Promise<VerificationState> {
  const state = await readVerification(userId);
  if (state.nextStep) throw verificationRequiredError(state);
  return state;
}
