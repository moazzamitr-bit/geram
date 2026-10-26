"use client";

import Link from "next/link";
import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAppData } from "@/lib/app/app-data";
import { Building2 } from "lucide-react";

export default function BankAccountsPage() {
  const store = useAppData();
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="حساب‌های بانکی"
        description="برداشت تومانی فقط به شبای کارت‌های تأییدشده خودتان واریز می‌شود. شبا از روی کارت و از طریق استعلام بانکی گرفته می‌شود و دستی وارد نمی‌شود."
        backHref="/app/profile"
      />

      {store.bankAccounts.length === 0 ? (
        <EmptyState
          title="کارت بانکی ثبت نشده"
          description="یک کارت بانکی به نام خودتان در احراز هویت ثبت کنید تا شبای آن برای برداشت فعال شود."
          icon={Building2}
        />
      ) : (
        <div className="space-y-3">
          {store.bankAccounts.map((b) => (
            <AppCard key={b.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-text">{b.bank}</p>
                <p className="mt-1 font-mono text-[12px] text-muted-app" dir="ltr">{b.panMasked}</p>
                <p className="mt-1 font-mono text-[12px] text-text" dir="ltr">
                  {b.iban ?? "—"}
                </p>
                {!b.iban ? (
                  <p className="mt-1 text-[11px] text-warning">شبا هنوز دریافت نشده؛ کارت را دوباره در احراز هویت وارد کنید.</p>
                ) : null}
              </div>
              <StatusBadge status={b.verified && b.iban ? "VERIFIED" : "PENDING"} />
            </AppCard>
          ))}
        </div>
      )}

      <Link href="/app/profile/kyc?return=/app/profile/bank-accounts">
        <GoldButton type="button" className="w-full">افزودن کارت بانکی</GoldButton>
      </Link>
    </div>
  );
}
