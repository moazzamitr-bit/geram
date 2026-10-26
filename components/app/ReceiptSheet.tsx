"use client";

import { cn } from "@/lib/utils";
import { Check, Copy, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type ReceiptRow = { label: string; value: ReactNode; mono?: boolean; highlight?: boolean };
export type ReceiptAction = { label: string; href?: string; onClick?: () => void; primary?: boolean };

/** Shared success receipt: withdrawal, buy/sell, physical delivery. Bottom sheet on mobile, dialog on desktop. */
export function ReceiptSheet({
  open,
  title,
  subtitle,
  amount,
  amountUnit,
  amountCaption,
  header,
  rows,
  trackingCode,
  steps,
  activeStep = 0,
  reassurance,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  amount?: string;
  amountUnit?: string;
  amountCaption?: string;
  header?: ReactNode;
  rows: ReceiptRow[];
  trackingCode?: string;
  steps?: string[];
  activeStep?: number;
  reassurance?: string[];
  actions: ReceiptAction[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;

  const copy = async () => {
    if (!trackingCode) return;
    try {
      await navigator.clipboard.writeText(trackingCode);
    } catch {
      const t = document.createElement("textarea");
      t.value = trackingCode;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="receipt-title" dir="rtl">
      <button type="button" className="absolute inset-0 bg-[#1C1917]/45 backdrop-blur-[2px]" aria-label="بستن" onClick={onClose} />
      <div className="relative z-10 max-h-[94svh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#FBF8F2] shadow-[0_24px_60px_rgba(28,25,23,0.22)] animate-sheet-in sm:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-black/10 sm:hidden" />
        <div className="px-5 pb-5 pt-5 sm:px-6">
          <div className="receipt-check mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#1F9D55] text-white shadow-[0_8px_24px_rgba(31,157,85,0.35)]">
            <svg viewBox="0 0 52 52" className="h-10 w-10" aria-hidden>
              <path className="receipt-check-path" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17" />
            </svg>
          </div>
          <h2 id="receipt-title" className="mt-4 text-center text-[20px] font-extrabold text-text">{title}</h2>
          {subtitle ? <p className="mt-1 text-center text-[12.5px] leading-6 text-muted-app">{subtitle}</p> : null}
          {amount ? (
            <div className="mt-4 text-center">
              <p className="text-[34px] font-black leading-none tabular-nums text-text">
                {amount} {amountUnit ? <span className="text-[16px] font-bold text-muted-app">{amountUnit}</span> : null}
              </p>
              {amountCaption ? <p className="mt-2 text-[12px] text-muted-app">{amountCaption}</p> : null}
            </div>
          ) : null}

          <div className="relative mt-5 rounded-2xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            {header ? <div className="border-b border-dashed border-black/10 px-4 py-3.5">{header}</div> : null}
            <dl className="space-y-3 px-4 py-4 text-[13px]">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-muted-app">{r.label}</dt>
                  <dd className={cn("min-w-0 truncate text-left tabular-nums text-text", r.highlight && "font-bold text-[#8A6526]", r.mono && "font-mono text-[12px] tracking-wide")} dir={r.mono ? "ltr" : undefined}>
                    {r.value}
                  </dd>
                </div>
              ))}
              {trackingCode ? (
                <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
                  <dt className="text-muted-app">کد پیگیری</dt>
                  <dd>
                    <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-[#F4EFE4] px-2.5 py-1.5 font-mono text-[12.5px] font-bold tracking-wider text-text" aria-label="کپی کد پیگیری">
                      <span dir="ltr">{trackingCode}</span>
                      {copied ? <Check size={14} className="text-[#1F9D55]" /> : <Copy size={14} className="text-muted-app" />}
                    </button>
                    {copied ? <span className="mt-1 block text-left text-[11px] text-[#1F9D55]">کپی شد</span> : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          {steps && steps.length > 0 ? (
            <ol className="mt-4 flex items-start rounded-2xl bg-white px-3 py-3.5" aria-label="وضعیت درخواست">
              {steps.map((s, i) => {
                const done = i < activeStep;
                const cur = i === activeStep;
                return (
                  <li key={s} className="relative flex flex-1 flex-col items-center text-center">
                    {i > 0 ? <span className={cn("absolute top-3 h-0.5", i <= activeStep ? "bg-[#1F9D55]" : "bg-black/10")} style={{ left: "50%", width: "100%" }} aria-hidden /> : null}
                    <span className={cn("relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", done || cur ? "bg-[#1F9D55] text-white" : "bg-black/[0.07] text-muted-app", cur && "ring-4 ring-[#1F9D55]/15")}>
                      {done || cur ? <Check size={13} strokeWidth={3} /> : (i + 1).toLocaleString("fa-IR")}
                    </span>
                    <span className={cn("mt-1.5 text-[11.5px]", cur ? "font-bold text-text" : "text-muted-app")}>{s}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {reassurance && reassurance.length > 0 ? (
            <div className="mt-4 space-y-1.5 rounded-2xl border border-[#1F9D55]/15 bg-[#EEF8F2] px-4 py-3">
              {reassurance.map((t) => (
                <p key={t} className="flex items-start gap-2 text-[12.5px] leading-6 text-[#17643A]">
                  <ShieldCheck size={15} className="mt-1 shrink-0" /> {t}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2.5 pb-[env(safe-area-inset-bottom)]">
            {actions.map((a) => {
              const cls = cn(
                "flex h-12 items-center justify-center rounded-xl text-[15px] font-bold",
                a.primary ? "bg-gold-gradient text-[#0A0C0E]" : "border border-black/10 bg-white text-text"
              );
              return a.href ? (
                <Link key={a.label} href={a.href} className={cls} onClick={a.onClick}>{a.label}</Link>
              ) : (
                <button key={a.label} type="button" className={cls} onClick={a.onClick}>{a.label}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Colored initial badge standing in for a bank logo (no bank artwork shipped yet). */
export function BankBadge({ name }: { name: string }) {
  const short = name.replace(/^بانک\s*/, "").trim();
  const palette = ["#0F5E9C", "#1F9D55", "#8A6526", "#B4233C", "#5B3FA8", "#0E7C86"];
  let h = 0;
  for (const ch of short) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-black text-white" style={{ background: palette[h % palette.length] }} aria-hidden>
      {short.slice(0, 1) || "ب"}
    </span>
  );
}
