import { createServiceClient } from "@/lib/supabase/admin";
import { safeFinnotechLog } from "@/lib/finnotech/client";
import {
  KycFlowError,
  packInquiryTrack,
  unpackInquiryTrack,
  type KycChallenge,
  type KycProfile,
  type KycStore,
  type VerifiedIdentity,
} from "@/lib/kyc/flow";
import { writeAudit } from "@/lib/admin/audit";

type ChallengeRow = {
  national_code: string;
  birth_date: string;
  inquiry_track_id: string;
  expires_at: string;
  attempts: number;
  shahkar_matched: boolean;
  created_at: string;
};

function rowToChallenge(row: ChallengeRow): KycChallenge {
  const packed = unpackInquiryTrack(row.inquiry_track_id);
  return {
    nationalCode: row.national_code,
    birthDate: row.birth_date,
    inquiryTrackId: packed.trackId,
    sendScope: packed.scope,
    expiresAt: new Date(row.expires_at).getTime(),
    attempts: Number(row.attempts ?? 0),
    shahkarMatched: Boolean(row.shahkar_matched),
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function supabaseKycStore(): KycStore {
  const db = createServiceClient();
  return {
    async getProfile(userId): Promise<KycProfile | null> {
      const { data, error } = await db
        .from("profiles")
        .select("id, phone, kyc_status, national_code, kyc_birth_date, kyc_verified_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        safeFinnotechLog("kyc_profile", new Error(error.message));
        return null;
      }
      if (!data) return null;
      return {
        id: data.id,
        phone: data.phone,
        kycStatus: data.kyc_status,
        nationalCode: data.national_code,
        birthDate: data.kyc_birth_date,
        verifiedAt: data.kyc_verified_at,
      };
    },
    async getChallenge(userId) {
      const { data, error } = await db
        .from("kyc_challenges")
        .select("national_code, birth_date, inquiry_track_id, expires_at, attempts, shahkar_matched, created_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return null;
      return rowToChallenge(data as ChallengeRow);
    },
    async saveChallenge(userId, challenge) {
      const { error } = await db.from("kyc_challenges").upsert({
        user_id: userId,
        national_code: challenge.nationalCode,
        birth_date: challenge.birthDate,
        inquiry_track_id: packInquiryTrack(challenge.inquiryTrackId, challenge.sendScope),
        expires_at: new Date(challenge.expiresAt).toISOString(),
        attempts: challenge.attempts,
        shahkar_matched: challenge.shahkarMatched,
        created_at: new Date(challenge.createdAt).toISOString(),
      });
      if (error) {
        safeFinnotechLog("kyc_challenge", new Error(error.message));
        throw new KycFlowError("unavailable", 503);
      }
    },
    async clearChallenge(userId) {
      await db.from("kyc_challenges").delete().eq("user_id", userId);
    },
    async markVerified(userId, identity: VerifiedIdentity) {
      const { error } = await db
        .from("profiles")
        .update({
          first_name: identity.firstName,
          last_name: identity.lastName,
          father_name: identity.fatherName,
          national_code: identity.nationalCode,
          kyc_birth_date: identity.birthDate,
          kyc_status: "VERIFIED",
          kyc_verified_at: identity.verifiedAt,
          kyc_checked_at: identity.checkedAt ?? identity.verifiedAt,
          kyc_provider: "finnotech",
          kyc_track_id: identity.trackId,
        })
        .eq("id", userId);
      if (error) {
        safeFinnotechLog("kyc_verify", new Error(error.message));
        if (error.code === "23505") throw new KycFlowError("duplicate_national_code", 409);
        throw new KycFlowError("unavailable", 503);
      }
    },
    async markRejected(userId, checkedAt, trackId) {
      await db
        .from("profiles")
        .update({
          kyc_status: "REJECTED",
          kyc_checked_at: checkedAt,
          kyc_provider: "finnotech",
          kyc_track_id: trackId,
        })
        .eq("id", userId);
    },
  };
}

export async function auditKyc(event: {
  userId: string;
  action: string;
  result: "ok" | "error";
  meta: Record<string, unknown>;
}) {
  await writeAudit({
    actorId: event.userId,
    role: "user",
    action: event.action,
    entity: "profile",
    entityId: event.userId,
    result: event.result,
    meta: event.meta,
  });
}
