import { afterEach, describe, expect, it, vi } from "vitest";
import { tgjuExecutableFeed } from "@/lib/core/price";
import {
  COPPER_STALE_AFTER_MS,
  isTimestampStale,
  SPOT_STALE_AFTER_MS,
} from "@/lib/market/freshness";

const NOW = Date.parse("2026-10-25T09:00:00+03:30");

describe("TGJU daily bar freshness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a midnight bar from the previous Tehran date inside the sanity window", () => {
    expect(isTimestampStale("2026-10-24 00:00:00", SPOT_STALE_AFTER_MS, NOW)).toBe(false);
    const stored = new Date(Date.parse("2026-10-24T00:00:00+03:30")).toISOString();
    expect(isTimestampStale(stored, SPOT_STALE_AFTER_MS, NOW)).toBe(false);
  });

  it("still rejects a clocked print older than two hours and a months-old daily bar", () => {
    expect(isTimestampStale("2026-10-25 06:00:00", SPOT_STALE_AFTER_MS, NOW)).toBe(true);
    expect(isTimestampStale("2026-10-25 08:00:00", SPOT_STALE_AFTER_MS, NOW)).toBe(false);
    expect(isTimestampStale("2026-07-20 00:00:00", SPOT_STALE_AFTER_MS, NOW)).toBe(true);
  });

  it("treats an old fetch as stale even when the daily bar date is recent", () => {
    const fetchedAt = NOW - 3 * 60 * 60 * 1000;
    expect(isTimestampStale("2026-10-24 00:00:00", SPOT_STALE_AFTER_MS, NOW, fetchedAt)).toBe(true);
  });

  it("keeps the longer copper window for a midnight stamp", () => {
    const later = Date.parse("2026-10-25T16:00:00+03:30");
    expect(isTimestampStale("2026-10-24 00:00:00", SPOT_STALE_AFTER_MS, later)).toBe(false);
    expect(isTimestampStale("2026-10-24 00:00:00", COPPER_STALE_AFTER_MS, later)).toBe(true);
  });

  it("lets the executable gold feed accept geram18's midnight date", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const feed = tgjuExecutableFeed(async () => ({
      geram18: { p: "260,633,000", h: "272,235,000", l: "260,047,000", ts: "2026-10-24 00:00:00" },
    }));
    const quote = await feed.getExecutable("GOLD");
    expect(quote.stale).toBe(false);
    expect(quote.health).toBe("LIVE");
    expect(quote.source).toBe("geram18");
    expect(quote.irrPerGram).toBe(260_633_000n);
  });
});
