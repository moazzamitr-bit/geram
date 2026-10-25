import { afterEach, describe, expect, it, vi } from "vitest";
import { resetFinnotechAuthCache } from "@/lib/finnotech/client";
import { verifyCardOwner } from "@/lib/finnotech/bank";

describe("finnotech card ownership", () => {
  afterEach(() => {
    resetFinnotechAuthCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts {card, nid} with a card-owner-only token", async () => {
    vi.stubEnv("FINNOTECH_BASE_URL", "https://api.finnotech.ir");
    vi.stubEnv("FINNOTECH_CLIENT_ID", "geram");
    vi.stubEnv("FINNOTECH_CLIENT_SECRET", "secret");
    vi.stubEnv("FINNOTECH_NID", "0013542419");
    const calls: { url: string; method: string; body: Record<string, unknown> | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const href = String(url);
        calls.push({ url: href, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null });
        if (href.includes("/oauth2/token")) {
          return Response.json({ status: "DONE", result: { value: "tok", refreshToken: "ref", lifeTime: 600_000 } });
        }
        return Response.json({ status: "DONE", trackId: "bank-track", result: { isValid: true } });
      })
    );

    expect(await verifyCardOwner("4111111111111111", "0013542419")).toEqual({ matched: true, trackId: "bank-track" });
    const token = calls.find((call) => call.url.includes("/oauth2/token"));
    expect(token?.body?.scopes).toBe("kyc:card-owner-verification:post");
    const card = calls.find((call) => call.url.includes("cardOwnerVerification"));
    expect(card?.method).toBe("POST");
    expect(card?.url).toContain("/kyc/v2/clients/geram/cardOwnerVerification");
    expect(card?.body).toEqual({ card: "4111111111111111", nid: "0013542419" });
  });
});
