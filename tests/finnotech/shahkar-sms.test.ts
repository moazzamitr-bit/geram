import { afterEach, describe, expect, it, vi } from "vitest";
import { FINNOTECH_SCOPES } from "@/lib/finnotech/config";
import { resetFinnotechAuthCache } from "@/lib/finnotech/client";
import { sendShahkarSms, verifyShahkarSms } from "@/lib/finnotech/kyc";

const NID = "0013542419";
const MOBILE = "09121111111";
const SEND_TRACK = "11111111-1111-4111-8111-111111111111";
const VERIFY_TRACK = "22222222-2222-4222-8222-222222222222";
const FALLBACK_TRACK = "33333333-3333-4333-8333-333333333333";

function tokenBody() {
  return {
    status: "DONE",
    result: {
      value: "access-token-value",
      refreshToken: "refresh-token-value",
      lifeTime: 600_000,
      scopes: FINNOTECH_SCOPES.split(","),
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
    const verified = await verifyShahkarSms("123456", sent.trackId, MOBILE, NID, sent.scope);
    expect(verified).toEqual({ matched: true, trackId: "sms-verify-track-id" });

    const shahkar = urls.filter((href) => href.includes("/shahkar/"));
    expect(shahkar).toEqual([
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsSend?trackId=${SEND_TRACK}&mobile=${MOBILE}&nationalCode=${NID}`,
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsVerification?trackId=${VERIFY_TRACK}&otp=123456&inquiryTrackId=sms-send-track-id&mobile=${MOBILE}&nationalCode=${NID}`,
    ]);
    expect(SEND_TRACK).not.toBe(VERIFY_TRACK);
    expect(shahkar[1]).not.toContain(`trackId=${SEND_TRACK}`);
  });

  it("pairs verify with the facility smsSend that succeeded and falls through a validation error", async () => {
    configure();
    const postTrack = "44444444-4444-4444-8444-444444444444";
    queueTrackIds([SEND_TRACK, FALLBACK_TRACK, VERIFY_TRACK, postTrack]);
    const calls: { href: string; method: string; body: string | null }[] = [];
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = String(url);
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? init.body : null;
        calls.push({ href, method, body });
        if (href.includes("/oauth2/token")) return Response.json(tokenBody());
        if (href.includes("/kyc/") && href.includes("/shahkar/smsSend")) {
          return Response.json(
            {
              status: "FAILED",
              responseCode: "FN-BRFH-50000040816",
              error: { code: "VALIDATION_ERROR", message: "invalid request, Please check service url and http method" },
            },
            { status: 400 }
          );
        }
        if (href.includes("/facility/") && href.includes("/shahkar/smsSend")) {
          return Response.json({ status: "DONE", trackId: "facility-send-track", result: { smsSent: true } });
        }
        if (method === "GET" && href.includes("/facility/") && href.includes("/shahkar/smsVerification")) {
          return Response.json(
            {
              status: "FAILED",
              responseCode: "FN-BRFH-50000040816",
              error: { code: "VALIDATION_ERROR", message: "invalid request, Please check service url and http method" },
            },
            { status: 400 }
          );
        }
        if (method === "POST" && href.includes("/facility/") && href.includes("/shahkar/smsVerification")) {
          return Response.json({ status: "DONE", trackId: "post-verify-track", result: { isValid: true } });
        }
        return Response.json({ status: "FAILED", error: { code: "NOT_FOUND", message: "missing" } }, { status: 404 });
      })
    );

    const sent = await sendShahkarSms(MOBILE, NID);
    expect(sent).toEqual({ outcome: "otp_required", trackId: "facility-send-track", scope: "facility" });
    const verified = await verifyShahkarSms("998877", sent.trackId, MOBILE, NID, sent.scope);
    expect(verified).toEqual({ matched: true, trackId: "post-verify-track" });

    const shahkar = calls.filter((call) => call.href.includes("/shahkar/"));
    expect(shahkar.map((call) => `${call.method} ${call.href}`)).toEqual([
      `GET https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsSend?trackId=${SEND_TRACK}&mobile=${MOBILE}&nationalCode=${NID}`,
      `GET https://api.finnotech.ir/facility/v2/clients/geram/shahkar/smsSend?trackId=${FALLBACK_TRACK}&mobile=${MOBILE}&nationalCode=${NID}&version=2`,
      `GET https://api.finnotech.ir/facility/v2/clients/geram/shahkar/smsVerification?trackId=${VERIFY_TRACK}&otp=998877&inquiryTrackId=facility-send-track&mobile=${MOBILE}&nationalCode=${NID}&version=2`,
      `POST https://api.finnotech.ir/facility/v2/clients/geram/shahkar/smsVerification?trackId=${postTrack}&version=2`,
    ]);
    expect(JSON.parse(shahkar[3].body ?? "{}")).toEqual({
      otp: "998877",
      inquiryTrackId: "facility-send-track",
      mobile: MOBILE,
      nationalCode: NID,
    });
    const blob = logs.join("\n");
    expect(blob).toContain("shahkar_sms GET /kyc/v2/clients/geram/shahkar/smsSend 400");
    expect(blob).toContain("shahkar_sms GET /facility/v2/clients/geram/shahkar/smsSend 200");
    expect(blob).toContain("shahkar_sms GET /facility/v2/clients/geram/shahkar/smsVerification 400");
    expect(blob).toContain("FN-BRFH-50000040816");
    expect(blob).toContain("shahkar_sms POST /facility/v2/clients/geram/shahkar/smsVerification 200");
    expect(blob).not.toContain("998877");
    expect(blob).not.toContain(MOBILE);
    expect(blob).not.toContain(NID);
    expect(blob).not.toContain("super-secret-value");
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
    await expect(verifyShahkarSms("123456", "track-send", MOBILE, NID, "kyc")).rejects.toMatchObject({
      code: "OTP_MISMATCH",
      httpStatus: 400,
    });
    expect(urls.filter((href) => href.includes("/shahkar/"))).toEqual([
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsVerification?trackId=${VERIFY_TRACK}&otp=123456&inquiryTrackId=track-send&mobile=${MOBILE}&nationalCode=${NID}`,
    ]);
  });
});
