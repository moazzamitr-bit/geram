"use client";

import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { AppCard } from "@/components/app/AppCard";
import { NoData } from "@/components/app/NoData";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { AmountField } from "@/components/ui/AmountField";
import { withdrawFee } from "@/lib/commerce/fees";
import { useVerificationGate } from "@/components/app/VerificationGate";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { useState } from "react";

export function WalletClient() {
  const store = useDemoStore();
  const gate = useVerificationGate();
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const wFee = withdrawFee(store.plusActive, store.commerceSettings.fees);
  const history = store.transactions
    .filter((t) => ["واریز", "برداشت", "خرید", "فروش"].includes(t.type))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="کیف پول" />

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
          <h2 className="text-[15px] font-bold">واریز</h2>
          <p className="mt-3 text-[13px] leading-7 text-muted-app">
            واریز شخصی در این نسخه خاموش است. موجودی کیف پول را ادمین از دفترکل شارژ می‌کند. درگاه بانکی فعال نیست.
          </p>
          <GoldButton
            type="button"
            variant="black"
            className="mt-4 w-full"
            onClick={() => {
              if (!gate.guard()) return;
              setErr("");
              setMsg("درگاه واریز هنوز فعال نیست. موجودی را پشتیبانی شارژ می‌کند.");
            }}
          >
            واریز
          </GoldButton>
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold">برداشت</h2>
          <AmountField
            aria-label="مبلغ برداشت به تومان"
            value={withdrawAmount}
            words
            onValueChange={setWithdrawAmount}
            className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left tabular-nums text-text outline-none focus:border-gold"
          />
          <p className="mt-2 text-[12px] text-muted-app">
            کارمزد برداشت: {formatToman(wFee)}
            {store.plusActive ? " (گرم پلاس: رایگان)" : ""}
          </p>
          <GoldButton
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => {
              if (!gate.guard()) return;
              void (async () => {
                const bankId = store.bankAccounts[0]?.id;
                if (!bankId) {
                  setErr("حساب بانکی ثبت نشده است.");
                  return;
                }
                const res = await store.withdraw(withdrawAmount, bankId);
                if (!res.ok) {
                  setErr(res.error ?? "خطا");
                  setMsg("");
                  return;
                }
                setMsg("درخواست برداشت ثبت شد.");
                setErr("");
              })();
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
        {store.bankAccounts.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted-app">حساب بانکی ثبت نشده است.</p>
        ) : (
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
        )}
      </AppCard>

      <AppCard padded={false}>
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-bold">تاریخچه کیف پول</h2>
        </div>
        {history.length === 0 ? (
          <NoData />
        ) : (
        <ul>
          {history.map((t) => (
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
        )}
      </AppCard>
    </div>
  );
}
