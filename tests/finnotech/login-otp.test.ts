import { afterEach, describe, expect, it, vi } from "vitest";
import { finnotechOtpChannel, finnotechConfigured, finnotechOtpDigits } from "@/lib/finnotech/config";
import { resetFinnotechAuthCache } from "@/lib/finnotech/client";
import { codeLengthFromMessagingResult, initiateMessagingOtp, sendFinnotextOtp, verifyMessagingOtp } from "@/lib/finnotech/otp";
import { consumeOtpSendRate, otpMode, smsProvider } from "@/lib/auth/otp";

const SECRET = "otp-secret";

function configure() {
  vi.stubEnv("FINNOTECH_BASE_URL", "https://api.finnotech.ir");
  vi.stubEnv("FINNOTECH_CLIENT_ID", "geram");
  vi.stubEnv("FINNOTECH_CLIENT_SECRET", SECRET);
  vi.stubEnv("FINNOTECH_NID", "0013542419");
  vi.stubEnv("FINNOTECH_SMS_SENDER", "30001234");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
}

describe("finnotech login otp", () => {
  afterEach(() => {
    resetFinnotechAuthCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefers Finnotech over sms.ir when credentials exist", () => {
    configure();
    vi.stubEnv("SMSIR_API_KEY", "k");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "123456");
    expect(finnotechConfigured()).toBe(true);
    expect(smsProvider()).toBe("finnotech");
    expect(otpMode()).toBe("sms");
    expect(finnotechOtpChannel()).toBe("messaging");
    vi.stubEnv("FINNOTECH_OTP_CHANNEL", "finnotext");
    expect(finnotechOtpChannel()).toBe("finnotext");
  });

  it("initiates and verifies messaging OTP without putting the code in the initiate body", async () => {
    configure();
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const href = String(url);
        const body = init.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url: href, body });
        if (href.includes("/oauth2/token")) {
          return Response.json({
            status: "DONE",
            result: { value: "tok", refreshToken: "ref", lifeTime: 600_000 },
          });
        }
        if (href.includes("/otp/initiate")) {
          return Response.json({
            status: "DONE",
            trackId: "track-otp",
            result: { traceId: "trace-1", status: "pending", expiresIn: 90 },
          });
        }
        if (href.includes("/otp/verify")) {
          return Response.json({
            status: "DONE",
            result: { status: "verified", verifiedAt: "1404/01/01" },
          });
        }
        return Response.json({ status: "FAILED" }, { status: 500 });
      })
    );

    const initiated = await initiateMessagingOtp("09120000000");
    expect(initiated.traceId).toBe("trace-1");
    expect(initiated.expiresIn).toBe(90);
    expect(initiated.codeLength).toBe(5);
    const initiate = calls.find((call) => call.url.includes("/otp/initiate"));
    expect(initiate?.url).toContain("/messaging/v2/clients/geram/otp/initiate");
    expect(initiate?.url).toContain("trackId=");
    expect(initiate?.body).toEqual({
      identifier: "09120000000",
      method: "sms",
      purpose: "login",
      ttl: 120,
    });
    expect(initiate?.body).not.toHaveProperty("otp");

    expect(await verifyMessagingOtp("trace-1", "554321")).toBe(true);
    const verify = calls.find((call) => call.url.includes("/otp/verify"));
    expect(verify?.body).toEqual({ traceId: "trace-1", otp: "554321" });
    expect(calls.some((call) => JSON.stringify(call.body).includes(SECRET))).toBe(false);
  });

  it("uses 5 digits unless the initiate result or env says otherwise", () => {
    expect(finnotechOtpDigits()).toBe(5);
    expect(codeLengthFromMessagingResult({ traceId: "t", status: "pending", expiresIn: 120 })).toBe(5);
    expect(codeLengthFromMessagingResult({ otpLength: 5 })).toBe(5);
    expect(codeLengthFromMessagingResult({ codeLength: 7 })).toBe(7);
    vi.stubEnv("FINNOTECH_OTP_LENGTH", "6");
    expect(finnotechOtpDigits()).toBe(6);
    expect(codeLengthFromMessagingResult({ status: "pending" })).toBe(6);
    vi.stubEnv("FINNOTECH_OTP_LENGTH", "nope");
    expect(finnotechOtpDigits()).toBe(5);
  });

  it("sends finnotext from FINNOTECH_SMS_SENDER", async () => {
    configure();
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (String(url).includes("/oauth2/token")) {
          return Response.json({
            status: "DONE",
            result: { value: "tok", refreshToken: "ref", lifeTime: 600_000 },
          });
        }
        bodies.push(init.body ? JSON.parse(String(init.body)) : null);
        return Response.json({ status: "DONE", result: { numberOfRecords: 1, numberOfParts: 1 } });
      })
    );
    await sendFinnotextOtp("09120000000", "482913");
    expect(bodies[0]).toMatchObject({ from: "30001234", to: "09120000000" });
    expect(String((bodies[0] as { message: string }).message)).toContain("482913");
  });

  it("rate-limits OTP sends per phone and per IP", () => {
    const phone = `0912${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")}`;
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
    const now = 5_000_000;
    for (let i = 0; i < 5; i++) expect(consumeOtpSendRate(phone, ip, now).ok).toBe(true);
    expect(consumeOtpSendRate(phone, ip, now).ok).toBe(false);
    expect(consumeOtpSendRate("09121112222", ip, now).ok).toBe(true);
    const crowded = "203.0.113.10";
    for (let i = 0; i < 8; i++) {
      expect(consumeOtpSendRate(`0912000000${i}`, crowded, now).ok).toBe(true);
    }
    expect(consumeOtpSendRate("09129998877", crowded, now).ok).toBe(false);
  });
});
