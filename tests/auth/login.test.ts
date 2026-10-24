import { afterEach, describe, expect, it, vi } from "vitest";
import { validateAdminLogin, validatePasswordLogin, validateRegister } from "@/lib/auth/credentials";
import { wantsHtml } from "@/lib/auth/http";
import { authMethod } from "@/lib/auth/method";
import { isIranMobile, normalizeIranMobile, phoneEmail, phoneE164 } from "@/lib/auth/phone";
import { withTimeout } from "@/lib/auth/timeout";
import { POST as phoneLogin } from "@/app/api/auth/phone-login/route";
import { POST as passwordLogin } from "@/app/api/auth/password-login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as adminLogin } from "@/app/api/auth/admin-login/route";
import { GET as authConfig } from "@/app/api/auth/config/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

function jsonRequest(path: string, body: unknown, ip = "203.0.113.10") {
  return new Request(`https://geram.co${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: "https://geram.co",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("phone normalization", () => {
  it("accepts local, country, and spaced mobiles", () => {
    expect(normalizeIranMobile("09121234567")).toBe("09121234567");
    expect(normalizeIranMobile("+98 912 123 4567")).toBe("09121234567");
    expect(normalizeIranMobile("9121234567")).toBe("09121234567");
    expect(isIranMobile(normalizeIranMobile("09121234567"))).toBe(true);
    expect(isIranMobile("0912")).toBe(false);
  });

  it("keeps the synthetic email stable", () => {
    expect(phoneEmail("09121234567")).toBe("p09121234567@geram.vercel.app");
    expect(phoneE164("09121234567")).toBe("+989121234567");
  });
});

describe("credential validation", () => {
  it("rejects a bad phone as invalid_credentials before talking to Supabase", () => {
    expect(validatePasswordLogin("123", "whatever-password")).toBe("invalid_credentials");
    expect(validatePasswordLogin("09121234567", "")).toBe("invalid_credentials");
    expect(validatePasswordLogin("09121234567", "secret-pass")).toBeNull();
  });

  it("checks register fields the way the live API does", () => {
    expect(validateRegister({ phone: "0912", password: "12345678", firstName: "آ", lastName: "ب" })).toBe(
      "invalid_phone"
    );
    expect(
      validateRegister({ phone: "09120000000", password: "short", firstName: "آ", lastName: "ب" })
    ).toBe("invalid_input");
    expect(
      validateRegister({ phone: "09120000000", password: "12345678", firstName: "", lastName: "ب" })
    ).toBe("invalid_input");
    expect(
      validateRegister({
        phone: "09120000000",
        password: "12345678",
        passwordConfirm: "12345679",
        firstName: "آ",
        lastName: "ب",
      })
    ).toBe("invalid_input");
    expect(
      validateRegister({ phone: "09120000000", password: "12345678", firstName: "آ", lastName: "ب" })
    ).toBeNull();
  });

  it("does not treat a blank admin email as a login attempt", () => {
    expect(validateAdminLogin("", "secret")).toBe("invalid_input");
    expect(validateAdminLogin("admin@geram.ir", "")).toBe("invalid_input");
    expect(validateAdminLogin("moazzamitr@gmail.com", "secret")).toBeNull();
  });
});

describe("auth method", () => {
  it("stays on password unless AUTH_METHOD=otp", () => {
    vi.stubEnv("AUTH_METHOD", "");
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    expect(authMethod()).toBe("password");
  });

  it("offers OTP only when AUTH_METHOD=otp", () => {
    vi.stubEnv("AUTH_METHOD", "otp");
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    expect(authMethod()).toBe("otp");
  });
});

describe("withTimeout", () => {
  it("fails open when the session check never settles", async () => {
    await expect(withTimeout(new Promise(() => {}), 20, "auth_timeout")).rejects.toThrow("auth_timeout");
  });
});

describe("login routes", () => {
  it("tells the browser to render the password form", async () => {
    vi.stubEnv("AUTH_METHOD", "password");
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    const res = authConfig();
    expect(res.headers.get("cache-control")).toContain("no-store");
    await expect(res.json()).resolves.toMatchObject({ ok: true, method: "password", minPasswordLength: 8 });
  });

  it("disables phone OTP while password login is the method", async () => {
    vi.stubEnv("AUTH_METHOD", "password");
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    const res = await phoneLogin(jsonRequest("/api/auth/phone-login", { phone: "09120000000", otp: "123456" }, "203.0.113.21"));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "method_disabled" });
  });

  it("rejects a short OTP before checking whether Supabase is configured", async () => {
    vi.stubEnv("AUTH_METHOD", "otp");
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    const res = await phoneLogin(
      jsonRequest("/api/auth/phone-login", { phone: "۰۹۱۲۰۰۰۰۰۰۰", otp: "۱۲۳۴۵" }, "203.0.113.24")
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "invalid_otp" });
  });

  it("rejects a bad phone before checking whether Supabase is configured", async () => {
    vi.stubEnv("AUTH_METHOD", "otp");
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    const res = await phoneLogin(jsonRequest("/api/auth/phone-login", { phone: "123", otp: "123456" }, "203.0.113.25"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "invalid_phone" });
  });

  it("returns invalid_credentials for a bad password login without a session call", async () => {
    const res = await passwordLogin(jsonRequest("/api/auth/password-login", { phone: "123", password: "nope" }, "203.0.113.22"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("returns invalid_input for an incomplete registration", async () => {
    const res = await register(
      jsonRequest("/api/auth/register", { phone: "09120000000", password: "short", firstName: "آ", lastName: "ب" }, "203.0.113.23")
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "invalid_input" });
  });

  it("accepts the public host when Next rewrites request.url", async () => {
    const res = await passwordLogin(
      new Request("http://localhost:3000/api/auth/password-login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://geram.co",
          "x-forwarded-host": "geram.co",
          "x-forwarded-for": "203.0.113.41",
        },
        body: JSON.stringify({ phone: "123", password: "nope" }),
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("sends a form redirect to the public host behind the proxy", async () => {
    const res = await adminLogin(
      new Request("http://localhost:3000/api/auth/admin-login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://geram.co",
          "x-forwarded-host": "geram.co",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "203.0.113.51",
        },
        body: "email=a%40b.co&password=",
      })
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://geram.co/admin/login?error=invalid_input");
  });

  it("redirects a native admin form submit that is missing a password", async () => {
    const res = await adminLogin(
      new Request("https://geram.co/api/auth/admin-login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://geram.co",
          "x-forwarded-for": "203.0.113.24",
        },
        body: "email=admin%40geram.ir&password=",
      })
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://geram.co/admin/login?error=invalid_input");
    expect(wantsHtml(new Request("https://geram.co/x", { headers: { "content-type": "application/json" } }))).toBe(false);
  });
});
