"use client";

import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { useState } from "react";

export default function WalletPage() {
  const store = useDemoStore();
  const [depositAmount, setDepositAmount] = useState(1_000_000);
  const [withdrawAmount, setWithdrawAmount] = useState(500_000);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="کیف پول" action={<SimulationBadge />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <AppCard>
          <p className="text-[12px] text-muted-app">قابل استفاده</p>
          <p className="mt-2 text-[22px] font-extrabold text-text">
            <AnimatedNumber value={store.rialAvailable} formatter={(n) => formatToman(Math.round(n))} />
          </p>
        </AppCard>
        <AppCard>
          <p className="text-[12px] text-muted-app">در انتظار تسویه</p>
          <p className="mt-2 text-[22px] font-extrabold text-warning">
            <AnimatedNumber value={store.rialPending} formatter={(n) => formatToman(Math.round(n))} />
          </p>
        </AppCard>
        <AppCard>
          <p className="text-[12px] text-muted-app">قابل برداشت</p>
          <p className="mt-2 text-[22px] font-extrabold text-text">
            <AnimatedNumber value={store.rialAvailable} formatter={(n) => formatToman(Math.round(n))} />
          </p>
        </AppCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AppCard>
          <h2 className="text-[15px] font-bold">واریز (سندباکس)</h2>
          <input
            dir="ltr"
            className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left tabular-nums outline-none focus:border-gold"
            value={depositAmount}
            onChange={(e) =>
              setDepositAmount(Number(e.target.value.replace(/\D/g, "") || 0))
            }
          />
          <GoldButton
            type="button"
            className="mt-4 w-full"
            onClick={() => {
              store.deposit(depositAmount);
              setMsg("واریز سندباکس انجام شد.");
              setErr("");
            }}
          >
            واریز
          </GoldButton>
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold">برداشت</h2>
          <input
            dir="ltr"
            className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left tabular-nums outline-none focus:border-gold"
            value={withdrawAmount}
            onChange={(e) =>
              setWithdrawAmount(Number(e.target.value.replace(/\D/g, "") || 0))
            }
          />
          <input
            dir="ltr"
            type="password"
            placeholder="پین"
            maxLength={6}
            className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-center tracking-widest outline-none focus:border-gold"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <GoldButton
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => {
              const bankId = store.bankAccounts[0]?.id;
              if (!bankId) {
                setErr("حساب بانکی ثبت نشده است.");
                return;
              }
              const res = store.withdraw(withdrawAmount, pin, bankId);
              if (!res.ok) {
                setErr(res.error ?? "خطا");
                setMsg("");
                return;
              }
              setMsg("درخواست برداشت ثبت شد.");
              setErr("");
            }}
          >
            درخواست برداشت
          </GoldButton>
        </AppCard>
      </div>

      {(msg || err) && (
        <p className={`text-[13px] ${err ? "text-negative" : "text-positive"}`}>
          {err || msg}
        </p>
      )}

      <AppCard>
        <h2 className="text-[15px] font-bold">حساب‌های بانکی</h2>
        <ul className="mt-3 space-y-2">
          {store.bankAccounts.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-3 text-[13px]"
            >
              <div>
                <p className="text-text">{b.bank}</p>
                <p dir="ltr" className="text-muted-app">
                  {b.iban}
                </p>
              </div>
              <StatusBadge status={b.verified ? "VERIFIED" : "UNVERIFIED"} />
            </li>
          ))}
        </ul>
      </AppCard>

      <AppCard padded={false}>
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-bold">تاریخچه کیف پول</h2>
        </div>
        <ul>
          {store.transactions
            .filter((t) => ["واریز", "برداشت", "خرید", "فروش"].includes(t.type))
            .slice(0, 8)
            .map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3 text-[13px] last:border-0"
              >
                <div>
                  <p className="text-text">{t.type}</p>
                  <p className="text-muted-app">{t.createdAt}</p>
                </div>
                <div className="text-left">
                  <p className="tabular-nums">{formatToman(t.amountRial)}</p>
                  <StatusBadge status={t.status} />
                </div>
              </li>
            ))}
        </ul>
      </AppCard>
    </div>
  );
}
