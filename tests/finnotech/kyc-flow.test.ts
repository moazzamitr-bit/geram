import { describe, expect, it, vi } from "vitest";
import { FinnotechError } from "@/lib/finnotech/client";
import type { IdentityInquiry, ShahkarSend } from "@/lib/finnotech/kyc";
import { KYC_MESSAGES, kycOtpUiError } from "@/lib/kyc/messages";
import {
  confirmShahkarKyc,
  packInquiryTrack,
  startShahkarKyc,
  unpackInquiryTrack,
  type KycAudit,
  type KycChallenge,
  type KycDeps,
  type KycProfile,
  type VerifiedIdentity,
} from "@/lib/kyc/flow";

const NID = "0013542419";

function memory(profile: KycProfile) {
  let challenge: KycChallenge | null = null;
  let saved: VerifiedIdentity | null = null;
  let status = profile.kycStatus;
  const audits: KycAudit[] = [];
  const store: KycDeps["store"] = {
    async getProfile() {
      return { ...profile, kycStatus: status };
    },
    async getChallenge() {
      return challenge;
    },
    async saveChallenge(_userId, next) {
      challenge = next;
    },
    async clearChallenge() {
      challenge = null;
    },
    async markVerified(_userId, identity) {
      saved = identity;
      status = "VERIFIED";
    },
    async markRejected() {
      status = "REJECTED";
    },
  };
  return {
    store,
    audits,
    saved: () => saved,
    status: () => status,
    challenge: () => challenge,
  };
}

function deps(over: Partial<KycDeps> & { profile?: KycProfile } = {}): KycDeps & {
  audits: KycAudit[];
  saved: () => VerifiedIdentity | null;
} {
  const mem = memory(
    over.profile ?? { id: "user-1", phone: "09120000000", kycStatus: "UNVERIFIED", nationalCode: null, birthDate: null }
  );
  return {
    audits: mem.audits,
    saved: mem.saved,
    audit: async (event) => {
      mem.audits.push(event);
    },
    configured: true,
    now: () => 1_000_000,
    limit: () => ({ ok: true, retryAfterSec: 0 }),
    sendShahkar: vi.fn(async () => ({ outcome: "otp_required", trackId: "track-send" }) as ShahkarSend),
    verifyShahkar: vi.fn(async () => ({ matched: true, trackId: "track-verify" })),
    inquire: vi.fn(
      async () =>
        ({
          firstName: "سارا",
          lastName: "اکبری",
          fatherName: "علی",
          alive: true,
          trackId: "track-id",
        }) satisfies IdentityInquiry
    ),
    ...over,
    store: over.store ?? mem.store,
  };
}

