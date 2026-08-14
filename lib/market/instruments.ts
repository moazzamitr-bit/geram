export type InstrumentId = "gold18" | "silver925" | "copper";

export type InstrumentMeta = {
  id: InstrumentId;
  /** Short Persian name for tabs / chips */
  label: string;
  /** Full market title */
  title: string;
  /** Unit label shown next to weight */
  unitLabel: string;
  /** TGJU / derived source description */
  sourceHint: string;
  /** Minimum buy amount in تومان */
  minBuyToman: number;
  /** Fallback seed price (تومان / گرم) when offline */
  fallbackPriceToman: number;
  /** Accent for UI chips */
  accent: string;
};

export const INSTRUMENTS: Record<InstrumentId, InstrumentMeta> = {
  gold18: {
    id: "gold18",
    label: "طلا",
    title: "طلای ۱۸ عیار",
    unitLabel: "گرم",
    sourceHint: "بازار آزاد · TGJU geram18",
    minBuyToman: 500_000,
    fallbackPriceToman: 7_012_000,
    accent: "#D6A84B",
  },
  silver925: {
    id: "silver925",
    label: "نقره",
    title: "نقره ۹۹۹",
    unitLabel: "گرم",
    sourceHint: "بازار آزاد · TGJU silver_999",
    minBuyToman: 200_000,
    fallbackPriceToman: 384_000,
    accent: "#C0C7D1",
  },
  copper: {
    id: "copper",
    label: "مس",
    title: "مس (گرم)",
    unitLabel: "گرم",
    sourceHint: "LME + دلار آزاد",
    minBuyToman: 100_000,
    fallbackPriceToman: 2_550,
    accent: "#B87333",
  },
};

export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as InstrumentId[];

export function isInstrumentId(value: unknown): value is InstrumentId {
  return value === "gold18" || value === "silver925" || value === "copper";
}

export function parseInstrumentId(
  input: string | null | undefined,
  fallback: InstrumentId = "gold18"
): InstrumentId {
  if (isInstrumentId(input)) return input;
  return fallback;
}

export function instrumentTitle(id: InstrumentId) {
  return INSTRUMENTS[id].title;
}

export function instrumentLabel(id: InstrumentId) {
  return INSTRUMENTS[id].label;
}
