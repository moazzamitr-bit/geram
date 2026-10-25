import { AdminBadge, AdminPageHeader, AdminTable } from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { PhysicalProductsForm, PhysicalSettingsForm } from "@/components/admin/PhysicalAdminClient";
import { maskPhone } from "@/lib/admin/mask";
import { listActiveProducts, listAllRequests } from "@/lib/physical/service";
import { loadPhysicalSettings } from "@/lib/physical/settings";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TONE = { PENDING: "warning", APPROVED: "gold", DELIVERED: "positive", REJECTED: "negative", CANCELLED: "neutral" } as const;
const LABEL: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأییدشده / آماده تحویل",
  DELIVERED: "تحویل شد",
  REJECTED: "رد شد",
  CANCELLED: "لغو کاربر",
};

export default async function AdminPhysicalPage() {
  const [rows, products, settings] = await Promise.all([listAllRequests(), listActiveProducts(), loadPhysicalSettings()]);
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="برداشت فیزیکی"
        description="ثبت درخواست فلز کاربر را رزرو می‌کند. تأیید = نوبت قطعی. تحویل = خروج از دفترکل. رد = برگشت به کاربر."
      />
      <AdminTable headers={["کد", "کاربر", "محصول", "وزن + کارمزد", "نوبت", "وضعیت", "اقدام"]} empty={rows.length === 0}>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-white/5 align-top">
            <td className="px-4 py-3 font-mono text-[12px]">{r.tracking_code}</td>
            <td className="px-4 py-3">
              <Link className="text-gold" href={`/admin/users/${r.user_id}`}>{r.full_name || maskPhone(r.phone)}</Link>
            </td>
            <td className="px-4 py-3">{r.product_title} × {r.quantity}</td>
            <td className="px-4 py-3 tabular-nums">
              {(Number(r.weight_ug) / 1e6).toLocaleString("fa-IR")} + {(Number(r.fee_ug) / 1e6).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم
            </td>
            <td className="px-4 py-3 text-[12px]">
              {r.branch_name}<br />
              {new Date(`${r.pickup_date}T12:00:00`).toLocaleDateString("fa-IR-u-ca-persian")} · {r.pickup_slot}
            </td>
            <td className="px-4 py-3">
              <AdminBadge tone={TONE[r.status]}>{LABEL[r.status]}</AdminBadge>
              {r.admin_note && <p className="mt-1 text-[11px] text-white/45">{r.admin_note}</p>}
            </td>
            <td className="min-w-[230px] space-y-2 px-4 py-3">
              {r.status === "PENDING" && (
                <AdminActionForm action="approve" endpoint="/api/admin/physical" extra={{ id: r.id }} submitLabel="تأیید نوبت" placeholder="یادداشت (مثلاً آدرس دقیق شعبه)" />
              )}
              {r.status === "APPROVED" && (
                <AdminActionForm action="deliver" endpoint="/api/admin/physical" extra={{ id: r.id }} submitLabel="ثبت تحویل" placeholder="تحویل‌گیرنده / شماره رسید" />
              )}
              {(r.status === "PENDING" || r.status === "APPROVED") && (
                <AdminActionForm action="reject" endpoint="/api/admin/physical" extra={{ id: r.id }} submitLabel="رد و برگشت فلز" placeholder="دلیل رد (به کاربر نمایش داده می‌شود)" danger />
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
      <div className="grid gap-6 lg:grid-cols-2">
        <PhysicalProductsForm products={products} />
        <PhysicalSettingsForm settings={settings} />
      </div>
    </div>
  );
}
