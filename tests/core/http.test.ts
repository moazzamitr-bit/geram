import { afterEach, describe, expect, it, vi } from "vitest";
import { sandboxCookieIdentityAllowed } from "@/lib/core/http";

describe("sandbox cookie identity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function stubLocalSandbox() {
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("GERAM_DEPLOYED", "");
    vi.stubEnv("GERAM_REQUIRE_EXPLICIT_MODE", "");
  }

  it("is allowed only on a local sandbox without Supabase", () => {
    stubLocalSandbox();
    expect(sandboxCookieIdentityAllowed()).toBe(true);
  });

  it("is refused in CLOSED_BETA", () => {
    stubLocalSandbox();
    vi.stubEnv("GERAM_EXECUTION_MODE", "CLOSED_BETA");
    expect(sandboxCookieIdentityAllowed()).toBe(false);
  });

  it("is refused when Supabase auth is configured", () => {
    stubLocalSandbox();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(sandboxCookieIdentityAllowed()).toBe(false);
  });

  it("is refused on a deployed sandbox", () => {
    stubLocalSandbox();
    vi.stubEnv("VERCEL", "1");
    expect(sandboxCookieIdentityAllowed()).toBe(false);
  });
});
