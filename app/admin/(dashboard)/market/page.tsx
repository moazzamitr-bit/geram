import {
  AdminBadge,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listMarketPrices } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";
import { GoldButton } from "@/components/ui/GoldButton";
import Link from "next/link";

export default async function AdminMarketPage() {
  const rows = await listMarketPrices(40);

  return (
    <div>
      <AdminPageHeader
        title="بازار و قیمت"
        description="تاریخچه قیمت طلای ۱۸ عیار ذخیره‌شده در سوپابیس."
        action={
          <Link href="/api/market/price?persist=1">
            <GoldButton type="button" size="sm">
              دریافت قیمت لایو
            </GoldButton>
          </Link>
        }
      />
      <AdminTable
        headers={["قیمت", "تغییر", "منبع", "زمان"]}
        empty={rows.length === 0}
      >
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-white/5 last:border-0">
            <td className="px-4 py-3.5 tabular-nums font-bold text-gold md:px-5">
              {formatToman(Number(r.price_toman))}
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {r.change_percent != null
                ? `${Number(r.change_percent).toLocaleString("fa-IR", {
                    maximumFractionDigits: 2,
                  })}٪`
                : "—"}
            </td>
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge tone="gold">{r.source}</AdminBadge>
            </td>
            <td className="px-4 py-3.5 text-white/45 md:px-5">
              {new Date(r.observed_at).toLocaleString("fa-IR")}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
