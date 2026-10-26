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
import { useAppData } from "@/lib/app/app-data";
import { formatToman } from "@/lib/utils";
import { BankCardPicker } from "@/components/app/BankCardPicker";
import { BankBadge, ReceiptSheet } from "@/components/app/ReceiptSheet";
import { formatTehranJalaliDateTime } from "@/lib/format/datetime";
import type { WithdrawalReceipt } from "@/lib/app/app-data";
import { useCallback, useEffect, useState } from "react";

type PayoutRequest = {
  id: string;
  bank_name: string;
  iban: string;
  amount_irr: string;
  fee_irr: string;
  status: "PENDING" | "PAID" | "REJECTED" | "CANCELLED";
  payout_ref: string | null;
  admin_note: string | null;
  tracking_code: string;
  created_at: string;
};

const REQ_STATUS: Record<PayoutRequest["status"], string> = {
  PENDING: "در انتظار تسویه",
  PAID: "تکمیل‌شده",
  REJECTED: "ناموفق",
  CANCELLED: "لغو شده",
};

export function WalletClient() {
  const store = useAppData();
  const gate = useVerificationGate();
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [cardId, setCardId] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ req: WithdrawalReceipt; panMasked: string } | null>(null);
  const [info, setInfo] = useState<{ enabled: boolean; dailyCapToman: number; usedTodayToman: number; minToman: number; requests: PayoutRequest[] } | null>(null);

  const payoutCards = store.bankAccounts.filter((b) => b.verified && b.iban);
  const selected = payoutCards.find((b) => b.id === cardId) ?? payoutCards[0];
  const depositCards = store.bankAccounts.filter((b) => b.verified);
  const depositSel = depositCards.find((b) => b.depositDefault) ?? depositCards[0];
  const pickDeposit = async (id: string) => {
    const res = await fetch("/api/me/bank-accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ depositCardId: id }),
    }).catch(() => null);
    if (res?.ok) {
      await store.refreshUserData();
      setErr("");
      setMsg("کارت واریز انتخاب شد.");
    } else setErr("انتخاب کارت واریز انجام نشد.");
  };

  const loadInfo = useCallback(async () => {
    const res = await fetch("/api/withdrawals", { cache: "no-store" }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (data?.ok) setInfo(data);
  }, []);
  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

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
            درگاه بانکی هنوز فعال نیست. واریز فقط از کارت‌های تأییدشده خودتان پذیرفته می‌شود؛ کارت واریز را از الان انتخاب کنید.
          </p>
          <div className="mt-3">
            <BankCardPicker mode="deposit" selectedId={depositSel?.id} onSelect={(id) => void pickDeposit(id)} onMessage={(m) => { setErr(""); setMsg(m); }} />
          </div>
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
          <h2 className="text-[15px] font-bold">برداشت تومانی</h2>
          <p className="mt-1 text-[12px] leading-6 text-muted-app">
            فقط به شبای کارت‌های تأییدشده خودتان واریز می‌شود.
          </p>
          <div className="mt-3">
            <BankCardPicker mode="withdraw" selectedId={selected?.id} onSelect={setCardId} onMessage={(m) => { setErr(""); setMsg(m); }} />
          </div>
          <AmountField
            aria-label="مبلغ برداشت به تومان"
            value={withdrawAmount}
            words
            onValueChange={setWithdrawAmount}
            className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left tabular-nums text-text outline-none focus:border-gold"
          />
          <p className="mt-2 text-[12px] leading-6 text-muted-app">
            کارمزد برداشت: {formatToman(wFee)}
            {store.plusActive ? " (گرم پلاس)" : ""}
            {info ? ` · سقف امروز: ${formatToman(Math.max(0, info.dailyCapToman - info.usedTodayToman))}` : ""}
          </p>
          <GoldButton
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            disabled={busy || !selected || (info ? !info.enabled : false)}
            onClick={() => {
              if (!gate.guard()) return;
              if (!selected) return;
              setBusy(true);
              void (async () => {
                const res = await store.withdraw(withdrawAmount, selected.id);
                setBusy(false);
                if (!res.ok) {
                  setErr(res.error ?? "خطا");
                  setMsg("");
                  return;
                }
                setWithdrawAmount(0);
                setErr("");
                if (res.request) {
                  setMsg("");
                  setReceipt({ req: res.request, panMasked: selected.panMasked });
                } else setMsg(res.message ?? "درخواست برداشت ثبت شد.");
                await loadInfo();
              })();
            }}
          >
            {info && !info.enabled ? "برداشت موقتاً غیرفعال است" : "درخواست برداشت"}
          </GoldButton>
        </AppCard>
      </div>

      <ReceiptSheet
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title="درخواست برداشت ثبت شد"
        subtitle="درخواست شما در صف تسویه قرار گرفت."
        amount={receipt ? Math.round(Number(receipt.req.amount_irr) / 10).toLocaleString("fa-IR") : undefined}
        amountUnit="تومان"
        amountCaption={receipt && Number(receipt.req.fee_irr) > 0 ? `کارمزد ${formatToman(Number(receipt.req.fee_irr) / 10)} جداگانه از کیف پول کسر شد` : undefined}
        header={
          receipt ? (
            <div className="flex items-center gap-3">
              <BankBadge name={receipt.req.bank_name} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-text">{receipt.req.bank_name}</p>
                <p dir="ltr" className="truncate text-right font-mono text-[11.5px] text-muted-app">{receipt.panMasked}</p>
              </div>
            </div>
          ) : null
        }
        rows={
          receipt
            ? [
                { label: "شبای مقصد", value: receipt.req.iban, mono: true },
                { label: "زمان ثبت", value: formatTehranJalaliDateTime(receipt.req.created_at) },
                { label: "زمان تقریبی واریز", value: "اولین چرخه پایا پس از تأیید" },
              ]
            : []
        }
        trackingCode={receipt?.req.tracking_code}
        steps={["ثبت", "بررسی", "واریز شد"]}
        activeStep={0}
        reassurance={[
          "مبلغ تا واریز در حساب شما رزرو است.",
          "واریز فقط به کارت و شبای به نام خودتان انجام می‌شود.",
          "چرخه‌های پایا در روزهای کاری اجرا می‌شوند؛ درخواست‌های عصر و تعطیلات در روز کاری بعد واریز می‌شوند.",
        ]}
        actions={[
          { label: "پیگیری درخواست", primary: true, onClick: () => { setReceipt(null); setTimeout(() => document.getElementById("withdraw-requests")?.scrollIntoView({ behavior: "smooth" }), 50); } },
          { label: "بازگشت به کیف پول", onClick: () => setReceipt(null) },
        ]}
      />

      {(msg || err) && (
        <p className={`text-[13px] ${err ? "text-negative" : "text-positive"}`}>
          {err || msg}
        </p>
      )}

      <AppCard id="withdraw-requests">
        <h2 className="text-[15px] font-bold">درخواست‌های برداشت</h2>
        {!info || info.requests.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted-app">درخواست برداشتی ثبت نشده است.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {info.requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-3 py-3 text-[13px]">
                <div>
                  <p className="font-bold text-text">{formatToman(Number(r.amount_irr) / 10)}</p>
                  <p className="text-[11px] text-muted-app">{r.bank_name} · <span dir="ltr" className="font-mono">{r.iban}</span></p>
                  <p className="text-[11px] text-muted-app">
                    {new Date(r.created_at).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })} · <span dir="ltr">{r.tracking_code}</span>
                    {r.payout_ref ? <> · پیگیری بانکی <span dir="ltr">{r.payout_ref}</span></> : null}
                  </p>
                  {r.status === "REJECTED" && r.admin_note ? <p className="text-[11px] text-negative">{r.admin_note}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={REQ_STATUS[r.status]} />
                  {r.status === "PENDING" ? (
                    <button
                      type="button"
                      className="text-[12px] text-negative"
                      onClick={() => {
                        void (async () => {
                          const res = await fetch(`/api/withdrawals/${r.id}/cancel`, { method: "POST" });
                          const data = await res.json().catch(() => ({}));
                          if (data.ok) setMsg(data.message); else setErr(data.message ?? "لغو انجام نشد.");
                          await Promise.all([loadInfo(), store.refreshFinancial()]);
                        })();
                      }}
                    >
                      لغو
                    </button>
                  ) : null}
                </div>
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
