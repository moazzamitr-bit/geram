"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAppData } from "@/lib/app/app-data";
import { Building2 } from "lucide-react";
import { useState } from "react";

const banks = ["بانک ملی", "بانک ملت", "بانک صادرات", "بانک پاسارگاد", "سامان"];

export default function BankAccountsPage() {
  const store = useAppData();
  const [iban, setIban] = useState("IR");
  const [bank, setBank] = useState(banks[0]);
  const [msg, setMsg] = useState("");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="حساب‌های بانکی"
        description="برای برداشت، یک شبا تأییدشده لازم است."
        backHref="/app/profile"
      />

      {store.bankAccounts.length === 0 ? (
        <EmptyState
          title="حساب بانکی ثبت نشده"
          description="برای برداشت ریالی، یک شبا تأییدشده اضافه کنید."
          icon={Building2}
        />
      ) : (
        <div className="space-y-3">
          {store.bankAccounts.map((b) => (
            <AppCard key={b.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-text">{b.bank}</p>
                <p className="mt-1 text-[12px] text-muted-app" dir="ltr">
                  {b.iban}
                </p>
              </div>
              <StatusBadge status={b.verified ? "VERIFIED" : "PENDING"} />
            </AppCard>
          ))}
        </div>
      )}

      <AppCard className="space-y-3">
        <h2 className="text-[15px] font-bold">افزودن حساب</h2>
        <label className="block text-[13px]">
          <span className="text-muted-app">بانک</span>
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3"
          >
            {banks.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px]">
          <span className="text-muted-app">شبا</span>
          <input
            dir="ltr"
            value={iban}
            onChange={(e) => setIban(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
            placeholder="IR..."
          />
        </label>
        <GoldButton
          type="button"
          className="w-full"
          onClick={async () => {
            if (!/^IR\d{24}$/.test(iban)) {
              setMsg("شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.");
              return;
            }
            setMsg("در حال ثبت…");
            const res = await store.addBankAccount(iban, bank);
            if (!res.ok) {
              setMsg(res.error ?? "ثبت حساب انجام نشد.");
              return;
            }
            setIban("IR");
            setMsg(res.message ?? "حساب ثبت شد. تأیید مالکیت شبا هنوز انجام نشده است.");
          }}
        >
          افزودن حساب
        </GoldButton>
        {msg && <p className="text-[13px] text-muted-app">{msg}</p>}
      </AppCard>
    </div>
  );
}
