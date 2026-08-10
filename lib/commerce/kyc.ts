import type { KycStatus } from "@/lib/auth/auth-context";

export function isKycVerified(status: KycStatus | string) {
  return status === "VERIFIED";
}

export const KYC_REQUIRED_MESSAGE =
  "برای این عملیات باید احراز هویت شما تأیید شده باشد.";
