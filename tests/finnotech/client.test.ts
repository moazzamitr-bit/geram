import { afterEach, describe, expect, it, vi } from "vitest";
import { FINNOTECH_SCOPES } from "@/lib/finnotech/config";
import {
  finnotechCall,
  FinnotechError,
  getFinnotechAccessToken,
  resetFinnotechAuthCache,
} from "@/lib/finnotech/client";
import { redactSecrets } from "@/lib/finnotech/redact";

const SECRET = "super-secret-value";
const NID = "0013542419";

function tokenBody(lifeTime = 600_000) {
  return {
    status: "DONE",
    result: {
      value: "access-token-value",
      refreshToken: "refresh-token-value",
      lifeTime,
      scopes: FINNOTECH_SCOPES.split(","),
    },
  };
}

describe("finnotech client", () => {
  afterEach(() => {
    resetFinnotechAuthCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function configure() {
    vi.stubEnv("FINNOTECH_BASE_URL", "https://api.finnotech.ir");
    vi.stubEnv("FINNOTECH_CLIENT_ID", "geram");
    vi.stubEnv("FINNOTECH_CLIENT_SECRET", SECRET);
    vi.stubEnv("FINNOTECH_NID", NID);
  }

  it("mints a client-credentials token, caches it, then refreshes", async () => {
    configure();
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes("/oauth2/token/refresh")) {
          return Response.json({
            status: "DONE",
            result: {
              value: "access-2",
              refreshToken: "refresh-2",
              lifeTime: 600_000,
            },
          });
        }
        if (String(url).includes("/oauth2/token")) return Response.json(tokenBody());
        return Response.json({ status: "DONE", result: { ok: true } });
      })
    );

    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    const first = await getFinnotechAccessToken(1_000);
    const second = await getFinnotechAccessToken(2_000);
    expect(first).toBe("access-token-value");
    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.finnotech.ir/dev/v2/oauth2/token");
    const minted = JSON.parse(String(calls[0].init.body));
    expect(minted).toEqual({
      grant_type: "client_credentials",
      nid: NID,
      scopes: FINNOTECH_SCOPES,
    });
    expect(FINNOTECH_SCOPES).toContain("kyc:sms-shahkar-send:get");
    expect(FINNOTECH_SCOPES).toContain("kyc:sms-shahkar-verification:get");
    expect(FINNOTECH_SCOPES).toContain("facility:sms-shahkar-send:get");
    expect(FINNOTECH_SCOPES).toContain("kyc:identification-inquiry:get");
    expect(FINNOTECH_SCOPES).toContain("messaging:otp-initiate:post");
    expect(FINNOTECH_SCOPES).toContain("messaging:otp-verify:post");
    const auth = (calls[0].init.headers as Record<string, string>).Authorization;
    expect(auth.startsWith("Basic ")).toBe(true);
    expect(auth).not.toContain(SECRET);

    const refreshed = await getFinnotechAccessToken(541_000);
    expect(refreshed).toBe("access-2");
    const refreshCall = calls.find((call) => call.url.includes("/token/refresh"));
    expect(refreshCall).toBeTruthy();
    expect(JSON.parse(String(refreshCall!.init.body))).toMatchObject({
      grant_type: "refresh_token",
      token_type: "CLIENT-CREDENTIAL",
      refresh_token: "refresh-token-value",
    });
    expect(logs.join("\n")).not.toContain(SECRET);
    expect(logs.join("\n")).not.toContain("refresh-token-value");
  });

  it("sends a trackId, retries a 503, and does not log the national code", async () => {
    configure();
    let apiHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        if (href.includes("/oauth2/token")) return Response.json(tokenBody());
        apiHits += 1;
        if (apiHits === 1) return Response.json({ status: "FAILED" }, { status: 503 });
        return Response.json({
          status: "DONE",
          trackId: "from-server",
          result: { firstName: "سارا", lastName: "اکبری" },
        });
      })
    );
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    const result = await finnotechCall<{ firstName: string }>({
      method: "GET",
      path: "/kyc/v2/clients/geram/identificationInquiry",
      query: { nationalCode: NID, birthDate: "1370/06/15" },
    });
    expect(result.result.firstName).toBe("سارا");
    expect(result.trackId).toBe("from-server");
    expect(apiHits).toBe(2);
    const blob = logs.join("\n");
    expect(blob).not.toContain(NID);
    expect(blob).not.toContain(SECRET);
    expect(redactSecrets(`nid ${NID} Bearer abc.def`)).not.toContain(NID);
    expect(redactSecrets(`nid ${NID} Bearer abc.def`)).toContain("Bearer [redacted]");
  });

  it("stops after timeouts", async () => {
    configure();
    vi.stubEnv("FINNOTECH_TIMEOUT_MS", "30");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const fail = () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
          if (init.signal?.aborted) fail();
          init.signal?.addEventListener("abort", fail);
        });
      })
    );
    await expect(
      finnotechCall({ method: "GET", path: "/kyc/v2/clients/geram/identificationInquiry" })
    ).rejects.toBeInstanceOf(FinnotechError);
  });
});
