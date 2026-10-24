import { FinancialCore, type EngineDeps } from "@/lib/core/engine";
import { MemoryCoreStore } from "@/lib/core/store";
import { PostgresCoreStore } from "@/lib/core/pg-store";
import { staticPriceFeed } from "@/lib/core/price";
import { tomanToIrr, UG_PER_GRAM } from "@/lib/core/money";
import { DEFAULT_FEE_SNAPSHOT } from "@/lib/core/fees";
import { SANDBOX_FLAGS, CONSERVATIVE_FLAGS, type ExecutionMode } from "@/lib/core/mode";
import { CORE_SCHEMA_SQL } from "@/lib/core/schema";
import { PGlite } from "@electric-sql/pglite";
import type { AssetCode } from "@/lib/core/assets";

export const TEST_PRICES = {
  GOLD: tomanToIrr(7_000_000),
  SILVER: tomanToIrr(400_000),
  COPPER: tomanToIrr(2_500),
  TEST_METAL: tomanToIrr(10_000),
};

export const DEFAULT_INVENTORY: Record<AssetCode, bigint> = {
  GOLD: UG_PER_GRAM * 1_000n,
  SILVER: UG_PER_GRAM * 1_000n,
  COPPER: UG_PER_GRAM * 10_000n,
  TEST_METAL: UG_PER_GRAM * 1_000n,
};

export function makeMemoryCore(
  opts?: Partial<EngineDeps> & {
    inventory?: bigint;
    seed?: boolean;
    allowSandboxDeposit?: boolean;
  }
) {
  const store = opts?.store ?? new MemoryCoreStore();
  const inventory = opts?.inventory;
  const mode = opts?.mode ?? "SANDBOX";
  const core = new FinancialCore({
    store,
    prices: opts?.prices ?? staticPriceFeed(TEST_PRICES),
    mode,
    flags: opts?.flags ?? (mode === "SANDBOX" ? SANDBOX_FLAGS : CONSERVATIVE_FLAGS),
    seedForTests: opts?.seedForTests ?? (mode === "SANDBOX" && opts?.seed !== false),
    allowSandboxDeposit: opts?.allowSandboxDeposit ?? mode === "SANDBOX",
    fees: opts?.fees ?? {
      ...DEFAULT_FEE_SNAPSHOT,
      buyFeeMinIrr: 0n,
      sellFeeMinIrr: 0n,
      buyFeeBps: 70n,
      sellFeeBps: 50n,
    },
    now: opts?.now,
    seedInventoryUg: opts?.seedInventoryUg ?? {
      GOLD: inventory ?? DEFAULT_INVENTORY.GOLD,
      SILVER: inventory ?? DEFAULT_INVENTORY.SILVER,
      COPPER: inventory ?? DEFAULT_INVENTORY.COPPER,
      TEST_METAL: inventory ?? DEFAULT_INVENTORY.TEST_METAL,
    },
    seedCashIrr: opts?.seedCashIrr,
    kills: opts?.kills,
    spread: opts?.spread,
    safetyBufferUg: opts?.safetyBufferUg,
  });
  return { store, core };
}

export async function makePgLite() {
  const db = new PGlite();
  await db.exec(CORE_SCHEMA_SQL);
  const store = new PostgresCoreStore({
    query: async (sql, params = []) => {
      const res = await db.query(sql, params);
      return { rows: res.rows as Record<string, unknown>[] };
    },
    exec: async (sql, params = []) => {
      await db.query(sql, params);
    },
  });
  return { db, store };
}

export function makePgCore(
  store: PostgresCoreStore,
  opts?: { mode?: ExecutionMode; seed?: boolean; inventory?: bigint }
) {
  const inventory = opts?.inventory;
  const mode = opts?.mode ?? "SANDBOX";
  const flags = mode === "SANDBOX" ? SANDBOX_FLAGS : { ...CONSERVATIVE_FLAGS };
  return new FinancialCore({
    store,
    prices: staticPriceFeed(TEST_PRICES),
    mode,
    flags,
    seedForTests: mode === "SANDBOX" && opts?.seed !== false,
    allowSandboxDeposit: mode === "SANDBOX",
    fees: { ...DEFAULT_FEE_SNAPSHOT, buyFeeMinIrr: 0n, sellFeeMinIrr: 0n },
    seedInventoryUg: {
      GOLD: inventory ?? UG_PER_GRAM * 100n,
      SILVER: inventory ?? UG_PER_GRAM * 100n,
      COPPER: inventory ?? UG_PER_GRAM * 100n,
      TEST_METAL: inventory ?? UG_PER_GRAM * 100n,
    },
  });
}
