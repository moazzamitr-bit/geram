import { describe, expect, it } from "vitest";
import { copperIrrPerGram, pickCopperObservation } from "@/lib/core/copper-price";
import { isTimestampStale, SPOT_STALE_AFTER_MS } from "@/lib/market/freshness";

const NOW = Date.parse("2026-10-24T12:00:00+03:30");

describe("copper source freshness", () => {
  it("prefers the live USD/lb print over the frozen July tonne series", () => {
    const picked = pickCopperObservation(
      {
        copper: { p: "13632.97", ts: "2026-07-20 00:00:00" },
        copperp: { p: "6.476", ts: "2026-10-24 10:02:00" },
        "basemetal-london-copper": { p: "14279.3", ts: "2026-10-23 18:00:00" },
      },
      NOW
    );
    expect(picked?.sourceKey).toBe("copperp");
    expect(picked?.unit).toBe("lb");
    expect(picked?.stale).toBe(false);
    expect(picked?.priceMilli).toBe(6476n);
  });

  it("marks the July copper series stale when it is the only print", () => {
    const picked = pickCopperObservation(
      { copper: { p: "13632", ts: "2026-07-20 00:00:00" } },
      NOW
    );
    expect(picked?.sourceKey).toBe("copper");
    expect(picked?.stale).toBe(true);
    expect(isTimestampStale("2026-07-20 00:00:00", SPOT_STALE_AFTER_MS, NOW)).toBe(true);
  });

  it("keeps the integer tonne conversion and accepts thousandths of a USD per pound", () => {
    expect(copperIrrPerGram({ usdPerMetricTonne: 10_000n, usdIrr: 1_000_000n })).toBe(10_000n);
    expect(copperIrrPerGram({ usdPerLbMilli: 6_476n, usdIrr: 1_000_000n })).toBe(14_277n);
  });
});
