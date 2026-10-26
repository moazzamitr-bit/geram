"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { BankCardPicker } from "@/components/app/BankCardPicker";

export default function BankAccountsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="حساب‌های بانکی"
        description="برداشت تومانی فقط به شبای کارت‌های تأییدشده خودتان واریز می‌شود. شبا از روی کارت و از طریق استعلام بانکی گرفته می‌شود و دستی وارد نمی‌شود."
        backHref="/app/profile"
      />

      <AppCard>
        <BankCardPicker mode="list" />
      </AppCard>
    </div>
  );
}
