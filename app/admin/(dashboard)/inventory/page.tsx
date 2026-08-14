import { AdminNotice, AdminPageHeader, AdminTable, OpsBadge } from "@/components/admin/AdminUI";
import { probeTable } from "@/lib/admin/probe";

export default async function AdminInventoryPage() {
  const lots = await probeTable("inventory_lots", "*", { order: "created_at", limit: 100 });
  return (
    <div>
      <AdminPageHeader title="لات موجودی" description="Edit Lot آزادانه وجود ندارد. تعدیل فقط maker-checker." />
      <OpsBadge state="NOT_READY" />
      <AdminNotice title="وضعیت‌های هدف">
        PENDING_RECEIPT, CONTROLLED, RESERVED, CONSUMED, BLOCKED. جدول inventory_lots در این محیط موجود نیست.
      </AdminNotice>
      {lots.ready ? (
        <AdminTable headers={["lot", "دارایی", "مقدار", "باقی", "هزینه", "منبع", "وضعیت"]} empty={lots.rows.length === 0}>
          {lots.rows.map((r) => (
            <tr key={String((r as { id?: string }).id)} className="border-b border-white/5">
              <td className="px-4 py-3">{String((r as { id?: string }).id)}</td>
              <td className="px-4 py-3">{String((r as { asset?: string }).asset)}</td>
              <td className="px-4 py-3">{String((r as { quantity?: string }).quantity)}</td>
              <td className="px-4 py-3">{String((r as { remaining?: string }).remaining)}</td>
              <td className="px-4 py-3">{String((r as { cost_basis?: string }).cost_basis)}</td>
              <td className="px-4 py-3">{String((r as { source?: string }).source)}</td>
              <td className="px-4 py-3">{String((r as { status?: string }).status)}</td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-[13px] text-white/45">{lots.error ?? "داده در دسترس نیست"}</p>
      )}
    </div>
  );
}
