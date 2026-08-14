"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Timeline } from "@/components/app/Timeline";
import { GoldButton } from "@/components/ui/GoldButton";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { instrumentLabel, type InstrumentId } from "@/lib/market/instruments";
import { formatToman } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const tx = store.transactions.find((t) => t.id === id);

  if (!tx) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="تراکنش یافت نشد" backHref="/app/transactions" />
      </div>
    );
  }

  const metal = instrumentLabel((tx.instrument as InstrumentId) ?? "gold18");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={`${tx.type} ${metal} — جزئیات`}
        backHref="/app/transactions"
        action={<SimulationBadge />}
      />

      <AppCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={tx.status} />
          <p className="text-[12px] text-muted-app">{tx.createdAt}</p>
        </div>
        <dl className="mt-5 space-y-3 text-[13px]">
          <Row label="شناسه تراکنش" value={tx.id} />
          <Row label="کد رهگیری" value={tx.trackingCode} />
          <Row label="فلز" value={metal} />
          <Row label="قیمت هر گرم" value={formatToman(tx.pricePerGram)} />
          <Row
            label={`مقدار ${metal}`}
            value={tx.goldMg ? `${mgToGramsLabel(tx.goldMg)} گرم` : "—"}
          />
          <Row label="مبلغ ناخالص/پرداختی" value={formatToman(tx.amountRial)} />
          <Row label="کارمزد" value={formatToman(tx.feeRial)} />
          {tx.paymentRef && <Row label="مرجع پرداخت" value={tx.paymentRef} />}
          {tx.note && <Row label="توضیح" value={tx.note} />}
        </dl>
      </AppCard>

      <AppCard>
        <h2 className="mb-4 text-[15px] font-bold">تایم‌لاین</h2>
        <Timeline items={tx.timeline} />
      </AppCard>

      <div className="flex flex-wrap gap-3">
        <GoldButton type="button" size="sm" onClick={() => window.print()}>
          دانلود رسید
        </GoldButton>
        <Link href="/app/support">
          <GoldButton type="button" size="sm" variant="secondary">
            پیگیری از پشتیبانی
          </GoldButton>
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-app">{label}</dt>
      <dd className="text-left text-text" dir="auto">
        {value}
      </dd>
    </div>
  );
}
