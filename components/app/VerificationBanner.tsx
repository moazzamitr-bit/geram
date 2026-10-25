"use client";

import { kycHref, remainingSteps, useVerificationGate } from "@/components/app/VerificationGate";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

/** Dashboard nudge listing what is left before trading is open. */
export function VerificationBanner() {
  const { state } = useVerificationGate();
  const left = remainingSteps(state);
  if (!state || left.length === 0) return null;
  return (
    <Link
      href={kycHref("/app/dashboard")}
      className="flex items-center gap-3 rounded-2xl border border-[#E8D9B0] bg-[#FFF8E6] p-4 text-text"
    >
      <ShieldAlert className="shrink-0 text-[#8A6526]" size={24} />
      <span className="flex-1">
        <span className="block text-[14px] font-extrabold">احراز هویت شما کامل نیست</span>
        <span className="mt-1 block text-[12px] leading-6 text-text-secondary">
          مانده: {left.map((s) => s.title).join(" و ")}. بعد از آن خرید، فروش و واریز باز می‌شود.
        </span>
      </span>
      <span className="shrink-0 rounded-xl bg-[#161616] px-3 py-2 text-[12px] font-bold text-white">ادامه</span>
    </Link>
  );
}
