import { finnotechCall, FinnotechError } from "@/lib/finnotech/client";
import { finnotechClientId } from "@/lib/finnotech/config";
import { redactSecrets } from "@/lib/finnotech/redact";

/**
 * Shahkar SMS send + verification, then civil-registry identification.
 *
 * Public OpenAPI (docs.finnotech.ir/openapi-public.json):
 *   GET /facility/v2/clients/{clientId}/shahkar/smsSend
 *     operation facilityShahkarSmsSendGet
 *     query: trackId, mobile, nationalCode, optional version=2
 *     scope facility:sms-shahkar-send:get
 *   GET /facility/v2/clients/{clientId}/shahkar/verify
 *     operation facilityShahkarVerifyGet
 *     query: mobile, nationalCode only — no otp. This is a direct match,
 *     not proof the user received the SMS, so it is never used as verify.
 * SMS OTP verification itself is not in that public document. Production
 *   GET /kyc/v2/clients/{clientId}/shahkar/smsVerification
 * returns 400 VALIDATION_ERROR (FN-BRFH-…) "invalid request, Please check
 * service url and http method". Those 400s and 404s try the next candidate.
 * Verify is ordered to the scope whose smsSend succeeded: smsVerification,
 * then POST {otp,inquiryTrackId,mobile,nationalCode}, then the smsVerify
 * alias, on both kyc and facility. Facility calls send version=2.
 */

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
  const attempts: { scope: ShahkarScope; query: Record<string, string | number> }[] = [
    { scope: "kyc", query: { mobile, nationalCode } },
    { scope: "facility", query: { mobile, nationalCode, version: 2 } },
  ];
  let last: unknown;
  for (const attempt of attempts) {
    const path = `${clientPath(attempt.scope)}/shahkar/smsSend`;
    try {
      const sent = await finnotechCall<SendBody>({
        method: "GET",
        path,
        query: attempt.query,
      });
      logShahkar(
        "GET",
        path,
        200,
        JSON.stringify({ smsSent: sent.result.smsSent ?? null, isValid: sent.result.isValid ?? null }),
        secrets
      );
      return interpretSend(sent.trackId, attempt.scope, sent.result);
    } catch (err) {
      const logged = errorDetail(err);
      logShahkar("GET", path, logged.status, logged.detail, secrets);
      if (mismatchError(err)) return { outcome: "mismatch", trackId: "", scope: attempt.scope };
      last = err;
      if (!isShahkarConfigError(err)) throw err;
    }
  }
  throw last instanceof Error ? last : new FinnotechError("send_missing", 404);
}

type VerifyAttempt = {
  scope: ShahkarScope;
  method: "GET" | "POST";
  alias: "smsVerification" | "smsVerify";
};

function verifyAttempts(preferred?: ShahkarScope): VerifyAttempt[] {
  const scopes: ShahkarScope[] = preferred === "facility" ? ["facility", "kyc"] : ["kyc", "facility"];
  const attempts: VerifyAttempt[] = [];
  for (const scope of scopes) {
    attempts.push({ scope, method: "GET", alias: "smsVerification" });
    attempts.push({ scope, method: "POST", alias: "smsVerification" });
    attempts.push({ scope, method: "GET", alias: "smsVerify" });
    attempts.push({ scope, method: "POST", alias: "smsVerify" });
  }
  return attempts;
}

export async function verifyShahkarSms(
  otp: string,
  inquiryTrackId: string,
  mobile: string,
  nationalCode: string,
  scope?: ShahkarScope
) {
  const secrets = [otp, inquiryTrackId, mobile, nationalCode];
  const subject = { otp, inquiryTrackId, mobile, nationalCode };
  let last: unknown;
  for (const attempt of verifyAttempts(scope)) {
    const path = `${clientPath(attempt.scope)}/shahkar/${attempt.alias}`;
    const version = attempt.scope === "facility" ? { version: 2 as const } : {};
    try {
      const verified = await finnotechCall<{ isValid?: boolean }>({
        method: attempt.method,
        path,
        query: attempt.method === "GET" ? { ...subject, ...version } : version,
        body: attempt.method === "POST" ? subject : undefined,
      });
      logShahkar(
        attempt.method,
        path,
        200,
        JSON.stringify({ isValid: verified.result.isValid === true }),
        secrets
      );
      return { matched: verified.result.isValid === true, trackId: verified.trackId };
    } catch (err) {
      const logged = errorDetail(err);
      logShahkar(attempt.method, path, logged.status, logged.detail, secrets);
      last = err;
      if (!isShahkarConfigError(err)) throw err;
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
