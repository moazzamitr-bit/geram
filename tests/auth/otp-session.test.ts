import { readFileSync } from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { POST as phoneLogin } from "@/app/api/auth/phone-login/route";
import { createOtpSession } from "@/lib/db/phone-auth";
import { phoneEmail } from "@/lib/auth/phone";

const mem = vi.hoisted(() => {
  type Row = {
    id: string;
    email: string;
    password: string | null;
    recoveryToken: string | null;
    confirmationToken: string | null;
  };
  const users = new Map<string, Row>();
  const adminCalls: string[] = [];
  let seq = 0;
  return {
    users,
    adminCalls,
    lastLink: null as {
      type?: string;
      email?: string;
      password?: string;
      options?: { data?: { phone?: string } };
    } | null,
    reset() {
      users.clear();
      adminCalls.length = 0;
      seq = 0;
      this.lastLink = null;
    },
    nextId() {
      seq += 1;
      return `user-${seq}`;
    },
  };
});

// The route's OTP check is unit-tested elsewhere; here only the session matters.
vi.mock("@/lib/auth/otp", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/otp")>()),
  otpMode: () => "sms",
  verifyOtp: async () => ({ ok: true }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: async () => {
          mem.adminCalls.push("createUser");
          throw new Error("otp must not create a user with a password");
        },
        updateUserById: async () => {
          mem.adminCalls.push("updateUserById");
          throw new Error("otp must not rotate the password");
        },
        generateLink: async (params: {
          type: string;
          email: string;
          password?: string;
          options?: { data?: { phone?: string } };
        }) => {
          mem.adminCalls.push("generateLink");
          mem.lastLink = params;
          if (params.password) throw new Error("generateLink must not receive a password");
          let user = mem.users.get(params.email);
          const token = `hash-${params.email}`;
          if (!user) {
            // GoTrue assigns this itself for a brand-new magiclink. The app never chooses it.
            user = {
              id: mem.nextId(),
              email: params.email,
              password: "gotrue-internal-unusable",
              recoveryToken: null,
              confirmationToken: token,
            };
            mem.users.set(params.email, user);
          } else {
            user.recoveryToken = token;
          }
          return {
            data: {
              properties: { hashed_token: token },
              user: { id: user.id, email: user.email },
            },
            error: null,
          };
        },
      },
      verifyOtp: async (params: { token_hash: string; type: string }) => {
        if (params.type !== "email") {
          return { data: { session: null, user: null }, error: { message: "wrong verify type" } };
        }
        const user = [...mem.users.values()].find(
          (row) => row.recoveryToken === params.token_hash || row.confirmationToken === params.token_hash
        );
        if (!user) {
          return {
            data: { session: null, user: null },
            error: { message: "Email link is invalid or has expired" },
          };
        }
        user.recoveryToken = null;
        user.confirmationToken = null;
        return {
          data: {
            session: { access_token: `access-${user.id}`, refresh_token: `refresh-${user.id}` },
            user: { id: user.id, email: user.email },
          },
          error: null,
        };
      },
      signInWithPassword: async (params: { email: string; password: string }) => {
        const user = mem.users.get(params.email);
        if (!user || user.password !== params.password) {
          return { data: { session: null, user: null }, error: { message: "Invalid login credentials" } };
        }
        return {
          data: {
            session: { access_token: `access-${user.id}`, refresh_token: `refresh-${user.id}` },
            user: { id: user.id },
          },
          error: null,
        };
      },
    },
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({
            data: {
              id,
              phone: "09120000000",
              first_name: "آوا",
              last_name: "آزمایش",
              kyc_status: "UNVERIFIED",
              onboarding_done: true,
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

const PHONE = "09120000000";
const EMAIL = phoneEmail(PHONE);
const CHOSEN = "chosen-secret-password";

function supabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://geram.co/sb");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
  vi.stubEnv("AUTH_METHOD", "otp");
  vi.stubEnv("FINNOTECH_CLIENT_ID", "");
  vi.stubEnv("FINNOTECH_CLIENT_SECRET", "");
  vi.stubEnv("FINNOTECH_NID", "");
  vi.stubEnv("SMSIR_API_KEY", "");
  vi.stubEnv("SMSIR_TEMPLATE_ID", "");
  vi.stubEnv("KAVENEGAR_API_KEY", "");
  vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "");
}

function seedPasswordUser() {
  mem.users.set(EMAIL, {
    id: "user-password",
    email: EMAIL,
    password: CHOSEN,
    recoveryToken: null,
    confirmationToken: null,
  });
}

afterEach(() => {
  mem.reset();
  vi.unstubAllEnvs();
});

describe("otp session without password rotation", () => {
  it("keeps the registered password and still opens an OTP session", async () => {
    supabaseEnv();
    seedPasswordUser();

    const otp = await createOtpSession(PHONE);
    expect(otp.session).toEqual({
      access_token: "access-user-password",
      refresh_token: "refresh-user-password",
    });
    expect(otp.profile.id).toBe("user-password");
    expect(mem.users.get(EMAIL)?.password).toBe(CHOSEN);
    expect(mem.adminCalls).toEqual(["generateLink"]);
    expect(mem.lastLink).toMatchObject({
      type: "magiclink",
      email: EMAIL,
      options: { data: { phone: PHONE } },
    });
    expect(mem.lastLink).not.toHaveProperty("password");

    const anon = createClient("https://geram.co/sb", "anon-key");
    const password = await anon.auth.signInWithPassword({ email: EMAIL, password: CHOSEN });
    expect(password.error).toBeNull();
    expect(password.data.user?.id).toBe("user-password");

    const again = await createOtpSession(PHONE);
    expect(again.session.access_token).toBe("access-user-password");
    expect(mem.users.get(EMAIL)?.password).toBe(CHOSEN);
  });

  it("does not let the app choose a password for a first OTP login", async () => {
    supabaseEnv();
    const otp = await createOtpSession(PHONE);
    expect(otp.session.access_token).toMatch(/^access-user-/);
    expect(mem.adminCalls).toEqual(["generateLink"]);
    expect(mem.users.get(EMAIL)?.password).toBe("gotrue-internal-unusable");
    const anon = createClient("https://geram.co/sb", "anon-key");
    const password = await anon.auth.signInWithPassword({ email: EMAIL, password: CHOSEN });
    expect(password.data.session).toBeNull();
  });

  it("signs the same password user in through the phone login route", async () => {
    supabaseEnv();
    seedPasswordUser();
    const res = await phoneLogin(
      new Request("https://geram.co/api/auth/phone-login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.77",
        },
        body: JSON.stringify({ phone: PHONE, otp: "123456" }),
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      session: { access_token: "access-user-password" },
      profile: { id: "user-password", first_name: "آوا" },
    });
    expect(mem.users.get(EMAIL)?.password).toBe(CHOSEN);
    expect(mem.adminCalls).toEqual(["generateLink"]);
  });

  it("refuses a session when the service role is missing", async () => {
    supabaseEnv();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    seedPasswordUser();
    await expect(createOtpSession(PHONE)).rejects.toThrow("phone_auth_misconfigured");
    expect(mem.users.get(EMAIL)?.password).toBe(CHOSEN);
    expect(mem.adminCalls).toEqual([]);

    const res = await phoneLogin(
      new Request("https://geram.co/api/auth/phone-login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.78",
        },
        body: JSON.stringify({ phone: PHONE, otp: "123456" }),
      })
    );
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "service_unavailable" });
    expect(mem.users.get(EMAIL)?.password).toBe(CHOSEN);
  });

  it("does not keep the password-rotation helpers", () => {
    const src = readFileSync("lib/db/phone-auth.ts", "utf8");
    expect(src).not.toContain("updateUserById");
    expect(src).not.toContain("ensurePhoneUser");
    expect(src).toContain("generateLink");
    expect(src).toContain('type: "email"');
  });
});
