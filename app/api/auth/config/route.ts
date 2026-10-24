import { NextResponse } from "next/server";
import { OTP_RESEND_SEC, otpCodeLength } from "@/lib/auth/otp";
import { authMethod, MIN_PASSWORD_LENGTH } from "@/lib/auth/method";

export const dynamic = "force-dynamic";

/** Tells the login page which sign-in flow is active. No secrets. */
export function GET() {
  return NextResponse.json(
    {
      ok: true,
      method: authMethod(),
      minPasswordLength: MIN_PASSWORD_LENGTH,
      otpCodeLength: otpCodeLength(),
      resendInSec: OTP_RESEND_SEC,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
