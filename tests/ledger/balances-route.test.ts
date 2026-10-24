import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoreError } from "@/lib/core/types";

const requireCoreUserId = vi.hoisted(() => vi.fn(async () => "user-session"));
const createServiceClient = vi.hoisted(() => vi.fn());
const holderFilters = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/core/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/core/http")>("@/lib/core/http");
  return { ...actual, requireCoreUserId };
});

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient,
}));

import { GET } from "@/app/api/me/balances/route";

const LEDGER_ROWS = [
  {
    holder_id: "user-session",
    account_code: "USER_AVAILABLE",
    asset: "IRR",
    balance: 500_000_000,
  },
  {
    holder_id: "user-session",
    account_code: "USER_RESERVED",
    asset: "IRR",
    balance: 20_000,
  },
  {
    holder_id: "user-session",
    account_code: "USER_AVAILABLE",
    asset: "GOLD",
    balance: "1500000",
  },
  {
    holder_id: "someone-else",
    account_code: "USER_AVAILABLE",
    asset: "IRR",
    balance: 9_999_999,
  },
];

function query(table: string) {
  const api = {
    select() {
      return api;
    },
    in() {
      return api;
    },
    eq(column: string, value: string) {
      if (table === "core_ledger_accounts" && column === "holder_id") holderFilters.push(value);
      return api;
    },
    limit() {
      return api;
    },
    then(
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown
    ) {
      if (table === "wallets") {
        return Promise.reject(new Error("wallets must not be read")).then(resolve, reject);
      }
      const body =
        table === "core_ledger_accounts"
          ? { data: LEDGER_ROWS, error: null }
          : { data: [], error: null };
      return Promise.resolve(body).then(resolve, reject);
    },
  };
  return api;
}

describe("GET /api/me/balances", () => {
  beforeEach(() => {
    holderFilters.length = 0;
    requireCoreUserId.mockReset();
    requireCoreUserId.mockResolvedValue("user-session");
    createServiceClient.mockReset();
    createServiceClient.mockImplementation(() => ({
      from(table: string) {
        return query(table);
      },
    }));
  });

  it("returns the session user's ledger credit as toman", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      source: "ledger",
      userId: "user-session",
      balances: {
        irr: {
          availableRial: "500000000",
          reservedRial: "20000",
          availableToman: 50_000_000,
          reservedToman: 2_000,
        },
        metals: {
          GOLD: { availableUg: "1500000", availableMg: 1500, reservedMg: 0 },
        },
      },
      ui: {
        rialAvailable: 50_000_000,
        rialPending: 2_000,
        goldMg: 1500,
      },
    });
    expect(holderFilters).toEqual(["user-session"]);
    expect(createServiceClient).toHaveBeenCalled();
  });

  it("does not fall back to wallets when the ledger cannot be read", async () => {
    createServiceClient.mockImplementation(() => {
      throw new Error("Supabase service env missing");
    });
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: "ledger_unavailable",
    });
  });

  it("rejects a caller who is not signed in", async () => {
    requireCoreUserId.mockRejectedValue(new CoreError("unauthorized", "Authentication required", 401));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});
