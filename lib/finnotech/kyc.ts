import { finnotechCall, FinnotechError } from "@/lib/finnotech/client";
import { finnotechClientId } from "@/lib/finnotech/config";

/**
 * Shahkar SMS send + verification, then civil-registry identification.
 *
 * smsSend contract, operation facilityShahkarSmsSendGet in
 * https://docs.finnotech.ir/openapi-public.json (fetched 2026-10-24):
 *   GET /facility/v2/clients/{clientId}/shahkar/smsSend
 *   required query: trackId (UUID, max 40), mobile, nationalCode
 *   optional query: version=2
 *   result.smsSent
 * Scope facility:sms-shahkar-send:get. The live client still answers the KYC
 * alias first (scope kyc:sms-shahkar-send:get):
 *   GET /kyc/v2/clients/{clientId}/shahkar/smsSend
 *   query: trackId, mobile, nationalCode
 * Facility is the 404 fallback and sends version=2.
 *
 * smsVerification is not in that public OpenAPI. Production
 *   GET /kyc/v2/clients/{clientId}/shahkar/smsVerification
 *   (scope kyc:sms-shahkar-verification:get)
 * returns 400 VALIDATION_ERROR when the query is only otp and inquiryTrackId.
 * The call sends the smsSend subject keys (mobile, nationalCode), the code
 * (otp), the smsSend response track id as inquiryTrackId (the follow-up name
 * used by finnotextInquiry and transactionCreditInquiryVerify in the same
 * spec), and a new trackId. finnotechCall sets a fresh UUID trackId on every call.
 *
 * Identification (scope kyc:identification-inquiry:get):
 *   GET /kyc/v2/clients/{clientId}/identificationInquiry
 *     nationalCode, birthDate yyyy/mm/dd
 */

export type ShahkarSend =
  | { outcome: "otp_required"; trackId: string }
  | { outcome: "mismatch"; trackId: string }
  | { outcome: "matched_without_otp"; trackId: string };

export type IdentityInquiry = {
  firstName: string;
  lastName: string;
  fatherName: string;
  alive: boolean;
  trackId: string;
};

function clientPath(prefix: string) {
  return `/${prefix}/v2/clients/${encodeURIComponent(finnotechClientId())}`;
}

type SendBody = { smsSent?: boolean; isValid?: boolean };

function interpretSend(trackId: string, result: SendBody): ShahkarSend {
  if (result.isValid === false || result.smsSent === false) {
    return { outcome: "mismatch", trackId };
  }
  if (result.smsSent === true) return { outcome: "otp_required", trackId };
  if (result.isValid === true) return { outcome: "matched_without_otp", trackId };
  throw new FinnotechError("send_unrecognized", 200);
}

function mismatchError(err: unknown) {
  return err instanceof FinnotechError && /mismatch|not_?match|shahkar_reject|nid_mobile/i.test(err.code);
}

export async function sendShahkarSms(mobile: string, nationalCode: string): Promise<ShahkarSend> {
  const query = { mobile, nationalCode };
  try {
    const sent = await finnotechCall<SendBody>({
      method: "GET",
      path: `${clientPath("kyc")}/shahkar/smsSend`,
      query,
    });
    return interpretSend(sent.trackId, sent.result);
  } catch (err) {
    if (mismatchError(err)) return { outcome: "mismatch", trackId: "" };
    if (!(err instanceof FinnotechError) || err.httpStatus !== 404) throw err;
  }
  const sent = await finnotechCall<SendBody>({
    method: "GET",
    path: `${clientPath("facility")}/shahkar/smsSend`,
    query: { ...query, version: 2 },
  });
  return interpretSend(sent.trackId, sent.result);
}

export async function verifyShahkarSms(
  otp: string,
  inquiryTrackId: string,
  mobile: string,
  nationalCode: string
) {
  const query = { otp, inquiryTrackId, mobile, nationalCode };
  const paths = [
    `${clientPath("kyc")}/shahkar/smsVerification`,
    `${clientPath("kyc")}/shahkar/smsVerify`,
  ];
  let last: unknown;
  for (const path of paths) {
    try {
      const verified = await finnotechCall<{ isValid?: boolean }>({
        method: "GET",
        path,
        query,
      });
      return { matched: verified.result.isValid === true, trackId: verified.trackId };
    } catch (err) {
      last = err;
      if (!(err instanceof FinnotechError) || err.httpStatus !== 404) throw err;
    }
  }
  throw last instanceof Error ? last : new FinnotechError("verify_missing", 404);
}

function isAlive(deathStatus: unknown) {
  if (typeof deathStatus !== "string" || deathStatus.trim() === "") return true;
  const value = deathStatus.trim().toLowerCase();
  return value === "زنده" || value === "alive";
}

export async function inquireIdentity(nationalCode: string, birthDate: string): Promise<IdentityInquiry> {
  const inquiry = await finnotechCall<{
    firstName?: string;
    lastName?: string;
    fatherName?: string;
    deathStatus?: string;
  }>({
    method: "GET",
    path: `${clientPath("kyc")}/identificationInquiry`,
    query: { nationalCode, birthDate },
  });
  const result = inquiry.result;
  return {
    firstName: (result.firstName ?? "").trim(),
    lastName: (result.lastName ?? "").trim(),
    fatherName: (result.fatherName ?? "").trim(),
    alive: isAlive(result.deathStatus) && result.deathStatus !== "مرده",
    trackId: inquiry.trackId,
  };
}
