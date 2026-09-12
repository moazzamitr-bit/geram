import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import { listInventoryLots } from "@/lib/db/treasury-queries";
import { formatToman } from "@/lib/utils";

export default async function AdminInventoryPage() {
  const guide = adminPageGuides.inventory;
  const rows = await listInventoryLots(100);

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="لات‌های فیزیکی — مصرف جزئی مجاز است؛ موجودی دستی قابل ویرایش نیست."
      />
      <AdminGuide purpose={guide.purpose} whenToUse={guide.whenToUse} />
      <AdminTable
        headers={[
          "دارایی",
          "تأمین‌کننده",
          "وزن اولیه",
          "باقیمانده",
          "بهای تمام‌شده",
          "وضعیت",
          "تاریخ",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((lot) => (
          <tr key={lot.id} className="border-b border-white/5 last:border-0">
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge tone="gold">{lot.asset}</AdminBadge>
            </td>
            <td className="px-4 py-3.5 text-white/70 md:px-5">{lot.supplier || "—"}</td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {(Number(lot.weight_mg) / 1000).toLocaleString("fa-IR", {
                maximumFractionDigits: 3,
              })}{" "}
              گرم
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {(Number(lot.remaining_mg) / 1000).toLocaleString("fa-IR", {
                maximumFractionDigits: 3,
              })}{" "}
              گرم
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {formatToman(Number(lot.acquisition_cost_toman))}
            </td>
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge
                tone={
                  lot.status === "ACTIVE"
                    ? "positive"
                    : lot.status === "DEPLETED"
                      ? "neutral"
                      : "warning"
                }
              >
                {lot.status}
              </AdminBadge>
            </td>
            <td className="px-4 py-3.5 text-white/45 md:px-5">
              {new Date(lot.purchased_at).toLocaleString("fa-IR")}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
