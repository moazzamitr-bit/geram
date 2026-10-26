"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAppData } from "@/lib/app/app-data";
import { KYC_MESSAGES } from "@/lib/kyc/messages";

type Card = ReturnType<typeof useAppData>["bankAccounts"][number];

const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
const last4 = (masked: string) => toLatin(masked).slice(-4);

async function postCard(card: string): Promise<{ ok: boolean; error?: string; ibanError?: string }> {
  const res = await fetch("/api/kyc/bank", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card }),
  }).catch(() => null);
  const data = (res ? await res.json().catch(() => null) : null) as
    | { ok?: boolean; error?: string; message?: string; card?: { ibanError?: string } }
    | null;
  if (data?.ok) return { ok: true, ibanError: data.card?.ibanError };
  const code = data?.error as keyof typeof KYC_MESSAGES | undefined;
  return { ok: false, error: (code && KYC_MESSAGES[code]) || data?.message || "ارتباط برقرار نشد. دوباره تلاش کنید." };
}

function CardNumberForm({ submitLabel, onSubmit, onCancel }: { submitLabel: string; onSubmit: (pan: string) => Promise<string | null>; onCancel: () => void }) {
  const [pan, setPan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const digits = toLatin(pan);
  return (
    <div className="mt-2 space-y-2">
      <input
        inputMode="numeric"
        dir="ltr"
        autoComplete="cc-number"
        aria-label="شماره کارت ۱۶ رقمی"
        placeholder="شماره کارت ۱۶ رقمی"
        value={pan}
        onChange={(e) => setPan(e.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-center font-mono tracking-widest text-text outline-none focus:border-gold"
      />
      {err ? <p className="text-[12px] text-negative">{err}</p> : null}
      <div className="flex gap-2">
        <GoldButton
          type="button"
          size="sm"
          className="flex-1"
          disabled={busy || digits.length !== 16}
          onClick={async () => {
            setBusy(true);
            setErr("");
            const e = await onSubmit(digits);
            setBusy(false);
            if (e) setErr(e);
          }}
        >
          {busy ? "در حال استعلام…" : submitLabel}
        </GoldButton>
        <GoldButton type="button" size="sm" variant="secondary" onClick={onCancel} disabled={busy}>
          انصراف
        </GoldButton>
      </div>
    </div>
  );
}

/**
 * Every verified card of the user. Withdraw mode needs an IBAN: cards without one stay visible as
 * pending with «دریافت شبا» (re-enter the card number only; ownership is not re-checked).
 */
export function BankCardPicker({
  mode,
  selectedId,
  onSelect,
  onMessage,
}: {
  mode: "withdraw" | "deposit" | "list";
  selectedId?: string;
  onSelect?: (id: string) => void;
  onMessage?: (msg: string) => void;
}) {
  const store = useAppData();
  const cards = store.bankAccounts.filter((b) => b.verified);
  const [ibanFor, setIbanFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selectable = (c: Card) => mode !== "list" && (mode === "deposit" || !!c.iban);

  return (
    <div className="space-y-2" role={mode === "list" ? undefined : "radiogroup"} aria-label={mode === "deposit" ? "کارت واریز" : "کارت مقصد"}>
      {cards.length === 0 ? (
        <p className="rounded-xl bg-white/[0.04] px-3 py-3 text-[13px] leading-6 text-muted-app">کارت تأییدشده‌ای ندارید.</p>
      ) : null}
      {cards.map((c) => {
        const isSel = selectable(c) && selectedId === c.id;
        return (
          <div key={c.id} className={`rounded-xl border px-3 py-2 text-[13px] ${isSel ? "border-gold bg-gold/5" : "border-white/10"}`}>
            <label className={`flex items-center justify-between gap-3 ${selectable(c) ? "cursor-pointer" : ""}`}>
              {selectable(c) ? (
                <input type="radio" name={`card-${mode}`} className="sr-only" checked={isSel} onChange={() => onSelect?.(c.id)} />
              ) : null}
              <span>
                <span className="block text-text">{c.bank}</span>
                {c.iban ? (
                  <span dir="ltr" className="block font-mono text-[11px] text-muted-app">{c.iban}</span>
                ) : (
                  <span className="block text-[11px] text-warning">شبا در انتظار دریافت</span>
                )}
              </span>
              <span dir="ltr" className="font-mono text-[11px] text-muted-app">{c.panMasked}</span>
            </label>
            {!c.iban && ibanFor !== c.id ? (
              <button type="button" className="mt-1 text-[12px] font-bold text-gold" onClick={() => { setIbanFor(c.id); setAdding(false); }}>
                دریافت شبا
              </button>
            ) : null}
            {ibanFor === c.id ? (
              <>
                <p className="mt-2 text-[11px] leading-5 text-muted-app">شماره همین کارت را دوباره وارد کنید تا شبای آن از بانک استعلام شود. شماره کارت ذخیره نمی‌شود.</p>
                <CardNumberForm
                  submitLabel="دریافت شبا"
                  onCancel={() => setIbanFor(null)}
                  onSubmit={async (pan) => {
                    if (pan.slice(-4) !== last4(c.panMasked)) return "این شماره با کارت انتخاب‌شده یکی نیست.";
                    const r = await postCard(pan);
                    if (!r.ok) return r.error ?? "خطا";
                    await store.refreshUserData();
                    setIbanFor(null);
                    onSelect?.(c.id);
                    onMessage?.("شبای کارت دریافت شد.");
                    return null;
                  }}
                />
              </>
            ) : null}
          </div>
        );
      })}
      {adding ? (
        <div className="rounded-xl border border-white/10 px-3 py-2">
          <p className="text-[12px] leading-6 text-muted-app">کارت باید به نام خودتان (همان کد ملی احراز شده) باشد؛ مالکیت از بانک استعلام می‌شود.</p>
          <CardNumberForm
            submitLabel="ثبت کارت"
            onCancel={() => setAdding(false)}
            onSubmit={async (pan) => {
              const r = await postCard(pan);
              if (!r.ok) return r.error ?? "خطا";
              await store.refreshUserData();
              setAdding(false);
              onMessage?.(r.ibanError ? "کارت ثبت شد؛ شبا هنوز دریافت نشده است." : "کارت ثبت شد.");
              return null;
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setAdding(true); setIbanFor(null); }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2.5 text-[13px] font-bold text-gold"
        >
          <Plus className="h-4 w-4" /> افزودن کارت جدید
        </button>
      )}
    </div>
  );
}
