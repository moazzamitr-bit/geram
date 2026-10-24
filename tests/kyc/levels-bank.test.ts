import { describe, expect, it, vi } from "vitest";
import { isAtLeast18Jalali } from "@/lib/kyc/age";
import { confirmBankOwnership, type BankProfile } from "@/lib/kyc/bank-flow";
import { normalizeIranCard, normalizeIranIban } from "@/lib/kyc/bank-id";
import { effectiveTradeLimits, resolveKycLevel } from "@/lib/kyc/levels";
import { DEFAULT_COMMERCE_SETTINGS } from "@/lib/commerce/types";
import { isIranMobile, normalizeIranMobile } from "@/lib/auth/phone";
import { OTP_RESEND_SEC, newLoginCode, otpCodeLength } from "@/lib/auth/otp";

const NOW = new Date("2026-10-24T12:00:00+03:30");

describe("iran mobile", () => {
  it("accepts Persian digits and +98", () => {
    expect(normalizeIranMobile("۰۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
    expect(normalizeIranMobile("+98 912 123 4567")).toBe("09121234567");
    expect(normalizeIranMobile("00989121234567")).toBe("09121234567");
    expect(isIranMobile(normalizeIranMobile("09121234567"))).toBe(true);
    expect(isIranMobile("9121234567")).toBe(false);
  });
});

describe("login code", () => {
  it("uses a two-minute resend and Finnotech's 6-digit sample length", () => {
    expect(OTP_RESEND_SEC).toBe(120);
    expect(otpCodeLength()).toBe(6);
    expect(newLoginCode()).toMatch(/^\d{6}$/);
  });
});

describe("kyc levels", () => {
  it("treats Shahkar verification as level 1 and a bank match as level 2", () => {
    expect(resolveKycLevel({ kyc_status: "UNVERIFIED" })).toBe(0);
    expect(resolveKycLevel({ kyc_status: "VERIFIED" })).toBe(1);
    expect(resolveKycLevel({ kyc_status: "VERIFIED", kyc_bank_verified_at: "2026-01-01" })).toBe(2);
  });

  it("caps trade limits only when KYC is required", () => {
    const open = effectiveTradeLimits(DEFAULT_COMMERCE_SETTINGS.limits, 0, false);
    expect(open.dailyBuyToman).toBe(DEFAULT_COMMERCE_SETTINGS.limits.dailyBuyToman);
    const identity = effectiveTradeLimits(DEFAULT_COMMERCE_SETTINGS.limits, 1, true);
    expect(identity.dailyBuyToman).toBe(200_000_000);
    expect(identity.dailyWithdrawToman).toBe(0);
    const bank = effectiveTradeLimits(DEFAULT_COMMERCE_SETTINGS.limits, 2, true);
    expect(bank.dailyWithdrawToman).toBe(50_000_000);
    expect(bank.dailyBuyToman).toBe(1_000_000_000);
  });

  it("requires 18 years on the Jalali calendar", () => {
    expect(isAtLeast18Jalali("1370/06/15", NOW)).toBe(true);
    expect(isAtLeast18Jalali("1395/01/01", NOW)).toBe(false);
  });
});

describe("bank ownership", () => {
  it("checks the card format and does not call Finnotech for a mismatch", async () => {
    expect(normalizeIranCard("4111111111111111")).toBe("4111111111111111");
    expect(normalizeIranCard("4111111111111112")).toBeNull();
    expect(normalizeIranIban("IR820540102680020817909002")).toBe("IR820540102680020817909002");
    expect(normalizeIranIban("IR820540102680020817909003")).toBeNull();

    const profile: BankProfile = {
      id: "user-1",
      kycStatus: "VERIFIED",
      nationalCode: "0013542419",
      bankVerifiedAt: null,
    };
    const matchCard = vi.fn(async () => ({ matched: false, trackId: "card-1" }));
    await expect(
      confirmBankOwnership(
        {
          configured: true,
          now: () => NOW.getTime(),
          getProfile: async () => profile,
          save: async () => undefined,
          audit: async () => undefined,
          matchCard,
          matchIban: async () => ({ matched: true, trackId: "iban-1" }),
          limit: () => ({ ok: true, retryAfterSec: 0 }),
        },
        { userId: "user-1", card: "4111111111111111", ip: "203.0.113.10" }
      )
    ).rejects.toMatchObject({ code: "bank_mismatch" });
    expect(matchCard).toHaveBeenCalledWith("4111111111111111", "0013542419");
  });

  it("stores a mask instead of the card number when the owner matches", async () => {
    let savedMask = "";
    const result = await confirmBankOwnership(
      {
        configured: true,
        now: () => NOW.getTime(),
        getProfile: async () => ({
          id: "user-1",
          kycStatus: "VERIFIED",
          nationalCode: "0013542419",
          bankVerifiedAt: null,
        }),
        save: async (_userId, saved) => {
          savedMask = saved.mask;
          expect(saved.cardLast4).toBe("1111");
          expect(saved.iban).toBeNull();
        },
        audit: async (event) => {
          expect(JSON.stringify(event.meta)).not.toContain("4111111111111111");
        },
        matchCard: async () => ({ matched: true, trackId: "card-ok" }),
        matchIban: async () => ({ matched: true, trackId: "unused" }),
        limit: () => ({ ok: true, retryAfterSec: 0 }),
      },
      { userId: "user-1", card: "4111111111111111", ip: "203.0.113.11" }
    );
    expect(result.level).toBe(2);
    expect(savedMask).toContain("1111");
    expect(savedMask).not.toContain("4111111111111111");
  });
});
