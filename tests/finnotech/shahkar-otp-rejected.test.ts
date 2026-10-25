import { describe, expect, it } from "vitest";
import { FinnotechError } from "@/lib/finnotech/client";
import { isShahkarConfigError, isShahkarOtpRejected } from "@/lib/finnotech/kyc";

describe("shahkar wrong OTP", () => {
  const body = JSON.stringify({
    status: "FAILED",
    error: { code: "FN-KCFH-40004540927", message: "کد یکبار مصرف نامعتبر است" },
  });
  const err = new FinnotechError("ERR_BAD_REQUEST", 400, "کد یکبار مصرف نامعتبر است", body);

  it("is an OTP rejection, not a configuration error", () => {
    expect(isShahkarOtpRejected(err)).toBe(true);
    expect(isShahkarConfigError(err)).toBe(false);
  });

  it("matches the FN code alone", () => {
    expect(isShahkarOtpRejected(new FinnotechError("FN-KCFH-40004540927", 400, "", ""))).toBe(true);
  });

  it("leaves VALIDATION_ERROR as configuration", () => {
    const config = new FinnotechError("VALIDATION_ERROR", 400, "bad", "{}");
    expect(isShahkarOtpRejected(config)).toBe(false);
    expect(isShahkarConfigError(config)).toBe(true);
  });
});
