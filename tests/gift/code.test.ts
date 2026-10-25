import { describe, expect, it } from "vitest";
import { newGiftCode, normalizeGiftCode } from "@/lib/gift/service";

describe("gift codes", () => {
  it("generates unambiguous GRM-XXXX-XXXX codes", () => {
    for (let i = 0; i < 200; i++) expect(newGiftCode()).toMatch(/^GRM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  });
  it("normalizes typed input", () => {
    expect(normalizeGiftCode(" grm abcd 2345 ")).toBe("GRM-ABCD-2345");
    expect(normalizeGiftCode("ABCD2345")).toBe("GRM-ABCD-2345");
    expect(normalizeGiftCode("GRM-ABC")).toBeNull();
  });
});
