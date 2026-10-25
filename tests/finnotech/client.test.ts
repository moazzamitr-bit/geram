import { afterEach, describe, expect, it, vi } from "vitest";
import { FINNOTECH_SCOPE, finnotechTimeoutMs } from "@/lib/finnotech/config";
import {
  finnotechCall,
  finnotechDispatcher,
  FinnotechError,
  getFinnotechAccessToken,
  isConnectFailure,
  networkCauseCode,
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
      scopes: [],
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

    const first = await getFinnotechAccessToken(FINNOTECH_SCOPE.identification, 1_000);
    const second = await getFinnotechAccessToken(FINNOTECH_SCOPE.identification, 2_000);
    expect(first).toBe("access-token-value");
    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.finnotech.ir/dev/v2/oauth2/token");
    const minted = JSON.parse(String(calls[0].init.body));
    expect(minted).toEqual({
      grant_type: "client_credentials",
      nid: NID,
      scopes: "kyc:identification-inquiry:get",
    });
    const auth = (calls[0].init.headers as Record<string, string>).Authorization;
    expect(auth.startsWith("Basic ")).toBe(true);
    expect(auth).not.toContain(SECRET);

    const refreshed = await getFinnotechAccessToken(FINNOTECH_SCOPE.identification, 541_000);
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
      method: "GET", scopes: ["kyc:identification-inquiry:get"],
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
    expect(redactSecrets(`mobile 09120000000 +989121111111 nid ${NID}`)).not.toContain("09120000000");
    expect(redactSecrets(`mobile 09120000000 +989121111111 nid ${NID}`)).not.toContain(NID);
    expect(redactSecrets(`mobile 09120000000 +989121111111 nid ${NID}`)).toContain("•••••••0000");
  });

  it("logs a 4xx error message and body with national code and mobile masked", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/oauth2/token")) return Response.json(tokenBody());
        return Response.json(
          {
            status: "FAILED",
            responseCode: "FN-BRFH-40099900000",
            error: {
              code: "VALIDATION_ERROR",
              message: `invalid nationalCode ${NID} mobile 09120000000`,
            },
          },
          { status: 400 }
        );
      })
    );
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await expect(
      finnotechCall({
        method: "GET", scopes: ["kyc:identification-inquiry:get"],
        path: "/kyc/v2/clients/geram/smsShahkarVerification",
        query: { otp: "12345", nationalCode: NID, mobile: "09120000000" },
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", httpStatus: 400 });
    const blob = logs.join("\n");
    expect(blob).toContain("finnotech_http GET /kyc/v2/clients/geram/smsShahkarVerification 400 VALIDATION_ERROR");
    expect(blob).toContain("invalid nationalCode");
    expect(blob).toContain("FN-BRFH-40099900000");
    expect(blob).not.toContain(NID);
    expect(blob).not.toContain("09120000000");
    expect(blob).not.toContain(SECRET);
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
      finnotechCall({ method: "GET", scopes: ["kyc:identification-inquiry:get"], path: "/kyc/v2/clients/geram/identificationInquiry" })
    ).rejects.toBeInstanceOf(FinnotechError);
  });

  it("defaults the read timeout to 8 seconds and passes one keep-alive agent", async () => {
    expect(finnotechTimeoutMs()).toBe(8_000);
    vi.stubEnv("FINNOTECH_TIMEOUT_MS", "0");
    expect(finnotechTimeoutMs()).toBe(8_000);
    configure();
    const inits: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        inits.push(init);
        if (String(url).includes("/oauth2/token")) return Response.json(tokenBody());
        return Response.json({ status: "DONE", result: { ok: true } });
      })
    );
    await finnotechCall({ method: "GET", scopes: ["kyc:identification-inquiry:get"], path: "/kyc/v2/clients/geram/identificationInquiry" });
    expect(inits.length).toBeGreaterThanOrEqual(2);
    for (const init of inits) {
      expect((init as { dispatcher?: unknown }).dispatcher).toBe(finnotechDispatcher);
    }
  });

  it("retries token mint on a connect timeout, then uses the token", async () => {
    configure();
    let tokenHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (!String(url).includes("/oauth2/token")) return Response.json({ status: "DONE", result: { ok: true } });
        tokenHits += 1;
        if (tokenHits < 3) throw connectFailure("UND_ERR_CONNECT_TIMEOUT");
        return Response.json(tokenBody());
      })
    );
    await expect(getFinnotechAccessToken(FINNOTECH_SCOPE.identification, 1_000)).resolves.toBe("access-token-value");
    expect(tokenHits).toBe(3);
  });

  it("retries a POST when the connection never sent, and logs the cause code", async () => {
    configure();
    let apiHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/oauth2/token")) return Response.json(tokenBody());
        apiHits += 1;
        if (apiHits < 3) throw connectFailure("ECONNREFUSED", "connect");
        return Response.json({ status: "DONE", result: { sent: true } });
      })
    );
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await expect(
      finnotechCall({ method: "POST", scopes: ["kyc:identification-inquiry:get"], path: "/facility/v2/clients/geram/finnotextOtp", body: { to: "09120000000" } })
    ).resolves.toMatchObject({ result: { sent: true } });
    expect(apiHits).toBe(3);

    apiHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/oauth2/token")) return Response.json(tokenBody());
        apiHits += 1;
        throw connectFailure("UND_ERR_CONNECT_TIMEOUT");
      })
    );
    resetFinnotechAuthCache();
    await expect(
      finnotechCall({ method: "POST", scopes: ["kyc:identification-inquiry:get"], path: "/messaging/v2/clients/geram/otp/initiate", body: {} })
    ).rejects.toMatchObject({ code: "network" });
    expect(apiHits).toBe(3);
    expect(logs.join("\n")).toContain("finnotech_network POST /messaging/v2/clients/geram/otp/initiate UND_ERR_CONNECT_TIMEOUT");
  });

  it("retries a POST once after the request was sent, and not at all for otp/verify read timeouts", async () => {
    configure();
    let apiHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/oauth2/token")) return Response.json(tokenBody());
        apiHits += 1;
        return Response.json({ status: "FAILED" }, { status: 503 });
      })
    );
    await expect(
      finnotechCall({ method: "POST", scopes: ["kyc:identification-inquiry:get"], path: "/facility/v2/clients/geram/finnotextOtp", body: { to: "09120000000" } })
    ).rejects.toBeInstanceOf(FinnotechError);
    expect(apiHits).toBe(2);

    apiHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/oauth2/token")) return Response.json(tokenBody());
        apiHits += 1;
        throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
      })
    );
    resetFinnotechAuthCache();
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await expect(
      finnotechCall({ method: "POST", scopes: ["kyc:identification-inquiry:get"], path: "/messaging/v2/clients/geram/otp/verify", body: { traceId: "t", otp: "12345" } })
    ).rejects.toMatchObject({ code: "network" });
    expect(apiHits).toBe(1);
    expect(logs.join("\n")).toContain("TimeoutError");
  });

  it("treats ECONNRESET during connect as unsent, and after send as a normal POST retry", () => {
    const duringConnect = connectFailure("ECONNRESET", "connect");
    const afterSend = connectFailure("ECONNRESET", "read");
    expect(isConnectFailure(duringConnect)).toBe(true);
    expect(isConnectFailure(afterSend)).toBe(false);
    expect(networkCauseCode(duringConnect)).toBe("ECONNRESET");
    expect(networkCauseCode(afterSend)).toBe("ECONNRESET");
  });
});

