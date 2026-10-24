import { afterEach, describe, expect, it, vi } from "vitest";
import { resetFinnotechAuthCache } from "@/lib/finnotech/client";
import { verifyCardOwner, verifyIbanOwner } from "@/lib/finnotech/bank";

describe("finnotech bank ownership", () => {
  afterEach(() => {
    resetFinnotechAuthCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls card and IBAN owner endpoints without a live network", async () => {
    vi.stubEnv("FINNOTECH_BASE_URL", "https://api.finnotech.ir");
    vi.stubEnv("FINNOTECH_CLIENT_ID", "geram");
    vi.stubEnv("FINNOTECH_CLIENT_SECRET", "secret");
    vi.stubEnv("FINNOTECH_NID", "0013542419");
    const calls: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const href = String(url);
        calls.push({
          url: href,
          method: init.method ?? "GET",
          body: init.body ? JSON.parse(String(init.body)) : null,
        });
        if (href.includes("/oauth2/token")) {
          return Response.json({
            status: "DONE",
            result: { value: "tok", refreshToken: "ref", lifeTime: 600_000 },
          });
        }
        return Response.json({ status: "DONE", trackId: "bank-track", result: { isValid: true } });
      })
    );

    expect(await verifyCardOwner("4111111111111111", "0013542419")).toEqual({
      matched: true,
      trackId: "bank-track",
    });
    expect(await verifyIbanOwner("IR820540102680020817909002", "0013542419")).toMatchObject({
      matched: true,
    });
    const card = calls.find((call) => call.url.includes("cardOwnerVerification"));
    const iban = calls.find((call) => call.url.includes("ibanOwnerVerification"));
    expect(card?.method).toBe("POST");
    expect(card?.body).toEqual({ card: "4111111111111111", nationalCode: "0013542419" });
    expect(card?.url).not.toContain("secret");
    expect(iban?.method).toBe("GET");
    expect(iban?.url).toContain("nationalCode=0013542419");
    expect(JSON.stringify(calls)).not.toContain("4111111111111111secret");
  });
});