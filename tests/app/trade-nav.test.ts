import { describe, expect, it } from "vitest";
import { desktopNavSections, isTradeNavMenu, mobileBottomNav } from "@/lib/app/navigation";
import {
  activeTradeSlugFromPath,
  instrumentFromTradeQuery,
  isTradeSectionPath,
  parseTradeMetalSlug,
  parseTradeSide,
  tradePath,
  tradePathForInstrument,
  tradeSubmenuCommand,
  TRADE_METALS,
} from "@/lib/market/trade-routes";

function tradeMenus() {
  const desktop = desktopNavSections
    .flatMap((section) => section.items)
    .filter(isTradeNavMenu);
  const mobile = mobileBottomNav.filter(isTradeNavMenu);
  return { desktop, mobile };
}

describe("per-metal trade routes", () => {
  it("maps gold, silver, and copper onto the trade page", () => {
    expect(TRADE_METALS.map((metal) => metal.label)).toEqual(["طلا", "نقره", "مس"]);
    expect(TRADE_METALS.map((metal) => metal.href)).toEqual([
      "/app/trade/gold",
      "/app/trade/silver",
      "/app/trade/copper",
    ]);
    expect(new Set(TRADE_METALS.map((metal) => metal.accent)).size).toBe(3);
  });

  it("accepts slug, instrument id, and Persian aliases", () => {
    expect(parseTradeMetalSlug("gold")).toBe("gold");
    expect(parseTradeMetalSlug("gold18")).toBe("gold");
    expect(parseTradeMetalSlug("SILVER")).toBe("silver");
    expect(parseTradeMetalSlug("silver925")).toBe("silver");
    expect(parseTradeMetalSlug("copper")).toBe("copper");
    expect(parseTradeMetalSlug("طلا")).toBe("gold");
    expect(parseTradeMetalSlug("%D9%86%D9%82%D8%B1%D9%87")).toBe("silver");
    expect(parseTradeMetalSlug("platinum")).toBeNull();
    expect(parseTradeMetalSlug("")).toBeNull();
    expect(parseTradeMetalSlug("%")).toBeNull();
  });

  it("builds canonical paths and reads the active metal from the path", () => {
    expect(tradePath("gold")).toBe("/app/trade/gold");
    expect(tradePath("copper", "sell")).toBe("/app/trade/copper?side=sell");
    expect(tradePathForInstrument("silver925", "sell")).toBe("/app/trade/silver?side=sell");
    expect(parseTradeSide("sell")).toBe("sell");
    expect(parseTradeSide("buy")).toBe("buy");
    expect(parseTradeSide(null)).toBe("buy");
    expect(activeTradeSlugFromPath("/app/trade/gold")).toBe("gold");
    expect(activeTradeSlugFromPath("/app/trade/gold18")).toBe("gold");
    expect(activeTradeSlugFromPath("/app/trade/silver?side=sell")).toBe("silver");
    expect(activeTradeSlugFromPath("/app/buy")).toBeNull();
    expect(isTradeSectionPath("/app/sell")).toBe(true);
    expect(isTradeSectionPath("/app/trade/copper")).toBe(true);
    expect(isTradeSectionPath("/app/wallet")).toBe(false);
  });

  it("resolves ?metal= without inventing a price", () => {
    expect(instrumentFromTradeQuery({ metal: "gold" })).toBe("gold18");
    expect(instrumentFromTradeQuery({ metal: "نقره" })).toBe("silver925");
    expect(instrumentFromTradeQuery({ instrument: "copper" })).toBe("copper");
    expect(instrumentFromTradeQuery({ metal: "nope", instrument: "gold18" })).toBe("gold18");
    expect(instrumentFromTradeQuery({})).toBeNull();
    expect(JSON.stringify(TRADE_METALS)).not.toMatch(/fallback|seed|demo/i);
  });
});

describe("خرید و فروش navigation", () => {
  it("uses the same metal submenu in the desktop sidebar and mobile bottom nav", () => {
    const { desktop, mobile } = tradeMenus();
    expect(desktop).toHaveLength(1);
    expect(mobile).toHaveLength(1);
    expect(desktop[0]?.label).toBe("خرید و فروش");
    expect(mobile[0]?.label).toBe("خرید و فروش");
    expect(desktop[0]?.href).toBeUndefined();
    expect(mobile[0]?.children.map((metal) => [metal.label, metal.href, metal.accent])).toEqual(
      desktop[0]?.children.map((metal) => [metal.label, metal.href, metal.accent])
    );
  });
});

describe("trade submenu keyboard", () => {
  const count = 3;

  it("opens from the trigger with the arrow keys", () => {
    expect(tradeSubmenuCommand({ key: "ArrowDown", open: false, index: null, count })).toEqual({
      type: "open",
      focusIndex: 0,
    });
    expect(tradeSubmenuCommand({ key: "ArrowUp", open: false, index: null, count })).toEqual({
      type: "open",
      focusIndex: 2,
    });
    expect(tradeSubmenuCommand({ key: "Escape", open: false, index: null, count })).toEqual({
      type: "none",
    });
    expect(tradeSubmenuCommand({ key: "Escape", open: true, index: null, count })).toEqual({
      type: "close",
    });
  });

  it("moves inside the list and returns to the trigger", () => {
    expect(tradeSubmenuCommand({ key: "ArrowDown", open: true, index: 0, count })).toEqual({
      type: "focus",
      index: 1,
    });
    expect(tradeSubmenuCommand({ key: "ArrowDown", open: true, index: 2, count })).toEqual({
      type: "none",
    });
    expect(tradeSubmenuCommand({ key: "ArrowUp", open: true, index: 0, count })).toEqual({
      type: "close",
    });
    expect(tradeSubmenuCommand({ key: "Home", open: true, index: 2, count })).toEqual({
      type: "focus",
      index: 0,
    });
    expect(tradeSubmenuCommand({ key: "End", open: true, index: 0, count })).toEqual({
      type: "focus",
      index: 2,
    });
    expect(tradeSubmenuCommand({ key: "Escape", open: true, index: 1, count })).toEqual({
      type: "close",
    });
    expect(
      tradeSubmenuCommand({ key: "ArrowDown", open: true, index: 0, count, altKey: true })
    ).toEqual({ type: "none" });
  });
});
