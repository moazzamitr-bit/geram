import { resolveExecutionMode, type EnvLike } from "@/lib/core/mode";
import { CoreError } from "@/lib/core/types";
import { TRADE_KYC_REQUIRED_MESSAGE } from "@/lib/kyc/messages";

/**
 * Buy/sell require KYC when REQUIRE_KYC_FOR_TRADE is true.
 * When the variable is unset, the gate is on only in PRODUCTION.
 */
export function kycRequiredForTrade(env: EnvLike = process.env): boolean {
  const raw = (env.REQUIRE_KYC_FOR_TRADE ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "off") return false;
  try {
    return resolveExecutionMode(env) === "PRODUCTION";
  } catch {
    return false;
  }
}

export function tradeBlockedByKyc(
  status: string | null | undefined,
  required = kycRequiredForTrade()
) {
  return required && status !== "VERIFIED";
}

export async function assertTradeKyc(userId: string) {
  if (!kycRequiredForTrade()) return;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", userId)
    .maybeSingle();
  if (error || tradeBlockedByKyc(data?.kyc_status, true)) {
    throw new CoreError("kyc_required", TRADE_KYC_REQUIRED_MESSAGE, 403);
  }
}
