import { FinancialCore, feesFromCommercePercent } from "@/lib/core/engine";
import { MemoryCoreStore, type CoreStore } from "@/lib/core/store";
import { PostgresCoreStore } from "@/lib/core/pg-store";
import { tgjuExecutableFeed, staticPriceFeed } from "@/lib/core/price";
import { getExecutionMode } from "@/lib/core/mode";
import { DEFAULT_COMMERCE_SETTINGS } from "@/lib/commerce/types";
import { tomanToIrr } from "@/lib/core/money";
import { CoreError } from "@/lib/core/types";

const g = globalThis as unknown as {
  __geramCore?: FinancialCore;
  __geramStore?: MemoryCoreStore;
  __geramPg?: CoreStore;
};

async function fetchTgjuCurrent(): Promise<Record<string, unknown>> {
  const urls = [
    "https://call1.tgju.org/ajax.json",
    "https://call5.tgju.org/ajax.json",
    "https://call2.tgju.org/ajax.json",
  ];
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "GramCore/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        lastError = new Error(`TGJU HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { current?: Record<string, unknown> };
      if (!json.current) {
        lastError = new Error("TGJU payload missing current");
        continue;
      }
      return json.current;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("TGJU unreachable");
}

function testPrices() {
  return staticPriceFeed({
    GOLD: tomanToIrr(7_012_000),
    SILVER: tomanToIrr(384_000),
    COPPER: tomanToIrr(2_550),
    TEST_METAL: tomanToIrr(10_000),
  });
}

export function getMemoryStore() {
  if (!g.__geramStore) g.__geramStore = new MemoryCoreStore();
  return g.__geramStore;
}

function dbUrl() {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
}

function getStore(): CoreStore {
  const url = dbUrl();
  const mode = getExecutionMode();
  if (!url) {
    if (mode === "PRODUCTION") {
      throw new CoreError(
        "misconfigured",
        "DATABASE_URL is required when GERAM_EXECUTION_MODE=PRODUCTION",
        500
      );
    }
    return getMemoryStore();
  }
  if (g.__geramPg) return g.__geramPg;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({ connectionString: url, max: 4 });
  const base = {
    query: async (sql: string, params: unknown[] = []) => {
      const res = await pool.query(sql, params);
      return { rows: res.rows as Record<string, unknown>[] };
    },
    exec: async (sql: string, params: unknown[] = []) => {
      await pool.query(sql, params);
    },
  };
  g.__geramPg = new PostgresCoreStore(base, async () => {
    const client = await pool.connect();
    await client.query("begin");
    const session = {
      query: async (sql: string, params: unknown[] = []) => {
        const res = await client.query(sql, params);
        return { rows: res.rows as Record<string, unknown>[] };
      },
      exec: async (sql: string, params: unknown[] = []) => {
        await client.query(sql, params);
      },
    };
    return {
      session,
      commit: async () => {
        await client.query("commit");
      },
      rollback: async () => {
        await client.query("rollback").catch(() => undefined);
      },
      release: () => client.release(),
    };
  });
  return g.__geramPg;
}

export function getFinancialCore(): FinancialCore {
  if (g.__geramCore) return g.__geramCore;
  const mode = getExecutionMode();
  const store = getStore();
  const useStatic = process.env.GERAM_PRICE_FEED === "static" || process.env.VITEST === "true";
  const prices = useStatic ? testPrices() : tgjuExecutableFeed(fetchTgjuCurrent);
  const fees = DEFAULT_COMMERCE_SETTINGS.fees;
  g.__geramCore = new FinancialCore({
    store,
    prices,
    mode,
    fees: feesFromCommercePercent({
      plus: false,
      buyFeePercentFree: fees.buyFeePercentFree,
      buyFeePercentPlus: fees.buyFeePercentPlus,
      buyFeeMinTomanFree: fees.buyFeeMinTomanFree,
      buyFeeMinTomanPlus: fees.buyFeeMinTomanPlus,
      sellFeePercentFree: fees.sellFeePercentFree,
      sellFeePercentPlus: fees.sellFeePercentPlus,
      sellFeeMinTomanFree: fees.sellFeeMinTomanFree,
      sellFeeMinTomanPlus: fees.sellFeeMinTomanPlus,
    }),
  });
  return g.__geramCore;
}

export function resetFinancialCoreForTests() {
  g.__geramCore = undefined;
  g.__geramStore = undefined;
  g.__geramPg = undefined;
}
