"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { useVerificationGate, type VerificationStep } from "@/components/app/VerificationGate";
import { AmountField } from "@/components/ui/AmountField";
import { GoldButton } from "@/components/ui/GoldButton";
import { apiJson, faDate, fieldClass, irrToTomanLabel, METAL_LABEL, ugLabel } from "@/lib/app/format";
import { cn } from "@/lib/utils";
import { CalendarClock, CheckCircle2, PauseCircle, PiggyBank, PlayCircle, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Cadence = "DAILY" | "WEEKLY" | "MONTHLY";
type Plan = {
  id: string;
  asset: "GOLD" | "SILVER" | "COPPER";
  amountToman: number;
  cadence: Cadence;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  nextRunAt: string;
  lastRunAt: string | null;
  failStreak: number;
};
type Run = {
  id: string;
  planId: string;
  runFor: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  amountIrr: string | null;
  weightUg: string | null;
  error: string | null;
  asset: Plan["asset"] | null;
  cadence: Cadence | null;
};
type Overview = { plans: Plan[]; runs: Run[]; limits: { minToman: number; maxToman: number; maxActive: number } };

const CADENCES: { id: Cadence; label: string; hint: string }[] = [
  { id: "DAILY", label: "روزانه", hint: "هر روز" },
  { id: "WEEKLY", label: "هفتگی", hint: "هر ۷ روز" },
  { id: "MONTHLY", label: "ماهانه", hint: "هر ماه" },
];
const CAD_LABEL: Record<Cadence, string> = { DAILY: "روزانه", WEEKLY: "هفتگی", MONTHLY: "ماهانه" };
const ASSETS = ["GOLD", "SILVER", "COPPER"] as const;
const fa = (n: number) => n.toLocaleString("fa-IR");

export default function SavingsPage() {
  const gate = useVerificationGate();
  const [data, setData] = useState<Overview | null>(null);
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("GOLD");
  const [cadence, setCadence] = useState<Cadence>("WEEKLY");
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await apiJson<Overview>("/api/savings");
    if (res.ok) setData(res);
    else setMsg({ ok: false, text: res.message ?? "اطلاعات بارگذاری نشد." });
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const min = data?.limits.minToman ?? 100_000;
  const active = data?.plans.filter((p) => p.status === "ACTIVE").length ?? 0;

  async function create() {
    if (!gate.guard()) return;
    setBusy(true);
    setMsg(null);
    const res = await apiJson<{ message: string }>("/api/savings", {
      method: "POST",
      body: JSON.stringify({ asset, cadence, amountToman: amount }),
    });
    setBusy(false);
    if (res.error === "verification_required") gate.openGate(res.nextStep as VerificationStep);
    setMsg({ ok: res.ok, text: res.message ?? "ساخت طرح انجام نشد." });
    if (res.ok) {
      setAmount(0);
      void load();
    }
  }

  async function act(id: string, action: "pause" | "resume" | "cancel") {
    if (action === "resume" && !gate.guard()) return;
    if (action === "cancel" && !window.confirm("این طرح لغو شود؟")) return;
    const res = await apiJson<{ message: string }>(`/api/savings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    setMsg({ ok: res.ok, text: res.message ?? "انجام نشد." });
    void load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <PageHeader title="طرح پس‌انداز" />

      <AppCard className="bg-gradient-to-b from-[#FFF6DD] to-white">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFB800]/20 text-[#B07A00]">
            <PiggyBank size={24} />
          </span>
          <div>
            <h2 className="text-[17px] font-extrabold text-text">کم‌کم طلا جمع کنید</h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-app">
              مبلغ و دوره را انتخاب کنید؛ هر نوبت ساعت ۱۰ صبح با قیمت لحظه‌ای و کارمزد عادی شما از موجودی کیف پول خرید
              می‌شود. هر وقت خواستید متوقف یا لغو کنید.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/[0.04] p-1">
            {ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                className={cn("h-9 rounded-lg text-[13px]", asset === a ? "bg-white font-bold shadow-sm" : "text-muted-app")}
              >
                {METAL_LABEL[a]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CADENCES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCadence(c.id)}
                className={cn(
                  "rounded-xl border p-2 text-center",
                  cadence === c.id ? "border-[#FFB800] bg-[#FFB800]/15" : "border-black/10 bg-white"
                )}
              >
                <p className="text-[14px] font-bold text-text">{c.label}</p>
                <p className="text-[11px] text-muted-app">{c.hint}</p>
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-app">مبلغ هر خرید (تومان)</span>
            <AmountField value={amount} onValueChange={setAmount} words className={fieldClass} />
          </label>
          <p className="text-[12px] text-muted-app">
            حداقل {fa(min)} تومان · حداکثر {fa(data?.limits.maxActive ?? 0)} طرح فعال ({fa(active)} فعال دارید)
          </p>
          <GoldButton type="button" className="w-full" disabled={busy || amount < min} onClick={create}>
            {busy ? "در حال ساخت…" : "ساخت طرح پس‌انداز"}
          </GoldButton>
          {msg && (
            <p
              role="status"
              className={cn(
                "flex items-start gap-2 rounded-xl p-3 text-[13px]",
                msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
              )}
            >
              {msg.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
              {msg.text}
            </p>
          )}
        </div>
      </AppCard>

      <AppCard>
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-text">
          <CalendarClock size={18} /> طرح‌های من
        </h3>
        {!data || data.plans.length === 0 ? (
          <EmptyState title="هنوز طرحی ندارید" description="اولین طرح پس‌انداز را بسازید." />
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {data.plans.map((p) => (
              <li key={p.id} className="py-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-text">
                    {METAL_LABEL[p.asset]} {CAD_LABEL[p.cadence]} · {fa(p.amountToman)} تومان
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px]",
                      p.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {p.status === "ACTIVE" ? "فعال" : "متوقف"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted-app">
                  {p.status === "ACTIVE" ? `خرید بعدی: ${faDate(p.nextRunAt, true)}` : "تا فعال‌سازی دوباره خریدی انجام نمی‌شود."}
                  {p.failStreak > 0 && ` · ${fa(p.failStreak)} نوبت ناموفق اخیر`}
                </p>
                <div className="mt-2 flex gap-2">
                  {p.status === "ACTIVE" ? (
                    <GoldButton type="button" size="sm" variant="secondary" onClick={() => act(p.id, "pause")}>
                      <PauseCircle size={14} /> توقف
                    </GoldButton>
                  ) : (
                    <GoldButton type="button" size="sm" variant="secondary" onClick={() => act(p.id, "resume")}>
                      <PlayCircle size={14} /> فعال‌سازی
                    </GoldButton>
                  )}
                  <GoldButton type="button" size="sm" variant="secondary" onClick={() => act(p.id, "cancel")}>
                    <XCircle size={14} /> لغو
                  </GoldButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      {data && data.runs.length > 0 && (
        <AppCard>
          <h3 className="text-[15px] font-bold text-text">سابقه خریدها</h3>
          <ul className="mt-3 divide-y divide-black/5">
            {data.runs.map((r) => {
              return (
                <li key={r.id} className="flex items-center justify-between py-3 text-[13px]">
                  <div>
                    <p className="text-text">
                      {r.asset && r.cadence ? `${METAL_LABEL[r.asset]} ${CAD_LABEL[r.cadence]}` : "طرح پس‌انداز"}
                    </p>
                    <p className="text-[12px] text-muted-app">{faDate(r.runFor, true)}</p>
                  </div>
                  {r.status === "SUCCESS" ? (
                    <div className="text-left">
                      <p className="font-bold text-emerald-700">{ugLabel(r.weightUg ?? 0)}</p>
                      <p className="text-[11px] text-muted-app">{irrToTomanLabel(r.amountIrr ?? 0)}</p>
                    </div>
                  ) : r.status === "FAILED" ? (
                    <span className="max-w-[55%] text-left text-[12px] text-rose-700">{r.error}</span>
                  ) : (
                    <span className="text-[12px] text-muted-app">در حال انجام</span>
                  )}
                </li>
              );
            })}
          </ul>
        </AppCard>
      )}
    </div>
  );
}
