import { afterEach, describe, expect, it, vi } from "vitest";
import { otpMode, verifyOtp } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/rate-limit";

describe("otp mode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the fixed demo code only in SANDBOX without a provider", async () => {
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    vi.stubEnv("KAVENEGAR_API_KEY", "");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "");
    expect(otpMode()).toBe("sandbox");
    expect(await verifyOtp("09120000000", "123456")).toEqual({ ok: true });
    expect(await verifyOtp("09120000000", "000000")).toMatchObject({ ok: false });
  });

  it("refuses login outside SANDBOX when no SMS provider is configured", async () => {
    vi.stubEnv("GERAM_EXECUTION_MODE", "CLOSED_BETA");
    vi.stubEnv("KAVENEGAR_API_KEY", "");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "");
    expect(otpMode()).toBe("unavailable");
    expect(await verifyOtp("09120000000", "123456")).toEqual({
      ok: false,
      error: "unavailable",
    });
  });

  it("needs the service role to store codes when a provider is configured", () => {
    vi.stubEnv("GERAM_EXECUTION_MODE", "PRODUCTION");
    vi.stubEnv("KAVENEGAR_API_KEY", "k");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "t");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(otpMode()).toBe("unavailable");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    expect(otpMode()).toBe("sms");
  });
});

describe("rate limit", () => {
  it("blocks after the limit within a window and resets after it", () => {
    const key = `test:${Math.random()}`;
    const t0 = 1_000_000;
    expect(rateLimit(key, 2, 1000, t0).ok).toBe(true);
    expect(rateLimit(key, 2, 1000, t0 + 1).ok).toBe(true);
    const blocked = rateLimit(key, 2, 1000, t0 + 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit(key, 2, 1000, t0 + 1001).ok).toBe(true);
  });
});
