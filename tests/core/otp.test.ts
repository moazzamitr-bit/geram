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

describe("sms.ir provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is preferred when configured and turns on real SMS mode", async () => {
    const { smsProvider } = await import("@/lib/auth/otp");
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    vi.stubEnv("SMSIR_API_KEY", "k");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "123456");
    vi.stubEnv("KAVENEGAR_API_KEY", "kv");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "t");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    expect(smsProvider()).toBe("smsir");
    expect(otpMode()).toBe("sms");
  });

  it("posts the documented verify payload and rejects non-success status", async () => {
    const { sendSmsIr } = await import("@/lib/auth/otp");
    vi.stubEnv("SMSIR_API_KEY", "test-key");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "123456");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ status: 1, message: "موفق" }), { status: 200 });
      })
    );
    await sendSmsIr("09120000000", "482913");
    expect(calls[0].url).toBe("https://api.sms.ir/v1/send/verify");
    expect((calls[0].init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      mobile: "09120000000",
      templateId: 123456,
      parameters: [{ name: "Code", value: "482913" }],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: 0, message: "خطا" }), { status: 200 }))
    );
    await expect(sendSmsIr("09120000000", "1")).rejects.toThrow(/smsir_200_0/);
  });
});

describe("auth method", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to password and switches to otp only when asked", async () => {
    const { authMethod, isValidPhone, normalizePhone } = await import("@/lib/auth/method");
    vi.stubEnv("AUTH_METHOD", "");
    expect(authMethod()).toBe("password");
    vi.stubEnv("AUTH_METHOD", "otp");
    expect(authMethod()).toBe("otp");
    expect(normalizePhone("+98 912 000 0001")).toBe("09120000001");
    expect(isValidPhone("09120000001")).toBe(true);
    expect(isValidPhone("0912000")).toBe(false);
  });
});
