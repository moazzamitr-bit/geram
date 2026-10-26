import { describe, expect, it } from "vitest";
import { addVerifiedCard, type CardDeps, type NewCard } from "@/lib/kyc/bank-flow";
import { normalizeIranCard } from "@/lib/kyc/bank-id";
import { bankForCard, cardDigits, formatCardGroups, maskCard } from "@/lib/kyc/card";
import { effectiveTradeLimits, resolveKycLevel } from "@/lib/kyc/levels";
import { verificationRequiredError, verificationState } from "@/lib/kyc/verification";
import { KycFlowError } from "@/lib/kyc/flow";

const CARD = "6037991234567893"; // Luhn-valid test number, Melli BIN

describe("verification state", () => {
  it("needs identity first, then a card", () => {
    expect(verificationState("UNVERIFIED", 0)).toMatchObject({ level: 0, nextStep: "identity" });
    expect(verificationState("UNVERIFIED", 2)).toMatchObject({ level: 0, nextStep: "identity", card: false });
    expect(verificationState("VERIFIED", 0)).toMatchObject({ level: 1, nextStep: "card" });
    expect(verificationState("VERIFIED", 1)).toMatchObject({ level: 2, nextStep: null });
  });

  it("gate error is 403 verification_required with nextStep", () => {
    const err = verificationRequiredError(verificationState("VERIFIED", 0));
    expect(err.code).toBe("verification_required");
    expect(err.httpStatus).toBe(403);
    expect(err.details).toEqual({ nextStep: "card" });
  });

  it("caps: below level 2 nothing is tradable", () => {
    expect(resolveKycLevel({ identity: true, card: false })).toBe(1);
    const limits = { dailyBuyToman: 0, dailySellToman: 0, dailyWithdrawToman: 0 };
    expect(effectiveTradeLimits(limits, 1).dailyBuyToman).toBe(0);
    expect(effectiveTradeLimits(limits, 2).dailyBuyToman).toBe(1_000_000_000);
  });
});

describe("card helpers", () => {
  it("groups as typed, reads Persian digits, finds the bank by BIN", () => {
    expect(formatCardGroups("۶۰۳۷۹۹12")).toBe("6037 9912");
    expect(cardDigits("6037-9912-3456-7893")).toBe(CARD);
    expect(bankForCard(CARD)?.name).toBe("بانک ملی");
    expect(bankForCard("6104331111111111")?.name).toBe("بانک ملت");
    expect(maskCard(CARD)).toBe("6037 99•• •••• 7893");
  });

  it("Luhn", () => {
    expect(normalizeIranCard(CARD)).toBe(CARD);
    expect(normalizeIranCard("6037991234567890")).toBeNull();
    expect(normalizeIranCard("123")).toBeNull();
  });
});

function deps(overrides: Partial<CardDeps> = {}) {
  const saved: NewCard[] = [];
  const events: string[] = [];
  const d: CardDeps = {
    now: () => Date.parse("2026-10-25T08:00:00Z"),
    configured: true,
    getProfile: async (id) => ({ id, kycStatus: "VERIFIED", nationalCode: "0013542419" }),
    hasCard: async () => false,
    save: async (_userId, card) => {
      saved.push(card);
    },
    audit: async (event) => {
      events.push(event.action);
    },
    matchCard: async () => ({ matched: true, trackId: "t1" }),
    limit: () => ({ ok: true, retryAfterSec: 0 }),
    ...overrides,
  };
  return { d, saved, events };
}

describe("addVerifiedCard", () => {
  it("saves masked + hashed card only on a Finnotech match", async () => {
    const { d, saved, events } = deps();
    const out = await addVerifiedCard(d, { userId: "u1", card: CARD, ip: "1.1.1.1" });
    expect(out.card).toEqual({ panMasked: "6037 99•• •••• 7893", bankName: "بانک ملی", bankCode: "melli", iban: null });
    expect(saved[0].panHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(saved)).not.toContain(CARD);
    expect(events).toEqual(["kyc.card_verified"]);
  });

  it("rejects a card in someone else's name", async () => {
    const { d, saved } = deps({ matchCard: async () => ({ matched: false, trackId: "t2" }) });
    await expect(addVerifiedCard(d, { userId: "u1", card: CARD, ip: "x" })).rejects.toMatchObject({ code: "bank_mismatch" });
    expect(saved).toHaveLength(0);
  });

  it("needs identity first, rejects bad Luhn and duplicates before calling the bank", async () => {
    let called = 0;
    const matchCard = async () => {
      called++;
      return { matched: true, trackId: "t" };
    };
    await expect(
      addVerifiedCard(deps({ matchCard, getProfile: async (id) => ({ id, kycStatus: "UNVERIFIED", nationalCode: null }) }).d, {
        userId: "u",
        card: CARD,
        ip: "x",
      })
    ).rejects.toMatchObject({ code: "identity_required" });
    await expect(addVerifiedCard(deps({ matchCard }).d, { userId: "u", card: "6037991234567890", ip: "x" })).rejects.toBeInstanceOf(KycFlowError);
    await expect(
      addVerifiedCard(deps({ matchCard, hasCard: async () => true }).d, { userId: "u", card: CARD, ip: "x" })
    ).rejects.toMatchObject({ code: "card_exists" });
    expect(called).toBe(0);
  });
});
