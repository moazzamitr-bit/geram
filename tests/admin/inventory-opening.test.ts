import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  inventoryOpeningRefId,
  planImmediateInventoryOpening,
} from "@/lib/admin/inventory-opening";
import { gramsToUg, tomanToIrr, UG_PER_GRAM } from "@/lib/core/money";
import { PLATFORM_HOLDER } from "@/lib/core/types";
import { makeMemoryCore } from "../core/helpers";

const payload = {
  asset: "GOLD",
  amount: "12.5",
  direction: "IN",
  idempotencyKey: "opening-key-9",
  ledgerAmount: gramsToUg(12.5).toString(),
  accountCode: "PLATFORM_AVAILABLE",
};

describe("immediate inventory opening plan", () => {
  it("posts a new opening without a second admin", () => {
    const plan = planImmediateInventoryOpening({
      asset: "GOLD",
      amount: "12.5",
      direction: "IN",
      idempotencyKey: "opening-key-9",
      prior: null,
    });
    expect(plan).toMatchObject({
      ok: true,
      record: "insert",
      priorId: null,
      asset: "GOLD",
      accountCode: "PLATFORM_AVAILABLE",
      ledgerAmount: gramsToUg(12.5),
      refId: inventoryOpeningRefId("opening-key-9"),
    });
  });

  it("posts operating cash to PLATFORM_CASH_CONTROL", () => {
    const plan = planImmediateInventoryOpening({
      asset: "IRR",
      amount: "5000000",
      idempotencyKey: "cash-key-1234",
      prior: null,
    });
    expect(plan).toMatchObject({
      ok: true,
      asset: "IRR",
      accountCode: "PLATFORM_CASH_CONTROL",
      ledgerAmount: tomanToIrr(5_000_000),
    });
  });

  it("replays an executed opening and finishes a queued one", () => {
    expect(
      planImmediateInventoryOpening({
        asset: "GOLD",
        amount: "12.5",
        direction: "IN",
        idempotencyKey: "opening-key-9",
        prior: { id: "row-1", status: "EXECUTED", payload },
      })
    ).toMatchObject({ ok: true, record: "already_recorded", priorId: "row-1" });
    expect(
      planImmediateInventoryOpening({
        asset: "GOLD",
        amount: "12.500",
        direction: "IN",
        idempotencyKey: "opening-key-9",
        prior: { id: "row-2", status: "PENDING_APPROVAL", payload },
      })
    ).toMatchObject({ ok: true, record: "mark_executed", priorId: "row-2" });
  });

  it("does not revive a rejected key or a different amount", () => {
    expect(
      planImmediateInventoryOpening({
        asset: "GOLD",
        amount: "12.5",
        idempotencyKey: "opening-key-9",
        prior: { id: "row-3", status: "REJECTED", payload },
      })
    ).toMatchObject({ ok: false, error: "opening_rejected", status: 409 });
    expect(
      planImmediateInventoryOpening({
        asset: "GOLD",
        amount: "1",
        idempotencyKey: "opening-key-9",
        prior: { id: "row-4", status: "EXECUTED", payload },
      })
    ).toMatchObject({ ok: false, error: "idempotency_conflict", status: 409 });
  });

  it("rejects a decrease and an unknown asset", () => {
    expect(
      planImmediateInventoryOpening({
        asset: "GOLD",
        amount: "1",
        direction: "OUT",
        idempotencyKey: "opening-key-9",
        prior: null,
      })
    ).toMatchObject({ ok: false, error: "only_increase" });
    expect(
      planImmediateInventoryOpening({
        asset: "PLATINUM",
        amount: "1",
        idempotencyKey: "opening-key-9",
        prior: null,
      })
    ).toMatchObject({ ok: false, error: "invalid_amount" });
  });
});

