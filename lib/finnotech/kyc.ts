import { finnotechCall, FinnotechError } from "@/lib/finnotech/client";
import { FINNOTECH_SCOPE, finnotechClientId } from "@/lib/finnotech/config";
import { redactSecrets } from "@/lib/finnotech/redact";

/**
 * Shahkar SMS send + verification, then civil-registry identification.
 * Only the kyc product is used, each call with its own granted scope:
 *   GET /kyc/v2/clients/{clientId}/shahkar/smsSend           kyc:sms-shahkar-send:get
 *   GET /kyc/v2/clients/{clientId}/shahkar/smsVerification   kyc:sms-shahkar-verification:get
 *   GET /kyc/v2/clients/{clientId}/identificationInquiry     kyc:identification-inquiry:get
 */

/** Older stored track ids may carry "facility"; new sends are always "kyc". */
export type ShahkarScope = "kyc" | "facility";

export type ShahkarSend =
  | { outcome: "otp_required"; trackId: string; scope: ShahkarScope }
  | { outcome: "mismatch"; trackId: string; scope: ShahkarScope }
  | { outcome: "matched_without_otp"; trackId: string; scope: ShahkarScope };

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

function interpretSend(trackId: string, scope: ShahkarScope, result: SendBody): ShahkarSend {
  if (result.isValid === false || result.smsSent === false) {
    return { outcome: "mismatch", trackId, scope };
  }
  if (result.smsSent === true) return { outcome: "otp_required", trackId, scope };
  if (result.isValid === true) return { outcome: "matched_without_otp", trackId, scope };
  throw new FinnotechError("send_unrecognized", 200);
}

function mismatchError(err: unknown) {
  return err instanceof FinnotechError && /mismatch|not_?match|shahkar_reject|nid_mobile/i.test(err.code);
}

/** Wrong URL/method or a missing route. A real OTP rejection uses another code. */
export function isShahkarConfigError(err: unknown): boolean {
  if (!(err instanceof FinnotechError)) return false;
  if (err.code === "token_rejected" || err.code === "no_scope") return true;
  if (err.httpStatus === 404) return true;
  if (err.httpStatus !== 400) return false;
  const blob = `${err.code}\n${err.providerMessage}\n${err.providerBody}`;
  return err.code === "VALIDATION_ERROR" || /FN-BRFH/i.test(blob);
}

function logShahkar(method: string, path: string, status: number, detail: string, secrets: string[]) {
  let safe = redactSecrets(detail);
  for (const secret of secrets) {
    if (secret.length >= 4) safe = safe.split(secret).join("[redacted]");
  }
  console.error("shahkar_sms", method, path, status, safe);
}

function errorDetail(err: unknown): { status: number; detail: string } {
  if (err instanceof FinnotechError) {
    return {
      status: err.httpStatus,
      detail: JSON.stringify({
        code: err.code,
        message: err.providerMessage,
        body: err.providerBody,
      }),
    };
  }
  return { status: 0, detail: err instanceof Error ? err.name : "error" };
}

export async function sendShahkarSms(mobile: string, nationalCode: string): Promise<ShahkarSend> {
  const secrets = [mobile, nationalCode];
  const path = `${clientPath("kyc")}/shahkar/smsSend`;
  try {
    const sent = await finnotechCall<SendBody>({
      method: "GET",
      path,
      scopes: FINNOTECH_SCOPE.shahkarSend,
      query: { mobile, nationalCode },
    });
    logShahkar(
      "GET",
      path,
      200,
      JSON.stringify({ smsSent: sent.result.smsSent ?? null, isValid: sent.result.isValid ?? null }),
      secrets
    );
    return interpretSend(sent.trackId, "kyc", sent.result);
  } catch (err) {
    const logged = errorDetail(err);
    logShahkar("GET", path, logged.status, logged.detail, secrets);
    if (mismatchError(err)) return { outcome: "mismatch", trackId: "", scope: "kyc" };
    throw err;
  }
}

export async function verifyShahkarSms(
  otp: string,
  inquiryTrackId: string,
  mobile: string,
  nationalCode: string
) {
  const secrets = [otp, inquiryTrackId, mobile, nationalCode];
  const path = `${clientPath("kyc")}/shahkar/smsVerification`;
  try {
    const verified = await finnotechCall<{ isValid?: boolean }>({
      method: "GET",
      path,
      scopes: FINNOTECH_SCOPE.shahkarVerify,
      query: { otp, inquiryTrackId, mobile, nationalCode },
    });
    logShahkar("GET", path, 200, JSON.stringify({ isValid: verified.result.isValid === true }), secrets);
    return { matched: verified.result.isValid === true, trackId: verified.trackId };
  } catch (err) {
    const logged = errorDetail(err);
    logShahkar("GET", path, logged.status, logged.detail, secrets);
    throw err;
  }
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
    scopes: FINNOTECH_SCOPE.identification,
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
