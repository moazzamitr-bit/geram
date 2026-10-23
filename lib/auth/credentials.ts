import { isIranMobile, normalizeIranMobile } from "@/lib/auth/phone";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export function validatePasswordLogin(phone: string, password: string) {
  const digits = normalizeIranMobile(phone);
  if (!isIranMobile(digits) || password.length < 1 || password.length > MAX_PASSWORD_LENGTH) {
    return "invalid_credentials" as const;
  }
  return null;
}

export function validateRegister(input: {
  phone: string;
  password: string;
  passwordConfirm?: string;
  firstName: string;
  lastName: string;
}) {
  const digits = normalizeIranMobile(input.phone);
  if (!isIranMobile(digits)) return "invalid_phone" as const;
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName || firstName.length > 40 || lastName.length > 40) {
    return "invalid_input" as const;
  }
  if (
    input.password.length < MIN_PASSWORD_LENGTH ||
    input.password.length > MAX_PASSWORD_LENGTH
  ) {
    return "invalid_input" as const;
  }
  if (input.passwordConfirm != null && input.passwordConfirm !== input.password) {
    return "invalid_input" as const;
  }
  return null;
}

export function validateAdminLogin(email: string, password: string) {
  const trimmed = email.trim();
  if (!trimmed.includes("@") || trimmed.length > 320 || !password || password.length > MAX_PASSWORD_LENGTH) {
    return "invalid_input" as const;
  }
  return null;
}