describe("platform opening journal", () => {
  it("posts one PLATFORM_AVAILABLE opening and replays the same ref", async () => {
    const { core, store } = makeMemoryCore({ seed: false });
    const amount = 2n * UG_PER_GRAM;
    const refId = inventoryOpeningRefId("gold-key-1");
    const first = await core.postApprovedPlatformOpening({
      accountCode: "PLATFORM_AVAILABLE",
      asset: "GOLD",
      amount,
      reason: "closed beta opening gold",
      refId,
    });
    const second = await core.postApprovedPlatformOpening({
      accountCode: "PLATFORM_AVAILABLE",
      asset: "GOLD",
      amount,
      reason: "closed beta opening gold",
      refId,
    });
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ journalId: first.journalId, replayed: true });

    const journals = (await store.listJournals()).filter((j) => j.refId === refId);
    expect(journals).toHaveLength(1);
    expect(journals[0]?.refType).toBe("APPROVED_OPENING_BALANCE");
    expect(journals[0]?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: "PLATFORM_AVAILABLE",
          holderId: PLATFORM_HOLDER,
          asset: "GOLD",
          debit: 0n,
          credit: amount,
        }),
        expect.objectContaining({
          accountCode: "PLATFORM_OPENING",
          holderId: PLATFORM_HOLDER,
          asset: "GOLD",
          debit: amount,
          credit: 0n,
        }),
      ])
    );
    const account = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "GOLD");
    expect(account?.balance).toBe(amount);
  });

  it("rejects the same ref when the amount differs and keeps the first balance", async () => {
    const { core, store } = makeMemoryCore({ seed: false });
    const refId = inventoryOpeningRefId("gold-key-2");
    await core.postApprovedPlatformOpening({
      accountCode: "PLATFORM_AVAILABLE",
      asset: "GOLD",
      amount: UG_PER_GRAM,
      reason: "closed beta opening gold",
      refId,
    });
    await expect(
      core.postApprovedPlatformOpening({
        accountCode: "PLATFORM_AVAILABLE",
        asset: "GOLD",
        amount: 2n * UG_PER_GRAM,
        reason: "closed beta opening gold",
        refId,
      })
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    const account = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "GOLD");
    expect(account?.balance).toBe(UG_PER_GRAM);
  });

  it("posts operating cash once", async () => {
    const { core, store } = makeMemoryCore({ seed: false });
    const amount = tomanToIrr(1_000_000);
    const posted = await core.postApprovedPlatformOpening({
      accountCode: "PLATFORM_CASH_CONTROL",
      asset: "IRR",
      amount,
      reason: "closed beta operating cash",
      refId: inventoryOpeningRefId("cash-key-1"),
    });
    expect(posted.replayed).toBe(false);
    const account = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_CASH_CONTROL", "IRR");
    expect(account?.balance).toBe(amount);
  });
});

describe("single-admin copy", () => {
  const root = process.cwd();
  const files = [
    "components/admin/InventoryRequestForm.tsx",
    "app/admin/(dashboard)/approvals/page.tsx",
    "app/api/admin/approvals/route.ts",
    "lib/admin/navigation.ts",
    "app/admin/(dashboard)/settings/page.tsx",
    "app/admin/(dashboard)/market/page.tsx",
    "app/admin/(dashboard)/procurement/page.tsx",
    "app/admin/(dashboard)/reconciliation/page.tsx",
    "app/admin/(dashboard)/treasury/page.tsx",
    "app/admin/(dashboard)/bank-accounts/page.tsx",
    "app/admin/(dashboard)/inventory/page.tsx",
    "app/api/admin/bank/route.ts",
    "app/api/admin/reconciliation/route.ts",
    "docs/DEPLOY.md",
    "AGENTS.md",
    ".cursor/rules/geram.mdc",
  ];

  it("does not mention a second admin or maker-checker", () => {
    for (const file of files) {
      const text = readFileSync(path.join(root, file), "utf8");
      expect(text, file).not.toMatch(/ادمین دوم|دو ادمین|maker-checker|تأیید دو مرحله|سازنده نمی‌تواند/);
    }
    const form = readFileSync(path.join(root, "components/admin/InventoryRequestForm.tsx"), "utf8");
    expect(form).toContain("ثبت در دفترکل");
    expect(form).toContain("PLATFORM_AVAILABLE");
    expect(form).toContain("idempotencyKey");
    const route = readFileSync(path.join(root, "app/api/admin/approvals/route.ts"), "utf8");
    expect(route).not.toContain("row.maker_id === gate.ctx.userId");
    expect(route).toContain("writeAudit");
    expect(route).toContain("postApprovedPlatformOpening");
  });
});
