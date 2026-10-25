"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { useVerificationGate, VERIFICATION_STEPS } from "@/components/app/VerificationGate";
import { GoldButton } from "@/components/ui/GoldButton";
import { JalaliBirthDateField } from "@/components/kyc/JalaliBirthDateField";
import { formatMaskedPhone, useAuth } from "@/lib/auth/auth-context";
import { bankForCard, cardDigits, formatCardGroups, isLuhnValid } from "@/lib/kyc/card";
import { isValidIranianNationalCode, normalizeJalaliBirthDate } from "@/lib/kyc/national-id";
import { isAtLeast18Jalali } from "@/lib/kyc/age";
import { KYC_MESSAGES, kycOtpUiError, type KycErrorCode } from "@/lib/kyc/messages";
import { Check, CreditCard } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

const fieldClass =
  "h-12 w-full rounded-xl border border-black/10 bg-[#F6F4F1] px-4 text-[15px] text-text outline-none transition focus:border-[#FFB800] focus:bg-white";

type SavedCard = { id: string; panMasked: string; bankName: string };

function messageFor(code: string | undefined, fallback?: string) {
  if (fallback) return fallback;
  if (code && code in KYC_MESSAGES) return KYC_MESSAGES[code as KycErrorCode];
  return "احراز هویت انجام نشد. دوباره تلاش کنید.";
}

/** Only in-app paths, so ?return= cannot send the user off-site. */
function safeReturn(raw: string | null) {
  if (!raw || !raw.startsWith("/app/") || raw.startsWith("//")) return null;
  return raw;
}

function Stepper({ active, done }: { active: number; done: boolean[] }) {
  return (
    <ol className="flex items-start justify-between gap-2" aria-label="مراحل احراز هویت">
      {VERIFICATION_STEPS.map((step, index) => {
        const finished = done[index];
        const current = index === active;
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center text-center">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition ${
                finished
                  ? "bg-[#1F9D55] text-white"
                  : current
                    ? "bg-[#161616] text-white ring-4 ring-[#FFB800]/30"
                    : "border border-black/15 bg-white text-muted-app"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {finished ? <Check size={18} /> : index + 1}
            </span>
            <span className={`mt-2 text-[12px] ${current ? "font-bold text-text" : "text-muted-app"}`}>{step.title}</span>
          </li>
        );
      })}
    </ol>
  );
}

