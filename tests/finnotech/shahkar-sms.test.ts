import { afterEach, describe, expect, it, vi } from "vitest";
import { FINNOTECH_SCOPE } from "@/lib/finnotech/config";
import { resetFinnotechAuthCache } from "@/lib/finnotech/client";
import { isShahkarConfigError, sendShahkarSms, verifyShahkarSms } from "@/lib/finnotech/kyc";

const NID = "0013542419";
const MOBILE = "09121111111";
const SEND_TRACK = "11111111-1111-4111-8111-111111111111";
const VERIFY_TRACK = "22222222-2222-4222-8222-222222222222";

function tokenBody() {
  return {
    status: "DONE",
    result: {
      value: "access-token-value",
      refreshToken: "refresh-token-value",
      lifeTime: 600_000,
      scopes: [],
    },
  };
}

function configure() {
  vi.stubEnv("FINNOTECH_BASE_URL", "https://api.finnotech.ir");
  vi.stubEnv("FINNOTECH_CLIENT_ID", "geram");
  vi.stubEnv("FINNOTECH_CLIENT_SECRET", "super-secret-value");
  vi.stubEnv("FINNOTECH_NID", NID);
}

describe("shahkar sms requests", () => {
  afterEach(() => {
    resetFinnotechAuthCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function queueTrackIds(ids: string[]) {
    let index = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      const next = ids[index] ?? ids[ids.length - 1];
      index += 1;
      return next as ReturnType<typeof crypto.randomUUID>;
    });
  }

  it("sends smsSend and smsVerification with the documented query and a new trackId each call", async () => {
    configure();
    queueTrackIds([SEND_TRACK, VERIFY_TRACK]);
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init: RequestInit) => {
        const href = String(url);
        urls.push(href);
        if (href.includes("/oauth2/token")) return Response.json(tokenBody());
        expect(init.method).toBe("GET");
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer access-token-value");
        if (href.includes("/shahkar/smsSend")) {
          return Response.json({
            status: "DONE",
            trackId: "sms-send-track-id",
            result: { smsSent: true },
          });
        }
        return Response.json({
          status: "DONE",
          trackId: "sms-verify-track-id",
          result: { isValid: true },
        });
      })
    );

    const sent = await sendShahkarSms(MOBILE, NID);
    expect(sent).toEqual({ outcome: "otp_required", trackId: "sms-send-track-id", scope: "kyc" });
    const verified = await verifyShahkarSms("123456", sent.trackId, MOBILE, NID);
    expect(verified).toEqual({ matched: true, trackId: "sms-verify-track-id" });

    const shahkar = urls.filter((href) => href.includes("hahkar"));
    expect(shahkar).toEqual([
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsSend?trackId=${SEND_TRACK}&mobile=${MOBILE}&nationalCode=${NID}`,
      `https://api.finnotech.ir/kyc/v2/clients/geram/smsShahkarVerification?trackId=${VERIFY_TRACK}&otp=123456&inquiryTrackId=sms-send-track-id&mobile=${MOBILE}&nationalCode=${NID}`,
    ]);
    expect(SEND_TRACK).not.toBe(VERIFY_TRACK);
    expect(shahkar[1]).not.toContain(`trackId=${SEND_TRACK}`);
  });

  it("mints a token per call with only that call's granted scope", async () => {
    configure();
    queueTrackIds([SEND_TRACK, VERIFY_TRACK]);
    const tokenScopes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("/oauth2/token")) {
          tokenScopes.push(JSON.parse(String(init?.body)).scopes);
          return Response.json(tokenBody());
        }
        if (href.includes("/smsSend")) return Response.json({ status: "DONE", trackId: "s", result: { smsSent: true } });
        return Response.json({ status: "DONE", trackId: "v", result: { isValid: true } });
      })
    );
    await sendShahkarSms(MOBILE, NID);
    await verifyShahkarSms("12345", "s", MOBILE, NID);
    expect(tokenScopes).toEqual([FINNOTECH_SCOPE.shahkarSend.join(","), FINNOTECH_SCOPE.shahkarVerify.join(",")]);
    expect(tokenScopes.join(",")).not.toContain("kyc:sms-shahkar-verification:post");
    expect(tokenScopes.join(",")).not.toContain("facility:");
  });

  it("treats a token scope rejection as a configuration error and tries no fallback", async () => {
    configure();
    queueTrackIds([SEND_TRACK]);
    const urls: string[] = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        urls.push(String(url));
        return Response.json(
          { status: "FAILED", error: { code: "VALIDATION_ERROR", message: "client has no access to this scope : x" } },
          { status: 400 }
        );
      })
    );
    const err = await sendShahkarSms(MOBILE, NID).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "token_rejected", httpStatus: 400 });
    expect(isShahkarConfigError(err)).toBe(true);
    expect(urls.every((href) => href.includes("/oauth2/token"))).toBe(true);
  });

  it("does not try another verify path after a real OTP rejection", async () => {
    configure();
    queueTrackIds([VERIFY_TRACK, "44444444-4444-4444-8444-444444444444"]);
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        urls.push(href);
        if (href.includes("/oauth2/token")) return Response.json(tokenBody());
        return Response.json(
          { status: "FAILED", error: { code: "OTP_MISMATCH", message: "otp mismatch" } },
          { status: 400 }
        );
      })
    );
    await expect(verifyShahkarSms("123456", "track-send", MOBILE, NID)).rejects.toMatchObject({
      code: "OTP_MISMATCH",
      httpStatus: 400,
    });
    expect(urls.filter((href) => href.includes("hahkar"))).toEqual([
      `https://api.finnotech.ir/kyc/v2/clients/geram/smsShahkarVerification?trackId=${VERIFY_TRACK}&otp=123456&inquiryTrackId=track-send&mobile=${MOBILE}&nationalCode=${NID}`,
    ]);
  });
});
