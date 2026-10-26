/** Pure rules for a toman withdrawal request (no I/O, unit-tested). */

export const MIN_WITHDRAW_TOMAN = 10_000;

export type WithdrawCard = {
  id: string;
  status: string;
  iban: string | null;
  ibanDepositStatus: string | null;
};

export type WithdrawCheck =
  | { ok: true; amountIrr: bigint; feeIrr: bigint; totalIrr: bigint }
  | { ok: false; code: string; message: string; status: number };

const fa = (n: number) => n.toLocaleString("fa-IR");

export function checkWithdrawal(input: {
  amountToman: number;
  feeToman: number;
  card: WithdrawCard | null;
  dailyCapToman: number;
  usedTodayToman: number;
}): WithdrawCheck {
  const amount = input.amountToman;
  if (!Number.isSafeInteger(amount) || amount < MIN_WITHDRAW_TOMAN) {
    return { ok: false, code: "invalid_amount", message: `حداقل برداشت ${fa(MIN_WITHDRAW_TOMAN)} تومان است.`, status: 400 };
  }
  const card = input.card;
  if (!card || card.status !== "VERIFIED") {
    return { ok: false, code: "invalid_card", message: "یکی از کارت‌های تأییدشده خودتان را انتخاب کنید.", status: 400 };
  }
  if (!card.iban || !/^IR\d{24}$/.test(card.iban)) {
    return {
      ok: false,
      code: "no_iban",
      message: "شبای این کارت هنوز دریافت نشده. کارت را در صفحه احراز هویت دوباره وارد کنید.",
      status: 409,
    };
  }
  if (card.ibanDepositStatus && !["02", "03"].includes(card.ibanDepositStatus)) {
    return { ok: false, code: "iban_inactive", message: "حساب این کارت فعال نیست.", status: 409 };
  }
  if (input.dailyCapToman <= 0) {
    return { ok: false, code: "withdraw_locked", message: "برداشت برای سطح احراز هویت شما فعال نیست.", status: 403 };
  }
  if (input.usedTodayToman + amount > input.dailyCapToman) {
    const left = Math.max(0, input.dailyCapToman - input.usedTodayToman);
    return {
      ok: false,
      code: "daily_limit",
      message: `سقف برداشت روزانه ${fa(input.dailyCapToman)} تومان است؛ باقی‌مانده امروز ${fa(left)} تومان.`,
      status: 409,
    };
  }
  const fee = Math.max(0, Math.floor(input.feeToman));
  const amountIrr = BigInt(amount) * 10n;
  const feeIrr = BigInt(fee) * 10n;
  return { ok: true, amountIrr, feeIrr, totalIrr: amountIrr + feeIrr };
}

/** Paya / Satna / internal transfer reference the admin enters when marking paid. */
export function validPayoutRef(ref: string | undefined | null): string | null {
  const v = (ref ?? "").trim();
  return /^[A-Za-z0-9-]{6,40}$/.test(v) ? v : null;
}

export type WithdrawStatus = "PENDING" | "PAID" | "REJECTED" | "CANCELLED";

export const WITHDRAW_NEXT: Record<"pay" | "reject" | "cancel", { from: WithdrawStatus[]; to: WithdrawStatus }> = {
  pay: { from: ["PENDING"], to: "PAID" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  cancel: { from: ["PENDING"], to: "CANCELLED" },
};
