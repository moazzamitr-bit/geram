import { describe, expect, it } from "vitest";
import { normalizeIranMobile, resolveCreditTarget, walletCreditRefId } from "@/lib/admin/wallet-credit";
import { SANDBOX_FLAGS } from "@/lib/core/mode";
import { tomanToIrr } from "@/lib/core/money";
import { PLATFORM_HOLDER } from "@/lib/core/types";
import { makeMemoryCore } from "../core/helpers";

describe("admin wallet credit", () => {
  it("posts one USER_AVAILABLE opening and replays the same ref", async () => {
    const { core, store } = makeMemoryCore({ seed: false });
    const user = "11111111-1111-4111-8111-111111111111";
    const amount = tomanToIrr(2_000_000);
    const refId = walletCreditRefId("credit-key-1");

    const first = await core.creditApprovedUserIrr({
      userId: user,
      amountIrr: amount,
      reason: "closed beta invite credit",
      refId,
    });
    const second = await core.creditApprovedUserIrr({
      userId: user,
      amountIrr: amount,
      reason: "closed beta invite credit",
      refId,
    });

    expect(first.replayed).toBe(false);
    expect(second).toEqual({ journalId: first.journalId, replayed: true });
    expect((await core.wallet(user)).rialAvailable).toBe(amount);

    const credits = (await store.listJournals()).filter((j) => j.refId === refId);
    expect(credits).toHaveLength(1);
    expect(credits[0]?.refType).toBe("APPROVED_OPENING_BALANCE");
    expect(credits[0]?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: "USER_AVAILABLE",
          holderId: user,
          asset: "IRR",
          debit: 0n,
          credit: amount,
        }),
        expect.objectContaining({
          accountCode: "PLATFORM_OPENING",
          holderId: PLATFORM_HOLDER,
          asset: "IRR",
          debit: amount,
          credit: 0n,
        }),
      ])
    );
  });

  it("rejects a credit aimed at the platform holder", async () => {
    const { core } = makeMemoryCore({ seed: false });
    await expect(
      core.creditApprovedUserIrr({
        userId: PLATFORM_HOLDER,
        amountIrr: 10n,
        reason: "should not credit platform",
        refId: walletCreditRefId("nope-key1"),
      })
    ).rejects.toMatchObject({ code: "invalid_user" });
  });
});

describe("credit target", () => {
  it("normalizes Iranian mobiles and resolves a phone to the profile", async () => {
    expect(normalizeIranMobile("+98 912 123 4567")).toBe("09121234567");
    expect(normalizeIranMobile("989121234567")).toBe("09121234567");
    expect(normalizeIranMobile("123")).toBeNull();

    const found = await resolveCreditTarget({
      phone: "+989121234567",
      lookupById: async () => null,
      lookupByPhones: async (phones) => {
        expect(phones).toContain("09121234567");
        expect(phones).toContain("+989121234567");
        return [{ id: "user-1", phone: "+989121234567" }];
      },
    });
    expect(found).toEqual({ ok: true, userId: "user-1", phone: "+989121234567" });
  });

  it("rejects an unknown phone", async () => {
    const missing = await resolveCreditTarget({
      phone: "09120000000",
      lookupById: async () => null,
      lookupByPhones: async () => [],
    });
    expect(missing).toMatchObject({ ok: false, error: "user_not_found", status: 404 });
  });
});

describe("user self-deposit flag", () => {
  it("blocks sandboxDeposit in SANDBOX when the flag is off", async () => {
    const { core } = makeMemoryCore({
      flags: { ...SANDBOX_FLAGS, SANDBOX_DEPOSIT_ENABLED: false },
    });
    await expect(core.sandboxDeposit("user-1", tomanToIrr(1_000), "dep-blocked")).rejects.toMatchObject({
      code: "sandbox_deposit_blocked",
    });
  });
});
