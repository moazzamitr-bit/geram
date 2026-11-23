import { afterEach, describe, expect, it, vi } from "vitest";
import { FinnotechError, resetFinnotechAuthCache } from "@/lib/finnotech/client";
import { FINNOTECH_SCOPE, finnotechOtpChannel, finnotechConfigured, finnotechOtpDigits } from "@/lib/finnotech/config";
import { maskMobile } from "@/lib/finnotech/redact";
import {
  codeLengthFromMessagingResult,
  initiateMessagingOtp,
  messagingScopeMissing,
  sendFinnotextOtp,
  verifyMessagingOtp,
} from "@/lib/finnotech/otp";

const createServiceClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient,
}));

import { consumeOtpSendRate, otpMode, requestOtp, smsProvider } from "@/lib/auth/otp";

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
    const tokenScopes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const href = String(url);
        const body = init.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url: href, body });
        if (href.includes("/oauth2/token")) {
          tokenScopes.push(String((body as { scopes?: string }).scopes ?? ""));
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
    expect(tokenScopes).toEqual([
      FINNOTECH_SCOPE.loginOtpInitiate.join(","),
      FINNOTECH_SCOPE.loginOtpVerify.join(","),
    ]);
    expect(tokenScopes.join(",")).not.toContain("facility:finnotext-otp:post");
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
    const tokenScopes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (String(url).includes("/oauth2/token")) {
          tokenScopes.push(JSON.parse(String(init.body)).scopes as string);
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
    expect(tokenScopes).toEqual([FINNOTECH_SCOPE.loginOtpFinnotext.join(",")]);
    expect(tokenScopes.join(",")).not.toContain("messaging:");
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


const SCOPE_REJECTED = {
  status: "FAILED",
  error: { code: "VALIDATION_ERROR", message: "client has no access to this scope : messaging:otp-initiate:post" },
};

function tokenOk() {
  return Response.json({
    status: "DONE",
    result: { value: "tok", refreshToken: "ref", lifeTime: 600_000 },
  });
}

function mockOtpDb() {
  const upserts: Record<string, unknown>[] = [];
  createServiceClient.mockReturnValue({
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: null, error: null }) };
            },
          };
        },
        upsert: async (row: Record<string, unknown>) => {
          upserts.push(row);
          return { error: null };
        },
      };
    },
  });
  return { upserts };
}

let phoneSeq = 0;
function uniquePhone() {
  phoneSeq += 1;
  return `0912${String(100000 + phoneSeq).slice(-6)}`;
}

describe("messagingScopeMissing", () => {
  it("treats token_rejected and a 400 scope message as a miss, but not an ordinary 400", () => {
    expect(
      messagingScopeMissing(new FinnotechError("token_rejected", 400, "client has no access to this scope : x", ""))
    ).toBe(true);
    expect(messagingScopeMissing(new FinnotechError("no_scope", 0))).toBe(true);
    expect(
      messagingScopeMissing(
        new FinnotechError("VALIDATION_ERROR", 400, "client has no access to this scope : messaging:otp-initiate:post", "")
      )
    ).toBe(true);
    expect(messagingScopeMissing(new FinnotechError("http_403", 403))).toBe(true);
    expect(messagingScopeMissing(new FinnotechError("VALIDATION_ERROR", 400, "invalid identifier", "{}"))).toBe(false);
    expect(messagingScopeMissing(new FinnotechError("network", 0))).toBe(false);
    expect(messagingScopeMissing(new Error("token_rejected"))).toBe(false);
  });
});

