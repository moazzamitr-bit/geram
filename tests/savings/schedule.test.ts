import { describe, expect, it } from "vitest";
import { addCadence, firstRunAt, nextRunAfter } from "@/lib/savings/schedule";

describe("savings schedule (Tehran 10:00)", () => {
  it("first run is today 10:00 Tehran when still ahead, else tomorrow", () => {
    expect(firstRunAt(new Date("2026-10-25T05:00:00Z")).toISOString()).toBe("2026-10-25T06:30:00.000Z");
    expect(firstRunAt(new Date("2026-10-25T07:00:00Z")).toISOString()).toBe("2026-10-26T06:30:00.000Z");
  });
  it("steps daily, weekly and monthly with month-end clamping", () => {
    const d = new Date("2026-01-31T06:30:00Z");
    expect(addCadence(d, "DAILY").toISOString()).toBe("2026-02-01T06:30:00.000Z");
    expect(addCadence(d, "WEEKLY").toISOString()).toBe("2026-02-07T06:30:00.000Z");
    expect(addCadence(d, "MONTHLY").toISOString()).toBe("2026-02-28T06:30:00.000Z");
    expect(addCadence(new Date("2026-02-28T06:30:00Z"), "MONTHLY", 31).toISOString()).toBe("2026-03-31T06:30:00.000Z");
  });
  it("skips missed slots instead of replaying them", () => {
    const next = nextRunAfter(new Date("2026-10-01T06:30:00Z"), "DAILY", new Date("2026-10-25T08:00:00Z"));
    expect(next.toISOString()).toBe("2026-10-26T06:30:00.000Z");
  });
});
