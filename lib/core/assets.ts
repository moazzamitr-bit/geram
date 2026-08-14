import { UG_PER_GRAM, type Irr, type Microgram } from "@/lib/core/money";

export type AssetCode = "GOLD" | "SILVER" | "COPPER" | "TEST_METAL";
export type MoneyAsset = "IRR";
export type LedgerAsset = MoneyAsset | AssetCode;

export type PriceInstrument =
  | "IRAN_GOLD_18K_IRR_PER_GRAM"
  | "IRAN_SILVER_999_IRR_PER_GRAM"
  | "GLOBAL_COPPER_THEORETICAL_IRR_PER_GRAM"
  | "TEST_METAL_IRR_PER_GRAM";

export type AssetSpec = {
  code: AssetCode;
  displayName: string;
  displayNameFa: string;
  weightUnit: "microgram";
  displayDecimals: number;
  purityLabel: string;
  priceInstrument: PriceInstrument;
  minTradeUg: Microgram;
  maxTradeUg: Microgram;
  minTradeIrr: Irr;
  quoteTtlMs: number;
  buyEnabled: boolean;
  sellEnabled: boolean;
  custodyEnabled: boolean;
  procurementEnabled: boolean;
  /** Theoretical FX conversion is not a supplier executable price. */
  executableByDefault: boolean;
};

export const ASSET_SPECS: Record<AssetCode, AssetSpec> = {
  GOLD: {
    code: "GOLD",
    displayName: "Gold 18k",
    displayNameFa: "طلای ۱۸ عیار",
    weightUnit: "microgram",
    displayDecimals: 3,
    purityLabel: "18k / 750",
    priceInstrument: "IRAN_GOLD_18K_IRR_PER_GRAM",
    minTradeUg: UG_PER_GRAM / 1000n, // 1 mg
    maxTradeUg: UG_PER_GRAM * 10_000n,
    minTradeIrr: 5_000_000n, // 500_000 toman
    quoteTtlMs: 30_000,
    buyEnabled: true,
    sellEnabled: true,
    custodyEnabled: true,
    procurementEnabled: true,
    executableByDefault: true,
  },
  SILVER: {
    code: "SILVER",
    displayName: "Silver 999",
    displayNameFa: "نقره ۹۹۹",
    weightUnit: "microgram",
    displayDecimals: 3,
    purityLabel: "999",
    priceInstrument: "IRAN_SILVER_999_IRR_PER_GRAM",
    minTradeUg: UG_PER_GRAM / 1000n,
    maxTradeUg: UG_PER_GRAM * 50_000n,
    minTradeIrr: 2_000_000n, // 200_000 toman
    quoteTtlMs: 30_000,
    buyEnabled: true,
    sellEnabled: true,
    custodyEnabled: true,
    procurementEnabled: true,
    executableByDefault: true,
  },
  COPPER: {
    code: "COPPER",
    displayName: "Copper",
    displayNameFa: "مس",
    weightUnit: "microgram",
    displayDecimals: 3,
    purityLabel: "unspecified-industrial",
    priceInstrument: "GLOBAL_COPPER_THEORETICAL_IRR_PER_GRAM",
    minTradeUg: UG_PER_GRAM / 10n,
    maxTradeUg: UG_PER_GRAM * 1_000_000n,
    minTradeIrr: 1_000_000n, // 100_000 toman
    quoteTtlMs: 30_000,
    buyEnabled: true,
    sellEnabled: true,
    custodyEnabled: true,
    procurementEnabled: true,
    executableByDefault: false,
  },
  TEST_METAL: {
    code: "TEST_METAL",
    displayName: "Test metal",
    displayNameFa: "فلز آزمایشی",
    weightUnit: "microgram",
    displayDecimals: 3,
    purityLabel: "test",
    priceInstrument: "TEST_METAL_IRR_PER_GRAM",
    minTradeUg: 1n,
    maxTradeUg: UG_PER_GRAM * 1_000n,
    minTradeIrr: 10n,
    quoteTtlMs: 5_000,
    buyEnabled: true,
    sellEnabled: true,
    custodyEnabled: true,
    procurementEnabled: true,
    executableByDefault: true,
  },
};

/** Frozen UI query keys → production asset codes. */
export type UiInstrumentId = "gold18" | "silver925" | "copper";

export function uiInstrumentToAsset(id: string | null | undefined): AssetCode {
  switch (id) {
    case "silver925":
    case "SILVER":
      return "SILVER";
    case "copper":
    case "COPPER":
      return "COPPER";
    case "TEST_METAL":
      return "TEST_METAL";
    case "gold18":
    case "GOLD":
    default:
      return "GOLD";
  }
}

export function assetToUiInstrument(code: AssetCode): UiInstrumentId {
  if (code === "SILVER") return "silver925";
  if (code === "COPPER") return "copper";
  return "gold18";
}

export function isAssetCode(v: string): v is AssetCode {
  return v === "GOLD" || v === "SILVER" || v === "COPPER" || v === "TEST_METAL";
}

export const ALL_ASSETS: AssetCode[] = ["GOLD", "SILVER", "COPPER", "TEST_METAL"];
export const PRODUCTION_ASSETS: AssetCode[] = ["GOLD", "SILVER", "COPPER"];

export function getAssetSpec(code: AssetCode) {
  return ASSET_SPECS[code];
}