describe("login OTP token_rejected fallback", () => {
  afterEach(() => {
    resetFinnotechAuthCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    createServiceClient.mockReset();
  });

  it("fails with a masked log and no fallback when messaging token is rejected and nothing else is configured", async () => {
    configure();
    vi.stubEnv("FINNOTECH_SMS_SENDER", "");
    vi.stubEnv("SMSIR_API_KEY", "");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "");
    vi.stubEnv("KAVENEGAR_API_KEY", "");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "");
    mockOtpDb();
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });
    const urls: string[] = [];
    const tokenScopes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        urls.push(String(url));
        if (String(url).includes("/oauth2/token")) {
          tokenScopes.push(JSON.parse(String(init.body)).scopes as string);
          return Response.json(SCOPE_REJECTED, { status: 400 });
        }
        return Response.json({ status: "FAILED" }, { status: 500 });
      })
    );
    const phone = uniquePhone();
    const result = await requestOtp(phone, "203.0.113.50");
    expect(result).toEqual({ ok: false, error: "send_failed" });
    expect(tokenScopes).toEqual(["messaging:otp-initiate:post"]);
    expect(urls.every((href) => href.includes("/oauth2/token"))).toBe(true);
    expect(urls.some((href) => href.includes("/otp/initiate") || href.includes("finnotextOtp"))).toBe(false);
    const failed = errors.find((args) => args[0] === "otp_send_failed");
    expect(failed?.[1]).toBe("messaging_scope_missing");
    expect(failed?.[2]).toBe(maskMobile(phone));
    expect(failed?.[3]).toBe("no_fallback_provider");
    expect(JSON.stringify(errors)).not.toContain(phone);
    expect(JSON.stringify(errors)).not.toContain(SECRET);
  });

  it("falls back to finnotext when messaging token is rejected and a sender line is set", async () => {
    configure();
    vi.stubEnv("SMSIR_API_KEY", "sms-key");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "123456");
    const { upserts } = mockOtpDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tokenScopes: string[] = [];
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const href = String(url);
        paths.push(href);
        if (href.includes("/oauth2/token")) {
          const scopes = JSON.parse(String(init.body)).scopes as string;
          tokenScopes.push(scopes);
          if (scopes.includes("messaging:otp-initiate:post")) {
            return Response.json(SCOPE_REJECTED, { status: 400 });
          }
          return tokenOk();
        }
        if (href.includes("finnotextOtp")) {
          return Response.json({ status: "DONE", result: { numberOfRecords: 1 } });
        }
        if (href.includes("sms.ir")) {
          throw new Error("smsir should not be called when finnotext succeeds");
        }
        return Response.json({ status: "FAILED" }, { status: 500 });
      })
    );
    const phone = uniquePhone();
    const result = await requestOtp(phone, "203.0.113.51");
    expect(result).toMatchObject({ ok: true, mode: "sms" });
    expect(tokenScopes).toEqual(["messaging:otp-initiate:post", "facility:finnotext-otp:post"]);
    expect(paths.some((href) => href.includes("finnotextOtp"))).toBe(true);
    expect(paths.some((href) => href.includes("sms.ir"))).toBe(false);
    expect(upserts.some((row) => row.provider === "finnotech_finnotext")).toBe(true);
  });

  it("falls back to sms.ir when messaging token is rejected and no finnotext sender is set", async () => {
    configure();
    vi.stubEnv("FINNOTECH_SMS_SENDER", "");
    vi.stubEnv("SMSIR_API_KEY", "sms-key");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "123456");
    vi.stubEnv("KAVENEGAR_API_KEY", "kv");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "tpl");
    const { upserts } = mockOtpDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const href = String(url);
        paths.push(href);
        if (href.includes("/oauth2/token")) {
          return Response.json(SCOPE_REJECTED, { status: 400 });
        }
        if (href.includes("api.sms.ir")) {
          return new Response(JSON.stringify({ status: 1, message: "ok" }), { status: 200 });
        }
        if (href.includes("kavenegar.com")) {
          throw new Error("kavenegar should not be called when sms.ir is configured");
        }
        return Response.json({ status: "FAILED" }, { status: 500 });
      })
    );
    const phone = uniquePhone();
    const result = await requestOtp(phone, "203.0.113.52");
    expect(result).toMatchObject({ ok: true, mode: "sms" });
    expect(paths.some((href) => href.includes("api.sms.ir"))).toBe(true);
    expect(paths.some((href) => href.includes("kavenegar.com") || href.includes("finnotextOtp"))).toBe(false);
    expect(upserts.some((row) => row.provider === "local")).toBe(true);
  });

  it("falls back to Kavenegar when messaging token is rejected and only Kavenegar is configured", async () => {
    configure();
    vi.stubEnv("FINNOTECH_SMS_SENDER", "");
    vi.stubEnv("SMSIR_API_KEY", "");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "");
    vi.stubEnv("KAVENEGAR_API_KEY", "kv-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "login-otp");
    mockOtpDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        paths.push(href);
        if (href.includes("/oauth2/token")) {
          return Response.json(SCOPE_REJECTED, { status: 400 });
        }
        if (href.includes("kavenegar.com")) {
          return new Response("{}", { status: 200 });
        }
        return Response.json({ status: "FAILED" }, { status: 500 });
      })
    );
    const result = await requestOtp(uniquePhone(), "203.0.113.53");
    expect(result).toMatchObject({ ok: true, mode: "sms" });
    expect(paths.some((href) => href.includes("kavenegar.com") && href.includes("/verify/lookup.json"))).toBe(true);
    expect(paths.some((href) => href.includes("sms.ir") || href.includes("finnotextOtp"))).toBe(false);
  });

  it("does not fall back on a non-scope messaging failure", async () => {
    configure();
    vi.stubEnv("SMSIR_API_KEY", "sms-key");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "123456");
    mockOtpDb();
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        paths.push(href);
        if (href.includes("/oauth2/token")) return tokenOk();
        if (href.includes("/otp/initiate")) {
          return Response.json(
            { status: "FAILED", error: { code: "VALIDATION_ERROR", message: "invalid identifier" } },
            { status: 400 }
          );
        }
        return Response.json({ status: "FAILED" }, { status: 500 });
      })
    );
    const phone = uniquePhone();
    const result = await requestOtp(phone, "203.0.113.54");
    expect(result).toEqual({ ok: false, error: "send_failed" });
    expect(paths.some((href) => href.includes("sms.ir") || href.includes("finnotextOtp"))).toBe(false);
    const failed = errors.find((args) => args[0] === "otp_send_failed");
    expect(failed?.[1]).toBe("messaging_failed");
    expect(failed?.[2]).toBe(maskMobile(phone));
  });
});
