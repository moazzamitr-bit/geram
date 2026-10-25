"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { Check, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type VerificationStep = "identity" | "card";

export type ClientVerification = {
  identity: boolean;
  card: boolean;
  nextStep: VerificationStep | null;
};

type GateValue = {
  /** null while loading or signed out. */
  state: ClientVerification | null;
  refresh: () => Promise<void>;
  /** True when verified. Otherwise opens the modal and returns false. */
  guard: () => boolean;
  /** Open the modal for a server `verification_required` answer. */
  openGate: (nextStep?: VerificationStep | null) => void;
};

const GateContext = createContext<GateValue | null>(null);

export const VERIFICATION_STEPS = [
  { key: "mobile", title: "شماره موبایل", hint: "تأیید شد" },
  { key: "identity", title: "اطلاعات هویتی", hint: "کد ملی و تاریخ تولد، استعلام شاهکار" },
  { key: "card", title: "کارت بانکی", hint: "یک کارت به نام خودتان" },
] as const;

export function kycHref(returnTo: string) {
  return `/app/profile/kyc?return=${encodeURIComponent(returnTo)}`;
}

/** Remaining steps for banner and modal copy. */
export function remainingSteps(state: ClientVerification | null) {
  if (!state) return [];
  return VERIFICATION_STEPS.filter(
    (s) => (s.key === "identity" && !state.identity) || (s.key === "card" && !state.card)
  );
}

export function VerificationGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<ClientVerification | null>(null);
  const [open, setOpen] = useState(false);
  const [forced, setForced] = useState<VerificationStep | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/kyc/status", { cache: "no-store" });
      const data = (await res.json()) as Partial<ClientVerification> & { ok?: boolean };
      if (!res.ok || !data.ok) return;
      setState({ identity: Boolean(data.identity), card: Boolean(data.card), nextStep: data.nextStep ?? null });
    } catch {
      /* the server gate still applies */
    }
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) void refresh();
  }, [userId, refresh]);

  const openGate = useCallback((nextStep?: VerificationStep | null) => {
    setForced(nextStep ?? null);
    setOpen(true);
  }, []);

  const guard = useCallback(() => {
    if (state && !state.nextStep) return true;
    openGate(state?.nextStep ?? "identity");
    return false;
  }, [state, openGate]);

  const value = useMemo(() => ({ state, refresh, guard, openGate }), [state, refresh, guard, openGate]);
  const shown = state ?? { identity: forced === "card", card: false, nextStep: forced ?? "identity" };

  return (
    <GateContext.Provider value={value}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="gate-title">
          <button type="button" className="absolute inset-0 bg-[#1C1917]/40" aria-label="بستن" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-black/[0.06] bg-[#FBF8F2] p-5 shadow-[0_24px_60px_rgba(28,25,23,0.18)] animate-sheet-in sm:rounded-3xl sm:p-6">
            <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="absolute left-4 top-4 text-muted-app">
              <X size={20} />
            </button>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4D6] text-[#8A6526]">
              <ShieldCheck size={28} />
            </div>
            <h2 id="gate-title" className="text-center text-[19px] font-extrabold text-text">
              اول احراز هویت را کامل کنید
            </h2>
            <p className="mt-2 text-center text-[13px] leading-6 text-muted-app">
              خرید، فروش، واریز و برداشت فقط با هویت تأییدشده و کارت بانکی به نام خودتان ممکن است.
            </p>
            <ol className="mt-4 space-y-2 rounded-2xl bg-white p-4 text-[13px]">
              {VERIFICATION_STEPS.map((step) => {
                const done =
                  step.key === "mobile" || (step.key === "identity" ? shown.identity : shown.card);
                return (
                  <li key={step.key} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        done ? "bg-[#1F9D55] text-white" : "border border-black/15 text-muted-app"
                      }`}
                    >
                      {done ? <Check size={14} /> : VERIFICATION_STEPS.indexOf(step) + 1}
                    </span>
                    <span className={done ? "text-muted-app line-through" : "font-bold text-text"}>{step.title}</span>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              className="mt-5 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[#161616] text-[15px] font-bold text-white"
              onClick={() => {
                setOpen(false);
                router.push(kycHref(`${window.location.pathname}${window.location.search}`));
              }}
            >
              ادامه احراز هویت
            </button>
          </div>
        </div>
      ) : null}
    </GateContext.Provider>
  );
}

export function useVerificationGate(): GateValue {
  const value = useContext(GateContext);
  if (!value) throw new Error("useVerificationGate outside VerificationGateProvider");
  return value;
}

/** Server answers arrive as "verification_required <message>" from coreFetch. */
export function isVerificationRequired(error: string | undefined | null) {
  return Boolean(error && error.startsWith("verification_required"));
}
