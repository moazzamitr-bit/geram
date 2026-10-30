import { describe, expect, it } from "vitest";
import { isUuid, maskIp, parseUserAgent, relativeFa, sessionIdFromJwt } from "@/lib/auth/sessions";

describe("sessions helpers", () => {
  it("parses UA", () => {
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1").label).toBe("آیفون · Safari");
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148").label).toBe("آیفون · اپ نصب‌شده");
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36").label).toBe("ویندوز · Chrome");
    expect(parseUserAgent(null).label).toBe("دستگاه ناشناس");
  });
  it("masks ip", () => {
    expect(maskIp("5.123.44.9")).toBe("5.123.*.*");
    expect(maskIp("2a01:5ec0:1:2::1")).toBe("2a01:5ec0:…");
    expect(maskIp(null)).toBe("—");
  });
  it("reads session_id from jwt", () => {
    const p = Buffer.from(JSON.stringify({ session_id: "abc" })).toString("base64url");
    expect(sessionIdFromJwt(`x.${p}.y`)).toBe("abc");
    expect(sessionIdFromJwt("garbage")).toBeNull();
  });
  it("validates uuid & relative time", () => {
    expect(isUuid("11111111-2222-3333-4444-555555555555")).toBe(true);
    expect(isUuid("1; drop")).toBe(false);
    expect(relativeFa(new Date(Date.now() - 5 * 60_000).toISOString())).toContain("دقیقه پیش");
  });
});
