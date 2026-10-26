"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarketDrill({ active }: { active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const send = async (minutes: number) => {
    setBusy(true);
    await fetch("/api/admin/market", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ simulateTgjuDownMinutes: minutes }) }).catch(() => null);
    setBusy(false);
    router.refresh();
  };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => send(active ? 0 : 10)}
      className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-bold text-white/80 hover:border-gold hover:text-gold disabled:opacity-50"
    >
      {active ? "بازگرداندن TGJU" : "تمرین: قطع TGJU به مدت ۱۰ دقیقه"}
    </button>
  );
}
