"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { mgToGramsLabel, useDemoStore, type TxType } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const filters: Array<"همه" | TxType> = [
  "همه",
  "خرید",
  "فروش",
  "واریز",
  "برداشت",
  "تحویل",
];

export default function TransactionsPage() {
  const store = useDemoStore();
  const [filter, setFilter] = useState<(typeof filters)[number]>("همه");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return store.transactions.filter((t) => {
      if (filter !== "همه" && t.type !== filter) return false;
      if (!q) return true;
      return (
        t.id.includes(q) ||
        t.trackingCode.toLowerCase().includes(q.toLowerCase())
      );
    });
  }, [store.transactions, filter, q]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="تراکنش‌ها"
        description="همه عملیات مالی و طلایی شما در یکجا."
        action={<SimulationBadge />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                filter === f
                  ? "bg-gold/15 text-gold"
                  : "border border-white/10 text-muted-app"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی شناسه یا کد رهگیری"
          className="h-10 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-[13px] outline-none focus:border-gold sm:max-w-xs"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="اولین تراکنش شما اینجا نمایش داده می‌شود."
          description="با خرید طلا از ۵۰۰ هزار تومان شروع کنید."
          actionHref="/app/buy"
          actionLabel="خرید طلا"
          icon={Receipt}
        />
      ) : (
        <AppCard padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-[13px]">
              <thead className="text-muted-app">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-medium">نوع</th>
                  <th className="px-3 py-3 font-medium">مقدار</th>
                  <th className="px-3 py-3 font-medium">مبلغ</th>
                  <th className="px-3 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3.5">
                      <Link href={`/app/transactions/${t.id}`} className="text-text hover:text-gold">
                        {t.type}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-text-secondary">
                      {t.goldMg ? `${mgToGramsLabel(t.goldMg)} گرم` : "—"}
                    </td>
                    <td className="px-3 py-3.5">{formatToman(t.amountRial)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3.5 text-muted-app">{t.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}
    </div>
  );
}
