import { describe, expect, it } from "vitest";
import {
  compare, effectivePerGram, median, average, parseDaric, parseGerami, parseMelligold, parseMilli, parseTaline,
  parseWallgold, readCompetitor, refreshCompetitors, getCompetitorReadings, statusOf, validate, COMPETITORS,
} from "@/lib/market/competitors";

describe("competitor parsers (unit normalization → toman/gram)", () => {
  it("milli: rial per mg ×100", () => {
    expect(parseMilli({ code: 0, data: { price18: 259480 } })).toEqual({ buy: 25_948_000, sell: 25_948_000 });
  });
  it("wallgold toman/g by side", () => {
    const b = { result: [
      { symbol: "GLD_18C_750TMN", side: "buy", price: "26099000" },
      { symbol: "GLD_18C_750TMN", side: "sell", price: "26050000" },
      { symbol: "SLV_925TMN", side: "buy", price: "455000" },
    ] };
    expect(parseWallgold(b)).toEqual({ buy: 26_099_000, sell: 26_050_000 });
  });
  it("melligold", () => {
    expect(parseMelligold({ data: { price_buy: 26162936, price_sell: 26100000 } })).toEqual({ buy: 26162936, sell: 26100000 });
  });
  it("daric: user buys at BestSellPrice", () => {
    expect(parseDaric({ Data: { BestBuyPrice: "26089106", BestSellPrice: "26212905" } })).toEqual({ buy: 26212905, sell: 26089106 });
  });
  it("taline html", () => {
    expect(parseTaline("x goldPrices = {\n   buy: 26260000,\n  sell: 26050700 }")).toEqual({ buy: 26260000, sell: 26050700 });
    expect(() => parseTaline("goldPrices = { buy: 0, sell: 0 }")).toThrow();
  });
  it("gerami escaped embedded market json", () => {
    const html = String.raw`..{\"market\":\"XAU750g_IRT\",\"price\":\"26161241\",\"buy_price\":\"26161241\",\"buy_fee_rate\":\"0.005\",\"sell_price\":\"26071421\"}..{\"market\":\"XAG_IRT\",\"buy_price\":\"464779\"}`;
    expect(parseGerami(html)).toEqual({ buy: 26161241, sell: 26071421 });
    expect(() => parseGerami("nothing")).toThrow();
  });
  it("missing fields throw", () => {
    expect(() => parseMilli({ code: 1 })).toThrow();
    expect(() => parseWallgold({ result: [] })).toThrow();
    expect(() => parseDaric({})).toThrow();
  });
});

describe("sanity bands catch rial/toman 10x slips", () => {
  it("accepts a normal quote", () => expect(validate({ buy: 26_200_000, sell: 26_000_000 })).toBeTruthy());
  it("rejects rial (10x too high)", () => expect(() => validate({ buy: 262_000_000, sell: 260_000_000 })).toThrow(/بازه/));
  it("rejects 10x too low", () => expect(() => validate({ buy: 2_620_000, sell: 2_600_000 })).toThrow(/بازه/));
  it("rejects milli read as toman/g without ×100", () => expect(() => validate({ buy: 259_480, sell: 259_480 })).toThrow());
  it("rejects sell > buy and absurd spread", () => {
    expect(() => validate({ buy: 26_000_000, sell: 26_500_000 })).toThrow();
    expect(() => validate({ buy: 30_000_000, sell: 20_000_000 })).toThrow();
  });
});

describe("comparison math", () => {
  it("buy: we cheaper = good", () => {
    const c = compare("buy", 25_900_000, 26_000_000);
    expect(c.good).toBe(true);
    expect(c.diff).toBe(-100_000);
    expect(c.pct).toBeCloseTo(-0.3846, 3);
  });
  it("sell: we pay more = good", () => {
    expect(compare("sell", 26_100_000, 26_000_000).good).toBe(true);
    expect(compare("sell", 25_900_000, 26_000_000).good).toBe(false);
  });
  it("effective price with fee", () => {
    expect(effectivePerGram(26_000_000, "buy", 0, 0)).toBe(26_000_000);
    expect(effectivePerGram(26_000_000, "buy", 0, 50)).toBe(Math.round(26_000_000 / 0.995));
    expect(effectivePerGram(26_000_000, "sell", 0, 50)).toBe(25_870_000);
  });
  it("median/average", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(average([1, 2])).toBe(2);
    expect(median([])).toBeNull();
  });
});

describe("fetch isolation", () => {
  it("one failing competitor does not break the others; timeouts reported", async () => {
    const fakeFetch = (async (url: string) => {
      if (url.includes("wallgold")) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      if (url.includes("melligold")) return new Response("", { status: 307, headers: { "set-cookie": "__arcsco=x; Path=/" } });
      if (url.includes("milli")) return Response.json({ code: 0, data: { price18: 260000 } });
      return new Response("err", { status: 503 });
    }) as unknown as typeof fetch;
    const sunk: unknown[] = [];
    await refreshCompetitors({ force: true, fetchImpl: fakeFetch, sink: async (r) => void sunk.push(...r) });
    const rs = getCompetitorReadings();
    const milli = rs.find((r) => r.id === "milli")!;
    expect(milli.buy).toBe(26_000_000);
    expect(statusOf(milli)).toBe("ok");
    expect(rs.find((r) => r.id === "wallgold")!.error).toMatch(/timeout/);
    expect(rs.find((r) => r.id === "melligold")!.error).toMatch(/ریدایرکت/);
    expect(statusOf(rs.find((r) => r.id === "daric")!)).toBe("error");
    expect(sunk).toHaveLength(1);
  });
  it("melligold cookie hop then success", async () => {
    let n = 0;
    const f = (async (_u: string, init: RequestInit) => {
      n++;
      if (!(init.headers as Record<string, string>).Cookie) return new Response("", { status: 307, headers: { "set-cookie": "__arcsco=abc; Path=/" } });
      return Response.json({ data: { price_buy: 26_100_000, price_sell: 26_000_000 } });
    }) as unknown as typeof fetch;
    const def = COMPETITORS.find((d) => d.id === "melligold")!;
    expect(await readCompetitor(def, f)).toEqual({ buy: 26_100_000, sell: 26_000_000 });
    expect(n).toBe(2);
  });
});