function KycFlow() {
  const { user, applyKycResult } = useAuth();
  const gate = useVerificationGate();
  const router = useRouter();
  const returnTo = safeReturn(useSearchParams().get("return"));
  const identity = gate.state?.identity ?? user?.kycStatus === "VERIFIED";
  const hasCard = gate.state?.card ?? false;
  const active = !identity ? 1 : !hasCard ? 2 : 3;

  const [nationalCode, setNationalCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [card, setCard] = useState("");
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!identity) return;
    void fetch("/api/kyc/bank", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; cards?: SavedCard[] }) => data.ok && setCards(data.cards ?? []))
      .catch(() => undefined);
  }, [identity, hasCard]);

  // Finished: go back to where the gate stopped the user.
  useEffect(() => {
    if (active !== 3 || !returnTo) return;
    const timer = setTimeout(() => router.replace(returnTo), 1200);
    return () => clearTimeout(timer);
  }, [active, returnTo, router]);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, string | boolean | undefined> & { card?: SavedCard };
    return { res, data };
  };

  const onStart = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!isValidIranianNationalCode(nationalCode)) return setError(KYC_MESSAGES.invalid_national_code);
    const birth = normalizeJalaliBirthDate(birthDate);
    if (!birth) return setError("روز، ماه و سال تولد را انتخاب کنید.");
    if (!isAtLeast18Jalali(birth)) return setError(KYC_MESSAGES.underage);
    setLoading(true);
    try {
      const { res, data } = await post("/api/kyc/shahkar", { nationalCode, birthDate: birth });
      if (!res.ok || !data.ok) return setError(messageFor(data.error as string, data.message as string));
      if (data.step === "verified") {
        applyKycResult({ kycStatus: "VERIFIED", firstName: data.firstName as string, lastName: data.lastName as string });
        await gate.refresh();
        return;
      }
      setOtpStep(true);
      setInfo("کد تأیید پیامک شد.");
    } catch {
      setError(KYC_MESSAGES.unavailable);
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { res, data } = await post("/api/kyc/shahkar/verify", { otp });
      if (!res.ok || !data.ok) return setError(kycOtpUiError(res.status, data as { error?: string; message?: string }));
      applyKycResult({ kycStatus: "VERIFIED", firstName: data.firstName as string, lastName: data.lastName as string });
      setOtp("");
      setOtpStep(false);
      setInfo("");
      await gate.refresh();
    } catch {
      setError(KYC_MESSAGES.unavailable);
    } finally {
      setLoading(false);
    }
  };

  const digits = cardDigits(card);
  const bank = bankForCard(digits);
  const cardComplete = digits.length === 16;
  const cardValid = cardComplete && isLuhnValid(digits);

  const onCard = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!cardValid) return setError(KYC_MESSAGES.invalid_card);
    setLoading(true);
    try {
      const { res, data } = await post("/api/kyc/bank", { card: digits });
      if (!res.ok || !data.ok) return setError(messageFor(data.error as string, data.message as string));
      setCard("");
      setInfo(`${data.card?.bankName ?? "کارت"} به نام شما ثبت شد.`);
      await gate.refresh();
    } catch {
      setError(KYC_MESSAGES.unavailable);
    } finally {
      setLoading(false);
    }
  };

  const errorLine = error ? (
    <p className="rounded-xl bg-[#FDECEC] px-3 py-2 text-[13px] leading-6 text-negative" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="احراز هویت" backHref={returnTo ?? "/app/profile"} />

      <AppCard>
        <Stepper active={Math.min(active, 2)} done={[true, identity, identity && hasCard]} />
      </AppCard>

      {active === 1 && !otpStep && (
        <AppCard>
          <form className="space-y-4" onSubmit={onStart}>
            <div>
              <h2 className="text-[16px] font-extrabold">اطلاعات هویتی</h2>
              <p className="mt-1 text-[12px] leading-6 text-muted-app">
                سیم‌کارت {user?.phone ? formatMaskedPhone(user.phone) : "این حساب"} باید به نام همین کد ملی باشد.
              </p>
            </div>
            <label className="block">
              <span className="mb-2 block text-[13px] text-text-secondary">کد ملی</span>
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                className={fieldClass}
                value={nationalCode}
                onChange={(event) => setNationalCode(event.target.value)}
                placeholder="۱۰ رقم"
              />
            </label>
            <JalaliBirthDateField value={birthDate} onChange={setBirthDate} />
            {errorLine}
            <GoldButton type="submit" variant="black" className="w-full" disabled={loading}>
              {loading ? "در حال استعلام…" : "ادامه"}
            </GoldButton>
          </form>
        </AppCard>
      )}

      {active === 1 && otpStep && (
        <AppCard>
          <form className="space-y-4" onSubmit={onVerify}>
            <div>
              <h2 className="text-[16px] font-extrabold">کد پیامک</h2>
              <p className="mt-1 text-[12px] leading-6 text-muted-app">{info || "کد ارسال‌شده را وارد کنید."}</p>
            </div>
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className={`${fieldClass} text-center tracking-[0.4em]`}
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="------"
            />
            {errorLine}
            <GoldButton type="submit" variant="black" className="w-full" disabled={loading || otp.length < 4}>
              {loading ? "در حال بررسی…" : "تأیید"}
            </GoldButton>
            <button type="button" className="w-full text-[13px] text-muted-app" onClick={() => { setOtpStep(false); setError(""); }}>
              اصلاح کد ملی یا تاریخ تولد
            </button>
          </form>
        </AppCard>
      )}

      {active === 2 && (
        <AppCard>
          <form className="space-y-4" onSubmit={onCard}>
            <div>
              <h2 className="text-[16px] font-extrabold">کارت بانکی</h2>
              <p className="mt-1 text-[12px] leading-6 text-muted-app">
                کارتی به نام خودتان. واریز و برداشت فقط با همین کارت انجام می‌شود.
              </p>
            </div>
            <div
              className="relative overflow-hidden rounded-2xl p-4 text-white shadow-[0_12px_30px_rgba(28,25,23,0.18)]"
              style={{ background: bank ? `linear-gradient(135deg, ${bank.color}, #161616)` : "linear-gradient(135deg, #3A3A3A, #161616)" }}
              data-testid="card-preview"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-bold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[12px]" aria-hidden>
                    {bank ? bank.name.replace(/^(بانک|مؤسسه)\s*/, "").slice(0, 1) : <CreditCard size={16} />}
                  </span>
                  {bank?.name ?? "بانک"}
                </span>
                <CreditCard size={20} className="opacity-70" />
              </div>
              <p className="mt-6 text-center font-mono text-[19px] tracking-[0.12em]" dir="ltr">
                {digits.padEnd(16, "•").replace(/(.{4})(?=.)/g, "$1 ")}
              </p>
            </div>
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="cc-number"
              aria-label="شماره کارت"
              className={`${fieldClass} text-center font-mono tracking-[0.08em]`}
              value={formatCardGroups(card)}
              onChange={(event) => {
                setError("");
                setCard(cardDigits(event.target.value));
              }}
              placeholder="---- ---- ---- ----"
            />
            {cardComplete && !cardValid ? (
              <p className="text-[12px] text-negative">{KYC_MESSAGES.invalid_card}</p>
            ) : null}
            {errorLine}
            <GoldButton type="submit" variant="black" className="w-full" disabled={loading || !cardValid}>
              {loading ? "در حال استعلام از بانک…" : "ثبت کارت"}
            </GoldButton>
          </form>
        </AppCard>
      )}

      {active === 3 && (
        <AppCard>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F6EE] text-[#1F9D55]">
              <Check size={28} />
            </div>
            <h2 className="mt-3 text-[17px] font-extrabold">احراز هویت کامل شد</h2>
            <p className="mt-1 text-[13px] text-muted-app">
              {returnTo ? "در حال بازگشت…" : "خرید، فروش، واریز و برداشت باز است."}
            </p>
          </div>
        </AppCard>
      )}

      {cards.length > 0 && (
        <AppCard>
          <h2 className="text-[14px] font-bold">کارت‌های شما</h2>
          <ul className="mt-3 space-y-2">
            {cards.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl bg-[#F6F4F1] px-3 py-2 text-[13px]">
                <span>{c.bankName}</span>
                <span dir="ltr" className="font-mono">{c.panMasked}</span>
              </li>
            ))}
          </ul>
        </AppCard>
      )}
    </div>
  );
}

export default function KycPage() {
  return (
    <Suspense>
      <KycFlow />
    </Suspense>
  );
}
