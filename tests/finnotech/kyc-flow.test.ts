import { describe, expect, it, vi } from "vitest";
import type { IdentityInquiry, ShahkarSend } from "@/lib/finnotech/kyc";
import {
  confirmShahkarKyc,
  startShahkarKyc,
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
