/**
 * Display projection of `core_ledger_accounts`.
 *
 * Ledger units (see lib/core/money.ts):
 * - IRR is rial. 1 toman = 10 rial, so the panels show floor(rial / 10).
 * - GOLD, SILVER and COPPER are micrograms. 1 gram = 1_000_000 µg,
 *   1 milligram = 1_000 µg. The user panel keeps milligrams (the existing
 *   `goldMg` fields). Admin screens show grams.
 *
 * USER_AVAILABLE is spendable. USER_RESERVED is held. No other table,
 * including legacy `wallets`, is an input.
 */
import {
  irrToSafeTomanNumber,
  mulDivFloor,
  tomanToIrr,
  UG_PER_GRAM,
  ugToSafeMgNumber,
  type Irr,
  type Microgram,
} from "@/lib/core/money";

export const USER_BALANCE_CODES = ["USER_AVAILABLE", "USER_RESERVED"] as const;
export const DISPLAY_METALS = ["GOLD", "SILVER", "COPPER"] as const;
export type DisplayMetal = (typeof DISPLAY_METALS)[number];
export const USER_BALANCE_ASSETS = ["IRR", ...DISPLAY_METALS] as const;

export type LedgerBalanceRow = {
  holderId: string;
  accountCode: string;
  asset: string;
  balance: bigint;
};

export type MetalBalance = {
  availableUg: Microgram;
  reservedUg: Microgram;
  availableMg: number;
  reservedMg: number;
};

export type HolderLedgerView = {
  holderId: string;
  availableIrr: Irr;
  reservedIrr: Irr;
  availableToman: number;
  reservedToman: number;
  metals: Record<DisplayMetal, MetalBalance>;
};

export type UserPanelBalances = {
  rialAvailable: number;
  rialPending: number;
  goldMg: number;
  silverMg: number;
  copperMg: number;
};

export type AvgBuyTomanPerGram = {
  gold18: number;
  silver925: number;
  copper: number;
};

export const ZERO_AVG_BUY: AvgBuyTomanPerGram = {
  gold18: 0,
  silver925: 0,
  copper: 0,
};

export type BalancePayload = {
  balances: {
    irr: {
      availableRial: string;
      reservedRial: string;
      availableToman: number;
      reservedToman: number;
    };
    metals: Record<
      DisplayMetal,
      {
        availableUg: string;
        reservedUg: string;
        availableMg: number;
        reservedMg: number;
      }
    >;
  };
  ui: UserPanelBalances;
  avgBuyTomanPerGram: AvgBuyTomanPerGram;
};

function emptyMetal(): MetalBalance {
  return { availableUg: 0n, reservedUg: 0n, availableMg: 0, reservedMg: 0 };
}

export function parseLedgerBalance(raw: string | number | bigint | null | undefined): bigint {
  if (raw == null) return 0n;
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || !Number.isSafeInteger(raw)) {
      throw new Error("ledger balance is not a safe integer");
    }
    return BigInt(raw);
  }
  const text = String(raw).trim();
  if (!/^-?\d+$/.test(text)) throw new Error("ledger balance is not an integer");
  return BigInt(text);
}

function isDisplayMetal(asset: string): asset is DisplayMetal {
  return asset === "GOLD" || asset === "SILVER" || asset === "COPPER";
}

export function projectHolderLedger(holderId: string, rows: LedgerBalanceRow[]): HolderLedgerView {
  const metals: Record<DisplayMetal, MetalBalance> = {
    GOLD: emptyMetal(),
    SILVER: emptyMetal(),
    COPPER: emptyMetal(),
  };
  let availableIrr = 0n;
  let reservedIrr = 0n;

  for (const row of rows) {
    if (row.holderId !== holderId) continue;
    const available = row.accountCode === "USER_AVAILABLE";
    const reserved = row.accountCode === "USER_RESERVED";
    if (!available && !reserved) continue;
    if (row.asset === "IRR") {
      if (available) availableIrr = row.balance;
      else reservedIrr = row.balance;
      continue;
    }
    if (!isDisplayMetal(row.asset)) continue;
    if (available) metals[row.asset].availableUg = row.balance;
    else metals[row.asset].reservedUg = row.balance;
  }

  for (const asset of DISPLAY_METALS) {
    metals[asset].availableMg = ugToSafeMgNumber(metals[asset].availableUg);
    metals[asset].reservedMg = ugToSafeMgNumber(metals[asset].reservedUg);
  }

  return {
    holderId,
    availableIrr,
    reservedIrr,
    availableToman: irrToSafeTomanNumber(availableIrr),
    reservedToman: irrToSafeTomanNumber(reservedIrr),
    metals,
  };
}

