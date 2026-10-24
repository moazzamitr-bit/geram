import { beforeEach, describe, expect, it, vi } from "vitest";
import { tomanToIrr } from "@/lib/core/money";
import { walletCreditRefId } from "@/lib/admin/wallet-credit";

type Row = Record<string, unknown>;

const { state, adminGate, writeAudit, creditApprovedUserIrr } = vi.hoisted(() => ({
  state: {
    profiles: [] as Row[],
    approvals: [] as Row[],
  },
  adminGate: vi.fn(),
  writeAudit: vi.fn(async () => {}),
  creditApprovedUserIrr: vi.fn(async () => ({ journalId: "jnl-1", replayed: false })),
}));

function createFakeDb() {
  return {
    from(table: string) {
      const bucket = table === "profiles" ? state.profiles : state.approvals;
      const filters: Array<(row: Row) => boolean> = [];
      let op: "select" | "insert" | "update" = "select";
      let payload: Row | null = null;
      let limitN = 100;
      let ran = false;
      let result: Row[] = [];

      const exec = () => {
        if (ran) return result;
        ran = true;
        if (op === "insert" && payload) {
          const row = {
            id: `apr-${state.approvals.length + 1}`,
            created_at: new Date().toISOString(),
            ...payload,
          };
          bucket.push(row);
          result = [row];
          return result;
        }
        const matched = bucket.filter((row) => filters.every((fn) => fn(row)));
        if (op === "update" && payload) {
          for (const row of matched) Object.assign(row, payload);
        }
        result = matched.slice(0, limitN);
        return result;
      };

      const api = {
        select() {
          return api;
        },
        insert(row: Row) {
          op = "insert";
          payload = row;
          return api;
        },
        update(row: Row) {
          op = "update";
          payload = row;
          return api;
        },
        eq(col: string, val: unknown) {
          filters.push((row) => row[col] === val);
          return api;
        },
        in(col: string, vals: unknown[]) {
          filters.push((row) => vals.includes(row[col]));
          return api;
        },
        contains(col: string, obj: Record<string, unknown>) {
          filters.push((row) => {
            const value = row[col];
            if (!value || typeof value !== "object") return false;
            return Object.entries(obj).every(
              ([key, expected]) => (value as Record<string, unknown>)[key] === expected
            );
          });
          return api;
        },
        limit(n: number) {
          limitN = n;
          return api;
        },
        maybeSingle() {
          const rows = exec();
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(
          onFulfilled?: (value: { data: Row[]; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          return Promise.resolve(exec()).then((data) => ({ data, error: null })).then(onFulfilled, onRejected);
        },
      };
      return api;
    },
  };
}

vi.mock("@/lib/admin/auth", () => ({
  adminGate,
  readActionBody: async (request: Request) => {
    const json = (await request.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(json ?? {})) {
      if (value == null) continue;
      out[key] = typeof value === "string" ? value : String(value);
    }
    return out;
  },
}));

vi.mock("@/lib/admin/audit", () => ({ writeAudit }));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => createFakeDb(),
}));

vi.mock("@/lib/core/runtime", () => ({
  getFinancialCore: () => ({ creditApprovedUserIrr }),
}));

import { POST } from "@/app/api/admin/approvals/route";

const USER = "11111111-1111-4111-8111-111111111111";

function asAdmin(userId: string, role = "SUPER_ADMIN") {
  adminGate.mockResolvedValue({
    ok: true,
    ctx: { userId, role },
  });
}

function creditRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/approvals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/approvals wallet credit", () => {
  beforeEach(() => {
    state.profiles.length = 0;
    state.approvals.length = 0;
    state.profiles.push({ id: USER, phone: "09121234567" });
    asAdmin("admin-1");
    writeAudit.mockClear();
    creditApprovedUserIrr.mockReset();
    creditApprovedUserIrr.mockResolvedValue({ journalId: "jnl-1", replayed: false });
  });

  it("posts USER_AVAILABLE immediately for the same admin and audits them", async () => {
    const res = await POST(
      creditRequest({
        action: "create",
        kind: "FINANCIAL_ADJUSTMENT",
        userId: USER,
        amount: "2000000",
        idempotencyKey: "credit-key-1",
        reason: "closed beta invite credit",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      journalId: "jnl-1",
      replayed: false,
    });
    expect(creditApprovedUserIrr).toHaveBeenCalledOnce();
    expect(creditApprovedUserIrr).toHaveBeenCalledWith({
      userId: USER,
      amountIrr: tomanToIrr(2_000_000),
      reason: "closed beta invite credit",
      refId: walletCreditRefId("credit-key-1"),
    });
    expect(state.approvals).toHaveLength(1);
    expect(state.approvals[0]).toMatchObject({
      status: "EXECUTED",
      maker_id: "admin-1",
      checker_id: "admin-1",
      kind: "FINANCIAL_ADJUSTMENT",
    });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "approval.execute",
        result: "ok",
        meta: expect.objectContaining({ singleAdmin: true, journalId: "jnl-1" }),
      })
    );
  });

  it("replays the same key without a second journal", async () => {
    const body = {
      action: "create",
      kind: "FINANCIAL_ADJUSTMENT",
      userId: USER,
      amount: "2000000",
      idempotencyKey: "credit-key-1",
      reason: "closed beta invite credit",
    };
    await POST(creditRequest(body));
    creditApprovedUserIrr.mockClear();
    const replay = await POST(creditRequest(body));
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ ok: true, replayed: true });
    expect(creditApprovedUserIrr).not.toHaveBeenCalled();
    expect(state.approvals).toHaveLength(1);
  });

  it("rejects a reused key with a different amount", async () => {
    await POST(
      creditRequest({
        action: "create",
        kind: "FINANCIAL_ADJUSTMENT",
        userId: USER,
        amount: "2000000",
        idempotencyKey: "credit-key-1",
        reason: "closed beta invite credit",
      })
    );
    creditApprovedUserIrr.mockClear();
    const res = await POST(
      creditRequest({
        action: "create",
        kind: "FINANCIAL_ADJUSTMENT",
        userId: USER,
        amount: "3000000",
        idempotencyKey: "credit-key-1",
        reason: "closed beta invite credit",
      })
    );
    expect(res.status).toBe(409);
    expect(creditApprovedUserIrr).not.toHaveBeenCalled();
  });

  it("keeps amount checks and does not credit an unknown user", async () => {
    const badAmount = await POST(
      creditRequest({
        action: "create",
        kind: "FINANCIAL_ADJUSTMENT",
        userId: USER,
        amount: "0",
        idempotencyKey: "credit-key-2",
        reason: "closed beta invite credit",
      })
    );
    expect(badAmount.status).toBe(400);
    const missing = await POST(
      creditRequest({
        action: "create",
        kind: "FINANCIAL_ADJUSTMENT",
        userId: "22222222-2222-4222-8222-222222222222",
        amount: "1000",
        idempotencyKey: "credit-key-3",
        reason: "closed beta invite credit",
      })
    );
    expect(missing.status).toBe(404);
    expect(creditApprovedUserIrr).not.toHaveBeenCalled();
  });

  it("refuses a role that cannot write treasury", async () => {
    asAdmin("admin-1", "AUDITOR_READONLY");
    const res = await POST(
      creditRequest({
        action: "create",
        kind: "FINANCIAL_ADJUSTMENT",
        userId: USER,
        amount: "1000",
        idempotencyKey: "credit-key-4",
        reason: "closed beta invite credit",
      })
    );
    expect(res.status).toBe(403);
    expect(creditApprovedUserIrr).not.toHaveBeenCalled();
    expect(state.approvals).toHaveLength(0);
  });

  it("lets the maker finish a leftover pending wallet credit in one step", async () => {
    state.approvals.push({
      id: "old-1",
      kind: "FINANCIAL_ADJUSTMENT",
      status: "PENDING_APPROVAL",
      maker_id: "admin-1",
      checker_id: null,
      payload: {
        userId: USER,
        amount: "1500000",
        asset: "IRR",
        direction: "CREDIT",
        idempotencyKey: "legacy-key-1",
      },
    });
    const res = await POST(
      creditRequest({
        action: "approve",
        id: "old-1",
        reason: "apply leftover credit now",
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, journalId: "jnl-1" });
    expect(creditApprovedUserIrr).toHaveBeenCalledOnce();
    expect(state.approvals[0]).toMatchObject({
      status: "EXECUTED",
      checker_id: "admin-1",
    });
  });

  it("still requires a different admin for opening inventory", async () => {
    const created = await POST(
      creditRequest({
        action: "create",
        kind: "INVENTORY_ADJUSTMENT",
        asset: "GOLD",
        amount: "10",
        direction: "IN",
        reason: "opening stock for beta",
      })
    );
    expect(created.status).toBe(200);
    expect(state.approvals[0]).toMatchObject({
      status: "PENDING_APPROVAL",
      maker_id: "admin-1",
      kind: "INVENTORY_ADJUSTMENT",
    });
    expect(creditApprovedUserIrr).not.toHaveBeenCalled();

    const own = await POST(
      creditRequest({
        action: "approve",
        id: state.approvals[0].id,
        reason: "trying to approve my own stock",
      })
    );
    expect(own.status).toBe(403);
    expect(state.approvals[0].status).toBe("PENDING_APPROVAL");

    asAdmin("admin-2");
    const other = await POST(
      creditRequest({
        action: "approve",
        id: state.approvals[0].id,
        reason: "second admin confirms stock",
      })
    );
    expect(other.status).toBe(200);
    await expect(other.json()).resolves.toMatchObject({
      ok: true,
      message: "تأیید شد. اجرا جداگانه است.",
    });
    expect(state.approvals[0]).toMatchObject({ status: "APPROVED", checker_id: "admin-2" });
    expect(creditApprovedUserIrr).not.toHaveBeenCalled();
  });

  it("puts the credit row back to APPROVED when the journal fails", async () => {
    creditApprovedUserIrr.mockRejectedValueOnce(new Error("ledger down"));
    const res = await POST(
      creditRequest({
        action: "create",
        kind: "FINANCIAL_ADJUSTMENT",
        userId: USER,
        amount: "2000000",
        idempotencyKey: "credit-key-9",
        reason: "closed beta invite credit",
      })
    );
    expect(res.status).toBe(500);
    expect(state.approvals[0].status).toBe("APPROVED");
  });
});
