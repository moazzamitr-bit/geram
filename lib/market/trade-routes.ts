import {
  isInstrumentId,
  type InstrumentId,
} from "@/lib/market/instruments";

export const TRADE_METAL_SLUGS = ["gold", "silver", "copper"] as const;

export type TradeMetalSlug = (typeof TRADE_METAL_SLUGS)[number];

export type TradeSide = "buy" | "sell";

export type TradeMetal = {
  slug: TradeMetalSlug;
  instrument: InstrumentId;
  label: string;
  title: string;
  href: string;
  accent: string;
};

/** Canonical user-panel routes. Accents match the cream-theme price ticker. */
export const TRADE_METALS: readonly TradeMetal[] = [
  {
    slug: "gold",
    instrument: "gold18",
    label: "طلا",
    title: "طلای ۱۸ عیار",
    href: "/app/trade/gold",
    accent: "#FFB800",
  },
  {
    slug: "silver",
    instrument: "silver925",
    label: "نقره",
    title: "نقره ۹۹۹",
    href: "/app/trade/silver",
    accent: "#B7BDC7",
  },
  {
    slug: "copper",
    instrument: "copper",
    label: "مس",
    title: "مس",
    href: "/app/trade/copper",
    accent: "#C4784A",
  },
];

const ALIAS: Record<string, TradeMetalSlug> = {
  gold: "gold",
  gold18: "gold",
  طلا: "gold",
  silver: "silver",
  silver925: "silver",
  نقره: "silver",
  copper: "copper",
  مس: "copper",
};

export function parseTradeMetalSlug(
  input: string | null | undefined
): TradeMetalSlug | null {
  if (input == null) return null;
  let raw = input.trim();
  if (!raw) return null;
  try {
    raw = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  if (!raw) return null;
  return ALIAS[raw] ?? ALIAS[raw.toLowerCase()] ?? null;
}

export function parseTradeSide(input: string | null | undefined): TradeSide {
  return input === "sell" ? "sell" : "buy";
}

export function tradeMetalBySlug(slug: TradeMetalSlug): TradeMetal {
  const metal = TRADE_METALS.find((item) => item.slug === slug);
  if (!metal) throw new Error(`unknown trade metal: ${slug}`);
  return metal;
}

export function tradeSlugForInstrument(id: InstrumentId): TradeMetalSlug {
  if (id === "silver925") return "silver";
  if (id === "copper") return "copper";
  return "gold";
}

export function tradePath(slug: TradeMetalSlug, side: TradeSide = "buy") {
  const base = `/app/trade/${slug}`;
  return side === "sell" ? `${base}?side=sell` : base;
}

export function tradePathForInstrument(id: InstrumentId, side: TradeSide = "buy") {
  return tradePath(tradeSlugForInstrument(id), side);
}

export function instrumentFromTradeQuery(input: {
  metal?: string | null;
  instrument?: string | null;
}): InstrumentId | null {
  const slug = parseTradeMetalSlug(input.metal);
  if (slug) return tradeMetalBySlug(slug).instrument;
  if (isInstrumentId(input.instrument)) return input.instrument;
  return null;
}

export function activeTradeSlugFromPath(pathname: string): TradeMetalSlug | null {
  const path = pathname.split(/[?#]/)[0] ?? pathname;
  const match = path.match(/^\/app\/trade\/([^/]+)/);
  if (!match) return null;
  return parseTradeMetalSlug(match[1]);
}

export function isTradeSectionPath(pathname: string) {
  return (
    pathname === "/app/buy" ||
    pathname.startsWith("/app/buy/") ||
    pathname === "/app/sell" ||
    pathname.startsWith("/app/sell/") ||
    pathname === "/app/trade" ||
    pathname.startsWith("/app/trade/")
  );
}

export type TradeSubmenuCommand =
  | { type: "none" }
  | { type: "toggle" }
  | { type: "open"; focusIndex: number }
  | { type: "close" }
  | { type: "focus"; index: number };

/** Keyboard map for the خرید و فروش disclosure. `index` is null on the trigger. */
export function tradeSubmenuCommand(input: {
  key: string;
  open: boolean;
  index: number | null;
  count: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): TradeSubmenuCommand {
  if (input.altKey || input.ctrlKey || input.metaKey) return { type: "none" };
  if (input.count <= 0) return { type: "none" };
  const { key, open, index, count } = input;

  if (index == null) {
    if (key === "ArrowDown") return { type: "open", focusIndex: 0 };
    if (key === "ArrowUp") return { type: "open", focusIndex: count - 1 };
    if (key === "Escape" && open) return { type: "close" };
    if (key === "Home" && open) return { type: "open", focusIndex: 0 };
    if (key === "End" && open) return { type: "open", focusIndex: count - 1 };
    return { type: "none" };
  }

  if (key === "Escape") return { type: "close" };
  if (key === "Home") return { type: "focus", index: 0 };
  if (key === "End") return { type: "focus", index: count - 1 };
  if (key === "ArrowDown") {
    if (index >= count - 1) return { type: "none" };
    return { type: "focus", index: index + 1 };
  }
  if (key === "ArrowUp") {
    if (index <= 0) return { type: "close" };
    return { type: "focus", index: index - 1 };
  }
  return { type: "none" };
}
