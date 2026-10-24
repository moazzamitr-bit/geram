import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/admin";
import { createCookieAuthClient } from "@/lib/auth/cookie-client";
import {
  publicAuthCookieName,
  serverAuthCookieOptions,
  serverSupabaseUrl,
} from "@/lib/supabase/url";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

const PUBLIC = "https://geram.co/sb";
const INTERNAL = "http://supabase-envoy:8000";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubPublic() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PUBLIC);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
}

describe("server supabase url", () => {
  it("falls back to the public URL when the internal env is missing or blank", () => {
    stubPublic();
    expect(serverSupabaseUrl()).toBe(PUBLIC);
    expect(serverAuthCookieOptions()).toBeUndefined();

    vi.stubEnv("SUPABASE_INTERNAL_URL", "   ");
    expect(serverSupabaseUrl()).toBe(PUBLIC);
    expect(serverAuthCookieOptions()).toBeUndefined();
  });

  it("uses the internal origin for server clients and keeps the public cookie name", () => {
    stubPublic();
    vi.stubEnv("SUPABASE_INTERNAL_URL", INTERNAL);
    expect(serverSupabaseUrl()).toBe(INTERNAL);
    expect(publicAuthCookieName(PUBLIC)).toBe("sb-geram-auth-token");
    expect(serverAuthCookieOptions()).toEqual({ name: "sb-geram-auth-token" });
    expect(serverAuthCookieOptions()?.name).not.toBe("sb-supabase-envoy-auth-token");
  });

  it("does not rename cookies when the internal host is the public host", () => {
    stubPublic();
    vi.stubEnv("SUPABASE_INTERNAL_URL", "https://geram.co/sb");
    expect(serverAuthCookieOptions()).toBeUndefined();
  });

  it("keeps the browser on the public URL while the service client uses the gateway", () => {
    stubPublic();
    vi.stubEnv("SUPABASE_INTERNAL_URL", INTERNAL);
    expect((createBrowserClient() as unknown as { supabaseUrl: string }).supabaseUrl).toBe(PUBLIC);
    expect((createServiceClient() as unknown as { supabaseUrl: string }).supabaseUrl).toBe(INTERNAL);
  });

  it("points password and admin login clients at the gateway without changing the cookie key", async () => {
    stubPublic();
    vi.stubEnv("SUPABASE_INTERNAL_URL", `  ${INTERNAL}  `);
    const client = await createCookieAuthClient();
    expect((client.supabase as unknown as { supabaseUrl: string }).supabaseUrl).toBe(INTERNAL);
    expect((client.supabase.auth as unknown as { storageKey: string }).storageKey).toBe(
      "sb-geram-auth-token"
    );
  });

  it("leaves login clients on the public URL when the internal env is unset", async () => {
    stubPublic();
    vi.stubEnv("SUPABASE_INTERNAL_URL", "");
    const client = await createCookieAuthClient();
    expect((client.supabase as unknown as { supabaseUrl: string }).supabaseUrl).toBe(PUBLIC);
    expect((client.supabase.auth as unknown as { storageKey: string }).storageKey).toBe(
      "sb-geram-auth-token"
    );
  });
});

describe("server entry points", () => {
  it("does not let the browser bundle read the internal URL", () => {
    const browser = readFileSync("lib/supabase/client.ts", "utf8");
    expect(browser).not.toMatch(/process\.env\.SUPABASE_INTERNAL_URL/);
    expect(browser).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
  });

  it("routes every server Supabase constructor through the internal URL helper", () => {
    const files = [
      "lib/supabase/server.ts",
      "lib/supabase/admin.ts",
      "lib/auth/cookie-client.ts",
      "middleware.ts",
      "lib/db/phone-auth.ts",
      "app/api/auth/phone-login/route.ts",
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).toContain("serverSupabaseUrl");
    }
    for (const file of ["lib/supabase/server.ts", "lib/auth/cookie-client.ts", "middleware.ts"]) {
      expect(readFileSync(file, "utf8"), file).toContain("serverAuthCookieOptions");
    }
  });
});