describe("shahkar kyc flow", () => {
  it("rejects a bad national code before calling Finnotech", async () => {
    const api = deps();
    await expect(
      startShahkarKyc(api, {
        userId: "user-1",
        nationalCode: "0013542418",
        birthDate: "1370/06/15",
        ip: "203.0.113.5",
      })
    ).rejects.toMatchObject({ code: "invalid_national_code" });
    expect(api.sendShahkar).not.toHaveBeenCalled();
  });

  it("returns a Persian mismatch and does not verify the profile", async () => {
    const api = deps({
      sendShahkar: vi.fn(async () => ({ outcome: "mismatch", trackId: "t-1" }) as ShahkarSend),
    });
    await expect(
      startShahkarKyc(api, {
        userId: "user-1",
        nationalCode: NID,
        birthDate: "1370/06/15",
        ip: "203.0.113.5",
      })
    ).rejects.toMatchObject({
      code: "mismatch",
      message: "شماره موبایل این حساب با کد ملی واردشده یکسان نیست.",
    });
    expect(api.saved()).toBeNull();
    expect(JSON.stringify(api.audits)).not.toContain(NID);
    expect(JSON.stringify(api.audits)).toContain("••••••2419");
  });

  it("verifies after the Shahkar code and stores the registry name", async () => {
    const api = deps();
    const started = await startShahkarKyc(api, {
      userId: "user-1",
      nationalCode: ` ${NID} `,
      birthDate: "۱۳۷۰/۶/۱۵",
      ip: "203.0.113.5",
    });
    expect(started).toEqual({ ok: true, step: "otp" });

    const done = await confirmShahkarKyc(api, { userId: "user-1", otp: "123456", ip: "203.0.113.5" });
    expect(api.verifyShahkar).toHaveBeenCalledWith("123456", "track-send", "09120000000", NID, undefined);
    expect(done).toEqual({ ok: true, step: "verified", firstName: "سارا", lastName: "اکبری" });
    expect(api.saved()).toMatchObject({
      firstName: "سارا",
      lastName: "اکبری",
      fatherName: "علی",
      nationalCode: NID,
      birthDate: "1370/06/15",
      trackId: "track-id",
    });
    expect(api.audits.some((row) => row.action === "kyc.verified")).toBe(true);
    expect(JSON.stringify(api.audits)).not.toContain(NID);
  });

  it("does not verify a deceased record", async () => {
    const api = deps({
      sendShahkar: vi.fn(async () => ({ outcome: "matched_without_otp", trackId: "t" }) as ShahkarSend),
      inquire: vi.fn(async () => ({
        firstName: "سارا",
        lastName: "اکبری",
        fatherName: "علی",
        alive: false,
        trackId: "dead",
      })),
    });
    await expect(
      startShahkarKyc(api, {
        userId: "user-1",
        nationalCode: NID,
        birthDate: "1370/06/15",
        ip: "203.0.113.8",
      })
    ).rejects.toMatchObject({ code: "deceased" });
    expect(api.saved()).toBeNull();
  });

  it("maps a Shahkar 400 to invalid input or a wrong code, and a 503 to an outage", async () => {
    const send = deps({
      sendShahkar: vi.fn(async () => {
        throw new FinnotechError("VALIDATION_ERROR", 400, "شماره موبایل نامعتبر است");
      }),
    });
    await expect(
      startShahkarKyc(send, {
        userId: "user-1",
        nationalCode: NID,
        birthDate: "1370/06/15",
        ip: "203.0.113.10",
      })
    ).rejects.toMatchObject({
      code: "invalid_input",
      httpStatus: 400,
      message: "شماره موبایل نامعتبر است",
    });

    const wrong = deps({
      verifyShahkar: vi.fn(async () => {
        throw new FinnotechError("OTP_MISMATCH", 400, "کد تایید منقضی شده است");
      }),
    });
    await startShahkarKyc(wrong, {
      userId: "user-1",
      nationalCode: NID,
      birthDate: "1370/06/15",
      ip: "203.0.113.11",
    });
    await expect(
      confirmShahkarKyc(wrong, { userId: "user-1", otp: "12345", ip: "203.0.113.11" })
    ).rejects.toMatchObject({
      code: "invalid_otp",
      httpStatus: 400,
      message: "کد تایید منقضی شده است",
    });

    const config = deps({
      verifyShahkar: vi.fn(async () => {
        throw new FinnotechError(
          "VALIDATION_ERROR",
          400,
          "invalid request, Please check service url and http method",
          JSON.stringify({ responseCode: "FN-BRFH-50000040816", error: { code: "VALIDATION_ERROR" } })
        );
      }),
    });
    await startShahkarKyc(config, {
      userId: "user-1",
      nationalCode: NID,
      birthDate: "1370/06/15",
      ip: "203.0.113.12",
    });
    await expect(
      confirmShahkarKyc(config, { userId: "user-1", otp: "12345", ip: "203.0.113.12" })
    ).rejects.toMatchObject({
      code: "provider_config",
      httpStatus: 503,
      message: KYC_MESSAGES.provider_config,
    });

    const down = deps({
      verifyShahkar: vi.fn(async () => {
        throw new FinnotechError("http_503", 503);
      }),
    });
    await startShahkarKyc(down, {
      userId: "user-1",
      nationalCode: NID,
      birthDate: "1370/06/15",
      ip: "203.0.113.13",
    });
    await expect(
      confirmShahkarKyc(down, { userId: "user-1", otp: "12345", ip: "203.0.113.13" })
    ).rejects.toMatchObject({ code: "provider", httpStatus: 502 });
  });

  it("remembers which Shahkar scope sent the code", () => {
    expect(packInquiryTrack("track-send", "facility")).toBe("facility|track-send");
    expect(unpackInquiryTrack("facility|track-send")).toEqual({ scope: "facility", trackId: "track-send" });
    expect(unpackInquiryTrack("track-send")).toEqual({ trackId: "track-send" });
  });

  it("passes the send scope into verify", async () => {
    const api = deps({
      sendShahkar: vi.fn(async () => ({
        outcome: "otp_required" as const,
        trackId: "track-send",
        scope: "facility" as const,
      })),
    });
    await startShahkarKyc(api, {
      userId: "user-1",
      nationalCode: NID,
      birthDate: "1370/06/15",
      ip: "203.0.113.14",
    });
    await confirmShahkarKyc(api, { userId: "user-1", otp: "123456", ip: "203.0.113.14" });
    expect(api.verifyShahkar).toHaveBeenCalledWith("123456", "track-send", "09120000000", NID, "facility");
  });

  it("distinguishes a 400 on the OTP screen from an outage", () => {
    expect(kycOtpUiError(400, { message: "کد تایید منقضی شده است" })).toBe("کد تایید منقضی شده است");
    expect(kycOtpUiError(400, { error: "invalid_otp" })).toBe("کد وارد شده اشتباه یا منقضی شده است");
    expect(kycOtpUiError(503, { error: "provider_config", message: KYC_MESSAGES.provider_config })).toBe(
      KYC_MESSAGES.provider_config
    );
    expect(kycOtpUiError(502, { error: "provider", message: KYC_MESSAGES.provider })).toBe(KYC_MESSAGES.unavailable);
    expect(kycOtpUiError(503, { error: "not_configured" })).toBe(KYC_MESSAGES.not_configured);
    expect(kycOtpUiError(429, { error: "rate_limited", message: KYC_MESSAGES.rate_limited })).toBe(
      KYC_MESSAGES.rate_limited
    );
  });

  it("rate-limits repeated sends", async () => {
    const api = deps({
      limit: () => ({ ok: false, retryAfterSec: 30 }),
    });
    await expect(
      startShahkarKyc(api, {
        userId: "user-1",
        nationalCode: NID,
        birthDate: "1370/06/15",
        ip: "203.0.113.9",
      })
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});
