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
    expect(sent).toEqual({ outcome: "otp_required", trackId: "sms-send-track-id" });
    const verified = await verifyShahkarSms("123456", sent.trackId, MOBILE, NID);
    expect(verified).toEqual({ matched: true, trackId: "sms-verify-track-id" });

    const shahkar = urls.filter((href) => href.includes("/shahkar/"));
    expect(shahkar).toEqual([
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsSend?trackId=${SEND_TRACK}&mobile=${MOBILE}&nationalCode=${NID}`,
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsVerification?trackId=${VERIFY_TRACK}&otp=123456&inquiryTrackId=sms-send-track-id&mobile=${MOBILE}&nationalCode=${NID}`,
    ]);
    expect(SEND_TRACK).not.toBe(VERIFY_TRACK);
    expect(shahkar[1]).not.toContain(`trackId=${SEND_TRACK}`);
  });

  it("falls back to facility smsSend version 2, then smsVerify, each with its own trackId", async () => {
    configure();
    queueTrackIds([SEND_TRACK, FALLBACK_TRACK, VERIFY_TRACK, "44444444-4444-4444-8444-444444444444"]);
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        urls.push(href);
        if (href.includes("/oauth2/token")) return Response.json(tokenBody());
        if (href.includes("/kyc/") && href.includes("/shahkar/smsSend")) {
          return Response.json({ status: "FAILED", error: { code: "NOT_FOUND", message: "missing" } }, { status: 404 });
        }
        if (href.includes("/facility/") && href.includes("/shahkar/smsSend")) {
          return Response.json({ status: "DONE", trackId: "facility-send-track", result: { smsSent: true } });
        }
        if (href.includes("/shahkar/smsVerification")) {
          return Response.json({ status: "FAILED", error: { code: "NOT_FOUND", message: "missing" } }, { status: 404 });
        }
        if (href.includes("/shahkar/smsVerify")) {
          return Response.json({ status: "DONE", trackId: "legacy-verify-track", result: { isValid: false } });
        }
        return Response.json({ status: "FAILED" }, { status: 500 });
      })
    );

    const sent = await sendShahkarSms(MOBILE, NID);
    expect(sent).toEqual({ outcome: "otp_required", trackId: "facility-send-track" });
    const verified = await verifyShahkarSms("998877", "facility-send-track", MOBILE, NID);
    expect(verified).toEqual({ matched: false, trackId: "legacy-verify-track" });

    const shahkar = urls.filter((href) => href.includes("/shahkar/"));
    expect(shahkar).toEqual([
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsSend?trackId=${SEND_TRACK}&mobile=${MOBILE}&nationalCode=${NID}`,
      `https://api.finnotech.ir/facility/v2/clients/geram/shahkar/smsSend?trackId=${FALLBACK_TRACK}&mobile=${MOBILE}&nationalCode=${NID}&version=2`,
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsVerification?trackId=${VERIFY_TRACK}&otp=998877&inquiryTrackId=facility-send-track&mobile=${MOBILE}&nationalCode=${NID}`,
      `https://api.finnotech.ir/kyc/v2/clients/geram/shahkar/smsVerify?trackId=44444444-4444-4444-8444-444444444444&otp=998877&inquiryTrackId=facility-send-track&mobile=${MOBILE}&nationalCode=${NID}`,
    ]);
  });
});