function connectFailure(code: string, syscall?: string) {
  const cause = Object.assign(new Error(code), { code, syscall });
  return Object.assign(new TypeError("fetch failed"), { cause });
}

describe("finnotech per-scope tokens", () => {
  afterEach(() => {
    resetFinnotechAuthCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("caches one token per scope set and never mixes ungranted scopes", async () => {
    vi.stubEnv("FINNOTECH_CLIENT_ID", "geram");
    vi.stubEnv("FINNOTECH_CLIENT_SECRET", SECRET);
    vi.stubEnv("FINNOTECH_NID", NID);
    const minted: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const scopes = JSON.parse(String(init.body)).scopes as string;
        minted.push(scopes);
        return Response.json({ status: "DONE", result: { value: `t-${scopes}`, refreshToken: "r", lifeTime: 600_000 } });
      })
    );
    const a = await getFinnotechAccessToken(FINNOTECH_SCOPE.shahkarSend, 1_000);
    const b = await getFinnotechAccessToken(FINNOTECH_SCOPE.loginOtp, 1_000);
    const a2 = await getFinnotechAccessToken([...FINNOTECH_SCOPE.shahkarSend], 2_000);
    expect(a).not.toBe(b);
    expect(a2).toBe(a);
    expect(minted).toEqual(["kyc:sms-shahkar-send:get", [...FINNOTECH_SCOPE.loginOtp].sort().join(",")]);
    const all = Object.values(FINNOTECH_SCOPE).flat();
    for (const banned of [
      "kyc:sms-shahkar-verification:post",
      "facility:sms-shahkar-verification:get",
      "facility:sms-shahkar-verification:post",
      "facility:shahkar:get",
      "kyc:shahkar:get",
    ]) {
      expect(all).not.toContain(banned);
    }
  });
});
