import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { probeTable } from "@/lib/admin/probe";

export default async function AdminQuotesPage() {
  const quotes = await probeTable<Record<string, unknown>>("core_quotes", "*", {
    order: "created_at",
    limit: 200,
  });

  return (
    <div>
      <AdminPageHeader
        title="نقل‌قول‌ها"
        description="ویرایش دستی قیمت نقل‌قول وجود ندارد. برای تشخیص انقضای قیمت و بلاک موجودی."
      />
      {!quotes.ready ? (
        <>
          <OpsBadge state="NOT_READY" />
          <AdminNotice title="جدول core_quotes">
            {quotes.error ?? "روی این دیتابیس موجود نیست."} وضعیت‌های هدف: ACTIVE / USED / EXPIRED / CANCELLED.
          </AdminNotice>
        </>
      ) : (
        <>
          <OpsBadge state="SANDBOX" />
          <AdminTable
            headers={["id", "دارایی", "سمت", "وضعیت", "قیمت اجرا", "کارمزد", "وزن", "انقضا"]}
            empty={quotes.rows.length === 0}
          >
            {quotes.rows.map((q) => (
              <tr key={String(q.id)} className="border-b border-white/5">
                <td className="px-4 py-3 font-mono text-[12px]">{String(q.id).slice(0, 10)}</td>
                <td className="px-4 py-3">{String(q.asset)}</td>
                <td className="px-4 py-3">{String(q.side)}</td>
                <td className="px-4 py-3"><AdminBadge>{String(q.status)}</AdminBadge></td>
                <td className="px-4 py-3">{String(q.execution_price_irr_per_gram)}</td>
                <td className="px-4 py-3">{String(q.fee_irr)}</td>
                <td className="px-4 py-3">{String(q.weight_ug)}</td>
                <td className="px-4 py-3 text-white/45">{new Date(String(q.expires_at)).toLocaleString("fa-IR")}</td>
              </tr>
            ))}
          </AdminTable>
        </>
      )}
    </div>
  );
}
