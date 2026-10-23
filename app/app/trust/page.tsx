"use client";

import { AppCard } from "@/components/app/AppCard";
import { NoData } from "@/components/app/NoData";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { useMemo, useState } from "react";

export default function TrustPage() {
  const store = useDemoStore();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const found = useMemo(
    () => store.transactions.find((t) => t.trackingCode === code.trim().toUpperCase()),
    [store.transactions, code]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="مرکز اعتماد"
        description="فقط عددی نشان داده می‌شود که از حساب یا دفترکل شما آمده باشد."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="موجودی طلای شما" value={`${mgToGramsLabel(store.goldMg)} گرم`} />
        <Stat title="پشتوانه ثبت‌شده" value="—" />
        <Stat title="نسبت پوشش" value="—" />
        <Stat title="آخرین تطبیق" value="—" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AppCard>
          <h2 className="text-[15px] font-bold">نگهداری و بیمه</h2>
          <NoData className="py-8" />
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold">صحت‌سنجی کد رهگیری</h2>
          <p className="mt-2 text-[13px] text-muted-app">
            فقط وضعیت تراکنش خودتان نمایش داده می‌شود.
          </p>
          <input
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="GRM-XXXXXX"
            className="mt-4 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
          />
          <GoldButton
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => {
              if (!code.trim()) {
                setResult("کد را وارد کنید.");
                return;
              }
              setResult(found ? "found" : "missing");
            }}
          >
            استعلام
          </GoldButton>
          {result === "missing" && (
            <p className="mt-3 text-[13px] text-muted-app">کدی با این مشخصات یافت نشد.</p>
          )}
          {result && result !== "found" && result !== "missing" && (
            <p className="mt-3 text-[13px] text-muted-app">{result}</p>
          )}
          {result === "found" && found && (
            <div className="mt-4 rounded-xl border border-white/[0.06] p-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span>{found.type}</span>
                <StatusBadge status={found.status} />
              </div>
              <p className="mt-2 text-muted-app">{found.createdAt}</p>
              <p className="mt-1">
                {found.goldMg ? `${mgToGramsLabel(found.goldMg)} گرم` : "بدون فلز"}
              </p>
            </div>
          )}
        </AppCard>
      </div>

      <AppCard>
        <h2 className="text-[15px] font-bold">گزارش‌ها</h2>
        <NoData />
      </AppCard>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <AppCard>
      <p className="text-[12px] text-muted-app">{title}</p>
      <p className="mt-2 text-[18px] font-extrabold text-text">{value}</p>
    </AppCard>
  );
}
