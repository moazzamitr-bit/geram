"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { useVerificationGate } from "@/components/app/VerificationGate";
import { GoldButton } from "@/components/ui/GoldButton";
import { apiJson, faDate, fieldClass, irrToTomanLabel, METAL_LABEL } from "@/lib/app/format";
import { CheckCircle2, Copy, Gift, Share2, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Overview = {
  code: string | null;
  referredByCode: string | null;
  canApply: boolean;
  sharePercent: number;
  verified: boolean;
  stats: { invited: number; verified: number; trading: number; totalRewardIrr: string };
  friends: Array<{ name: string; joinedAt: string; verified: boolean; trades: number; earnedIrr: string }>;
  rewards: Array<{ tradeId: string; asset: string; side: string; rewardIrr: string; createdAt: string; friend: string }>;
};

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function ReferralPage() {
  const gate = useVerificationGate();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiJson<Overview>("/api/referral");
    if (!res.ok) return setErr(res.message ?? "اطلاعات بارگذاری نشد.");
    setData(res);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const link = data?.code ? `https://geram.co/r/${data.code}` : "";
  const pct = data ? fa(Math.round(data.sharePercent * 100)) : "";

  async function copy() {
    if (!gate.guard() || !link) return;
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  async function share() {
    if (!gate.guard() || !link) return;
    const text = `با کد ${data?.code} در گرم ثبت‌نام کن و طلا، نقره و مس را از ۱۰ هزار تومان بخر.`;
    if (navigator.share) await navigator.share({ title: "دعوت به گرم", text, url: link }).catch(() => undefined);
    else await copy();
  }
  async function apply() {
    setBusy(true);
    setApplyMsg(null);
    const res = await apiJson<{ message: string }>("/api/referral/apply", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    setApplyMsg({ ok: res.ok, text: res.message ?? "خطا در ثبت کد" });
    if (res.ok) void load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <PageHeader title="معرفی دوستان" />
      {err && <p className="rounded-xl bg-rose-50 p-3 text-[13px] text-rose-700">{err}</p>}

      <AppCard className="overflow-hidden bg-gradient-to-b from-[#FFF6DD] to-white">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFB800]/20 text-[#B07A00]">
            <Gift size={24} />
          </span>
          <div>
            <h2 className="text-[17px] font-extrabold text-text">دوستانتان را دعوت کنید، {pct}٪ کارمزدشان مال شما</h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-app">
              از هر خرید و فروش دوستانتان، {pct}٪ کارمزد همان لحظه به کیف پول تومانی شما واریز می‌شود.
              از کارمزد دوستتان چیزی کم نمی‌شود.
            </p>
          </div>
        </div>

        {data && !data.verified ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
            <p className="flex items-center gap-2 font-bold">
              <ShieldCheck size={16} /> برای دریافت پاداش، احراز هویت کامل لازم است
            </p>
            <p className="mt-1">استعلام شاهکار و ثبت یک کارت بانکی به نام خودتان.</p>
            <GoldButton type="button" size="sm" className="mt-3" onClick={() => gate.guard()}>
              تکمیل احراز هویت
            </GoldButton>
          </div>
        ) : data?.code ? (
          <>
            <div className="mt-4 rounded-xl border border-dashed border-[#FFB800] bg-white p-3 text-center">
              <p className="text-[12px] text-muted-app">کد دعوت شما</p>
              <p dir="ltr" className="mt-1 font-mono text-[24px] font-extrabold tracking-[0.2em] text-text">
                {data.code}
              </p>
              <p dir="ltr" className="mt-1 truncate text-[12px] text-muted-app">{link}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <GoldButton type="button" onClick={share}>
                <Share2 size={16} /> ارسال لینک
              </GoldButton>
              <GoldButton type="button" variant="secondary" onClick={copy}>
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />} {copied ? "کپی شد" : "کپی لینک"}
              </GoldButton>
            </div>
          </>
        ) : null}
      </AppCard>

      {data && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "دعوت‌شده", value: fa(data.stats.invited) },
            { label: "احراز شده", value: fa(data.stats.verified) },
            { label: "معامله‌کرده", value: fa(data.stats.trading) },
          ].map((s) => (
            <AppCard key={s.label} className="p-3 text-center">
              <p className="text-[20px] font-extrabold text-text">{s.value}</p>
              <p className="mt-1 text-[12px] text-muted-app">{s.label}</p>
            </AppCard>
          ))}
          <AppCard className="col-span-3 flex items-center justify-between p-4">
            <span className="text-[13px] text-muted-app">مجموع پاداش دریافتی</span>
            <span className="text-[18px] font-extrabold text-emerald-700">{irrToTomanLabel(data.stats.totalRewardIrr)}</span>
          </AppCard>
        </div>
      )}

      <AppCard>
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-text">
          <Users size={18} /> دوستان من
        </h3>
        {!data || data.friends.length === 0 ? (
          <EmptyState title="هنوز دوستی دعوت نکرده‌اید" description="لینک دعوت را برای دوستانتان بفرستید." />
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {data.friends.map((f, i) => (
              <li key={i} className="flex items-center justify-between py-3 text-[13px]">
                <div>
                  <p className="font-bold text-text">{f.name}</p>
                  <p className="text-[12px] text-muted-app">
                    عضویت {faDate(f.joinedAt)} · {f.verified ? "احراز شده" : "در انتظار احراز"}
                  </p>
                </div>
                <span className="text-emerald-700">{irrToTomanLabel(f.earnedIrr)}</span>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      {data && data.rewards.length > 0 && (
        <AppCard>
          <h3 className="text-[15px] font-bold text-text">آخرین پاداش‌ها</h3>
          <ul className="mt-3 divide-y divide-black/5">
            {data.rewards.map((r) => (
              <li key={r.tradeId} className="flex items-center justify-between py-3 text-[13px]">
                <div>
                  <p className="text-text">
                    {r.side === "BUY" ? "خرید" : "فروش"} {METAL_LABEL[r.asset] ?? r.asset} توسط {r.friend}
                  </p>
                  <p className="text-[12px] text-muted-app">{faDate(r.createdAt, true)}</p>
                </div>
                <span className="font-bold text-emerald-700">+{irrToTomanLabel(r.rewardIrr)}</span>
              </li>
            ))}
          </ul>
        </AppCard>
      )}

      {data?.canApply && (
        <AppCard>
          <h3 className="text-[15px] font-bold text-text">کد دعوت دارید؟</h3>
          <p className="mt-1 text-[12px] text-muted-app">فقط پیش از اولین معامله قابل ثبت است.</p>
          <div className="mt-3 flex gap-2">
            <input
              dir="ltr"
              className={`${fieldClass} font-mono uppercase`}
              placeholder="ABC1234"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <GoldButton type="button" disabled={busy || code.length < 4} onClick={apply}>
              ثبت
            </GoldButton>
          </div>
          {applyMsg && (
            <p className={`mt-2 text-[13px] ${applyMsg.ok ? "text-emerald-700" : "text-rose-700"}`}>{applyMsg.text}</p>
          )}
        </AppCard>
      )}
      {data?.referredByCode && (
        <p className="text-center text-[12px] text-muted-app">
          شما با کد <span dir="ltr" className="font-mono">{data.referredByCode}</span> عضو شده‌اید.
        </p>
      )}
    </div>
  );
}
