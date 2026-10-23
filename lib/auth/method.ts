import { otpMode } from "@/lib/auth/otp";

/**
 * Password is the default. SMS OTP is offered only when Kavenegar is actually
 * configured. Sandbox's fixed demo code is not a production login method.
 */
export function publicAuthMethod(): "password" | "otp" {
  return otpMode() === "sms" ? "otp" : "password";
}
