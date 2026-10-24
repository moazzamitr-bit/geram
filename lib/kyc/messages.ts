export const KYC_MESSAGES = {
  invalid_national_code: "کد ملی معتبر نیست. ده رقم را دوباره بررسی کنید.",
  invalid_birth_date: "تاریخ تولد شمسی را وارد کنید، مثل ۱۳۷۰/۰۶/۱۵.",
  mismatch: "شماره موبایل این حساب با کد ملی واردشده یکسان نیست.",
  invalid_otp: "کد وارد شده اشتباه یا منقضی شده است",
  invalid_input: "اطلاعات کد ملی یا موبایل برای شاهکار پذیرفته نشد.",
  expired: "مهلت این درخواست تمام شده. کد ملی را دوباره بفرستید.",
  too_many: "تعداد تلاش برای رمز زیاد است. چند دقیقه بعد دوباره درخواست دهید.",
  rate_limited: "تعداد درخواست زیاد است. کمی بعد دوباره تلاش کنید.",
  cooldown: "پیامک شاهکار تازه ارسال شده. یک دقیقه صبر کنید و سپس رمز را وارد کنید.",
  deceased: "استعلام ثبت احوال این کد ملی را در قید حیات نشان نداد.",
  inquiry_failed: "استعلام نام از ثبت احوال انجام نشد. کمی بعد دوباره تلاش کنید.",
  not_configured: "احراز هویت هنوز به سرویس فینوتک وصل نشده است.",
  no_phone: "شماره موبایل روی این حساب ثبت نشده است.",
  already_verified: "هویت این حساب قبلاً تأیید شده است.",
  unavailable: "سرویس احراز هویت موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.",
  duplicate_national_code: "این کد ملی قبلاً برای حساب دیگری ثبت شده است.",
  provider: "سرویس احراز هویت پاسخ نداد. کمی بعد دوباره تلاش کنید.",
  underage: "افتتاح حساب از ۱۸ سال تمام امکان‌پذیر است.",
  identity_required: "اول کد ملی و تاریخ تولد را تأیید کنید، بعد حساب بانکی.",
  invalid_card: "شماره کارت ۱۶ رقمی معتبر نیست.",
  invalid_iban: "شماره شبا معتبر نیست. با IR و ۲۴ رقم وارد کنید.",
  bank_required: "شماره کارت یا شبا را وارد کنید.",
  bank_mismatch: "این کارت یا شبا به نام صاحب کد ملی حساب نیست.",
} as const;

export type KycErrorCode = keyof typeof KYC_MESSAGES;

/**
 * OTP step copy. HTTP 400 is a wrong, expired, or invalid code (the server
 * message when it is a validation reason). 5xx is an outage.
 */
export function kycOtpUiError(status: number, data: { error?: string; message?: string } | null): string {
  if (data?.error === "not_configured") return KYC_MESSAGES.not_configured;
  if (status >= 500) return KYC_MESSAGES.unavailable;
  if (status === 400) return data?.message?.trim() || KYC_MESSAGES.invalid_otp;
  if (data?.message?.trim()) return data.message.trim();
  if (data?.error && data.error in KYC_MESSAGES) return KYC_MESSAGES[data.error as KycErrorCode];
  return KYC_MESSAGES.unavailable;
}

export const TRADE_KYC_REQUIRED_MESSAGE =
  "برای خرید و فروش باید احراز هویت شما تأیید شده باشد.";
