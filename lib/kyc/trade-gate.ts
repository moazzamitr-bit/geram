import { resolveExecutionMode, type EnvLike } from "@/lib/core/mode";
import { CoreError } from "@/lib/core/types";
import { resolveKycLevel, type KycLevel } from "@/lib/kyc/levels";
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

export type TradeKycGate = {
  required: boolean;
  status: string | null;
  level: KycLevel;
};

/** Reads the signed-in user's level. Does not throw when KYC is incomplete. */
export async function readTradeKyc(userId: string): Promise<TradeKycGate> {
  const required = kycRequiredForTrade();
  if (!required) return { required: false, status: null, level: 2 };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const full = await supabase
      .from("profiles")
      .select("kyc_status, kyc_level, kyc_bank_verified_at")
      .eq("id", userId)
      .maybeSingle();
    const data = full.error
      ? (
          await supabase.from("profiles").select("kyc_status").eq("id", userId).maybeSingle()
        ).data
      : full.data;
    if (!data) return { required: true, status: null, level: 0 };
    return {
      required: true,
      status: data.kyc_status ?? null,
      level: resolveKycLevel(data),
    };
  } catch {
    return { required: true, status: null, level: 0 };
  }
}

export async function assertTradeKyc(userId: string): Promise<TradeKycGate> {
  const gate = await readTradeKyc(userId);
  if (tradeBlockedByKyc(gate.status, gate.required)) {
    throw new CoreError("kyc_required", TRADE_KYC_REQUIRED_MESSAGE, 403);
  }
  return gate;
}
