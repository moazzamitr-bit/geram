import { afterEach, describe, expect, it, vi } from "vitest";
import { kycRequiredForTrade, tradeBlockedByKyc } from "@/lib/kyc/trade-gate";
import { TRADE_KYC_REQUIRED_MESSAGE } from "@/lib/kyc/messages";

describe("kyc trade gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is on in production and off in sandbox unless the flag says otherwise", () => {
    expect(
      kycRequiredForTrade({ GERAM_EXECUTION_MODE: "PRODUCTION" })
    ).toBe(true);
    expect(kycRequiredForTrade({ GERAM_EXECUTION_MODE: "SANDBOX" })).toBe(false);
    expect(kycRequiredForTrade({ GERAM_EXECUTION_MODE: "CLOSED_BETA" })).toBe(false);
    expect(
      kycRequiredForTrade({ GERAM_EXECUTION_MODE: "SANDBOX", REQUIRE_KYC_FOR_TRADE: "true" })
    ).toBe(true);
    expect(
      kycRequiredForTrade({ GERAM_EXECUTION_MODE: "PRODUCTION", REQUIRE_KYC_FOR_TRADE: "false" })
    ).toBe(false);
  });

  it("blocks buy and sell only when the flag is on and the profile is not verified", () => {
    expect(tradeBlockedByKyc("UNVERIFIED", true)).toBe(true);
    expect(tradeBlockedByKyc("PENDING", true)).toBe(true);
    expect(tradeBlockedByKyc("VERIFIED", true)).toBe(false);
    expect(tradeBlockedByKyc("UNVERIFIED", false)).toBe(false);
    expect(TRADE_KYC_REQUIRED_MESSAGE).toContain("احراز هویت");
  });
});