/** Spendable cash and metal for the logged-in panel. Reserved metal stays out of `*Mg`. */
export function toUserPanelBalances(view: HolderLedgerView): UserPanelBalances {
  return {
    rialAvailable: view.availableToman,
    rialPending: view.reservedToman,
    goldMg: view.metals.GOLD.availableMg,
    silverMg: view.metals.SILVER.availableMg,
    copperMg: view.metals.COPPER.availableMg,
  };
}

export function payloadFromView(
  view: HolderLedgerView,
  avgBuyTomanPerGram: AvgBuyTomanPerGram = ZERO_AVG_BUY
): BalancePayload {
  const metals = {} as BalancePayload["balances"]["metals"];
  for (const asset of DISPLAY_METALS) {
    const metal = view.metals[asset];
    metals[asset] = {
      availableUg: metal.availableUg.toString(),
      reservedUg: metal.reservedUg.toString(),
      availableMg: metal.availableMg,
      reservedMg: metal.reservedMg,
    };
  }
  return {
    balances: {
      irr: {
        availableRial: view.availableIrr.toString(),
        reservedRial: view.reservedIrr.toString(),
        availableToman: view.availableToman,
        reservedToman: view.reservedToman,
      },
      metals,
    },
    ui: toUserPanelBalances(view),
    avgBuyTomanPerGram,
  };
}

export function tomanPerGramFromCost(quantityUg: bigint, costIrr: bigint): number {
  if (quantityUg <= 0n || costIrr <= 0n) return 0;
  const irrPerGram = mulDivFloor(costIrr, UG_PER_GRAM, quantityUg);
  return irrToSafeTomanNumber(irrPerGram);
}

export function avgBuyFromCostRows(
  rows: { asset: string; quantityUg: bigint; costIrr: bigint }[]
): AvgBuyTomanPerGram {
  const avg = { ...ZERO_AVG_BUY };
  for (const row of rows) {
    const toman = tomanPerGramFromCost(row.quantityUg, row.costIrr);
    if (row.asset === "GOLD") avg.gold18 = toman;
    else if (row.asset === "SILVER") avg.silver925 = toman;
    else if (row.asset === "COPPER") avg.copper = toman;
  }
  return avg;
}

export function formatUgAsGrams(weight: Microgram): string {
  const mg = ugToSafeMgNumber(weight);
  const grams = (mg / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 });
  return `${grams} گرم`;
}

export function formatLedgerAmount(asset: string, balance: bigint): string {
  if (asset === "IRR") {
    const toman = irrToSafeTomanNumber(balance);
    return `${toman.toLocaleString("fa-IR")} تومان`;
  }
  if (isDisplayMetal(asset)) return formatUgAsGrams(balance);
  return balance.toString();
}

/** True when USER_AVAILABLE IRR covers a toman spend. Never reads `wallets`. */
export function ledgerCoversToman(availableIrr: bigint, toman: number): boolean {
  if (!Number.isSafeInteger(toman) || toman < 0) return false;
  return availableIrr >= tomanToIrr(toman);
}

export type CustomerLedgerTotals = {
  availableToman: number;
  reservedToman: number;
  liabilityToman: number;
  goldMg: number;
  silverMg: number;
  copperMg: number;
};

export function sumCustomerLedger(rows: LedgerBalanceRow[]): CustomerLedgerTotals | null {
  try {
    const holders = new Set(rows.map((row) => row.holderId));
    let availableIrr = 0n;
    let reservedIrr = 0n;
    let goldUg = 0n;
    let silverUg = 0n;
    let copperUg = 0n;
    for (const holderId of holders) {
      const view = projectHolderLedger(holderId, rows);
      availableIrr += view.availableIrr;
      reservedIrr += view.reservedIrr;
      goldUg += view.metals.GOLD.availableUg;
      silverUg += view.metals.SILVER.availableUg;
      copperUg += view.metals.COPPER.availableUg;
    }
    return {
      availableToman: irrToSafeTomanNumber(availableIrr),
      reservedToman: irrToSafeTomanNumber(reservedIrr),
      liabilityToman: irrToSafeTomanNumber(availableIrr + reservedIrr),
      goldMg: ugToSafeMgNumber(goldUg),
      silverMg: ugToSafeMgNumber(silverUg),
      copperMg: ugToSafeMgNumber(copperUg),
    };
  } catch {
    return null;
  }
}
