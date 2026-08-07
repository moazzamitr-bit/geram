"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const goal = store.goals.find((g) => g.id === id);
  const [amount, setAmount] = useState(1_000_000);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (!goal) {
    return <PageHeader title="هدف یافت نشد" backHref="/app/goals" />;
  }

  const pct = Math.min(100, Math.round((goal.currentRial / goal.targetRial) * 100));
  const remaining = Math.max(0, goal.targetRial - goal.currentRial);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title={goal.name} backHref="/app/goals" action={<SimulationBadge />} />
      <AppCard>
        <p className="text-[36px] font-extrabold text-gold">{pct.toLocaleString("fa-IR")}٪</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-5 space-y-3 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted-app">پس‌انداز شده</dt>
            <dd>{formatToman(goal.currentRial)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">باقی‌مانده</dt>
            <dd>{formatToman(remaining)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">پیشنهاد ماهانه</dt>
            <dd>{formatToman(goal.monthlyRial)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">بازه</dt>
            <dd>{goal.targetDate}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13px] leading-7 text-muted-app">
          برای رسیدن به هدف تا {goal.targetDate}، ماهانه حدود {formatToman(goal.monthlyRial)}{" "}
          پس‌انداز کنید.
        </p>
      </AppCard>

      <AppCard>
        <h2 className="text-[15px] font-bold">واریز به هدف (از کیف پول)</h2>
        <input
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "") || 0))}
          className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left outline-none focus:border-gold"
        />
        <GoldButton
          type="button"
          className="mt-4 w-full"
          onClick={() => {
            const res = store.contributeGoal(goal.id, amount);
            if (!res.ok) {
              setErr(res.error ?? "خطا");
              setMsg("");
              return;
            }
            setMsg("به هدف اضافه شد.");
            setErr("");
          }}
        >
          واریز به هدف
        </GoldButton>
        {(msg || err) && (
          <p className={`mt-2 text-[13px] ${err ? "text-negative" : "text-positive"}`}>
            {err || msg}
          </p>
        )}
      </AppCard>
    </div>
  );
}
