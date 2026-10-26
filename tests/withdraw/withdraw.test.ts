import { describe, expect, it } from "vitest";
import { ibanCanReceive, parseCardIban } from "@/lib/finnotech/bank";
import { addVerifiedCard, type CardDeps, type CardIbanRecord, type NewCard } from "@/lib/kyc/bank-flow";
import { checkWithdrawal, validPayoutRef, WITHDRAW_NEXT } from "@/lib/withdraw/rules";

const CARD = "6037991234567893";
const IBAN = "IR820170000000123456789012";

function deps(over: Partial<CardDeps> = {}) {
  const saved: NewCard[] = [];
  const ibans: CardIbanRecord[] = [];
  const events: string[] = [];
  const d: CardDeps = {
    now: () => Date.parse("2026-10-26T08:00:00Z"),
    getProfile: async (id) => ({ id, kycStatus: "VERIFIED", nationalCode: "0012345679" }),
    hasCard: async () => false,
    save: async (_u, c) => void saved.push(c),
    saveIban: async (_u, _h, r) => void ibans.push(r),
    audit: async (e) => void events.push(e.action),
    matchCard: async () => ({ matched: true, trackId: "own-1" }),
    lookupIban: async () => ({ iban: IBAN, bankName: "بانک ملی ایران", owners: "مهدی معظمی", depositStatus: "02", trackId: "iban-1" }),
    limit: () => ({ ok: true, retryAfterSec: 0 }),
    ...over,
  };
  return { d, saved, ibans, events };
}

describe("Finnotech card-to-iban parsing", () => {
  it("normalizes IBAN and owners", () => {
    const r = parseCardIban(
      { IBAN: "ir82 0170 0000 0012 3456 7890 12", bankName: " بانک ملی ایران ", depositStatus: "02", depositOwners: [{ firstName: "مهدی", lastName: "معظمی" }] },
      "t1"
    );
    expect(r).toEqual({ iban: IBAN, bankName: "بانک ملی ایران", owners: "مهدی معظمی", depositStatus: "02", trackId: "t1" });
    expect(parseCardIban({ IBAN, depositOwners: "علی رضایی" }, "t").owners).toBe("علی رضایی");
  });
  it("rejects a malformed IBAN and inactive accounts", () => {
    expect(() => parseCardIban({ IBAN: "IR12" }, "t")).toThrow();
    expect(ibanCanReceive("02")).toBe(true);
    expect(ibanCanReceive("03")).toBe(true);
    expect(ibanCanReceive("05")).toBe(false);
  });
});

describe("addVerifiedCard + IBAN", () => {
  it("stores the IBAN with the new card; full PAN never saved", async () => {
    const { d, saved, events } = deps();
    const out = await addVerifiedCard(d, { userId: "u1", card: CARD, ip: "x" });
    expect(out.card.iban).toBe(IBAN);
    expect(saved[0].iban).toMatchObject({ iban: IBAN, owners: "مهدی معظمی", trackId: "iban-1" });
    expect(JSON.stringify(saved)).not.toContain(CARD);
    expect(events).toEqual(["kyc.card_verified"]);
  });
  it("keeps the card without IBAN when the lookup fails", async () => {
    const { d, saved, events } = deps({ lookupIban: async () => { throw new Error("down"); } });
    const out = await addVerifiedCard(d, { userId: "u1", card: CARD, ip: "x" });
    expect(out.card).toMatchObject({ iban: null, ibanError: "iban_unavailable" });
    expect(saved[0].iban).toBeNull();
    expect(events).toEqual(["kyc.iban_failed", "kyc.card_verified"]);
  });
  it("refuses an IBAN whose account cannot receive", async () => {
    const { d, saved } = deps({ lookupIban: async () => ({ iban: IBAN, bankName: null, owners: null, depositStatus: "05", trackId: "t" }) });
    const out = await addVerifiedCard(d, { userId: "u1", card: CARD, ip: "x" });
    expect(out.card).toMatchObject({ iban: null, ibanError: "iban_inactive" });
    expect(saved[0].iban).toBeNull();
  });
  it("re-entering an existing card without IBAN only fetches the IBAN", async () => {
    let matched = 0;
    const { d, saved, ibans } = deps({ hasCard: async () => ({ hasIban: false }), matchCard: async () => { matched++; return { matched: true, trackId: "x" }; } });
    const out = await addVerifiedCard(d, { userId: "u1", card: CARD, ip: "x" });
    expect(out.card.iban).toBe(IBAN);
    expect(ibans).toHaveLength(1);
    expect(saved).toHaveLength(0);
    expect(matched).toBe(0);
  });
  it("an existing card that already has an IBAN is a duplicate", async () => {
    const { d } = deps({ hasCard: async () => ({ hasIban: true }) });
    await expect(addVerifiedCard(d, { userId: "u1", card: CARD, ip: "x" })).rejects.toMatchObject({ code: "card_exists" });
  });
});

describe("withdrawal rules", () => {
  const card = { id: "c1", status: "VERIFIED", iban: IBAN, ibanDepositStatus: "02" };
  const base = { amountToman: 1_000_000, feeToman: 0, card, dailyCapToman: 50_000_000, usedTodayToman: 0 };
  it("reserves amount + fee in rial", () => {
    expect(checkWithdrawal({ ...base, feeToman: 5_000 })).toEqual({ ok: true, amountIrr: 10_000_000n, feeIrr: 50_000n, totalIrr: 10_050_000n });
  });
  it("only to a verified card with an IBAN", () => {
    expect(checkWithdrawal({ ...base, card: null })).toMatchObject({ ok: false, code: "invalid_card" });
    expect(checkWithdrawal({ ...base, card: { ...card, status: "DISABLED" } })).toMatchObject({ ok: false, code: "invalid_card" });
    expect(checkWithdrawal({ ...base, card: { ...card, iban: null } })).toMatchObject({ ok: false, code: "no_iban" });
    expect(checkWithdrawal({ ...base, card: { ...card, ibanDepositStatus: "07" } })).toMatchObject({ ok: false, code: "iban_inactive" });
  });
  it("min amount, level gate and daily cap", () => {
    expect(checkWithdrawal({ ...base, amountToman: 9_999 })).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(checkWithdrawal({ ...base, amountToman: 1.5 })).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(checkWithdrawal({ ...base, dailyCapToman: 0 })).toMatchObject({ ok: false, code: "withdraw_locked" });
    expect(checkWithdrawal({ ...base, usedTodayToman: 49_500_000 })).toMatchObject({ ok: false, code: "daily_limit" });
  });
  it("payout ref and state machine", () => {
    expect(validPayoutRef(" 140508041234567 ")).toBe("140508041234567");
    expect(validPayoutRef("12")).toBeNull();
    expect(validPayoutRef("ref with space")).toBeNull();
    expect(WITHDRAW_NEXT.pay.from).toEqual(["PENDING"]);
    expect(WITHDRAW_NEXT.cancel.to).toBe("CANCELLED");
  });
});
