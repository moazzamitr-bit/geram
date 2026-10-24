import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listProviders } from "@/lib/admin/providers";
import { finnotechConfigured } from "@/lib/finnotech/config";
import { getLivePrices } from "@/lib/market/price-provider";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  let prices: Awaited<ReturnType<typeof getLivePrices>> = [];
  try {
    prices = await getLivePrices();
  } catch {
    prices = [];
  }
  const rows = listProviders({ finnotech: finnotechConfigured(), prices });
  return (
    <div>
      <AdminPageHeader
        title="وضعیت سرویس‌ها"
        description="Mock هرگز production-ready نیست. Finnotech و قیمت لایو از پیکربندی و TGJU خوانده می‌شوند."
      />
      <AdminNotice title="قانون">اگر mode=MOCK باشد productionApproved همیشه false است.</AdminNotice>
      <AdminTable
        headers={["گروه", "نام", "mode", "سلامت", "تولید", "توضیح"]}
        empty={rows.length === 0}
      >
        {rows.map((p) => (
          <tr key={`${p.group}-${p.name}`} className="border-b border-white/5">
            <td className="px-4 py-3">{p.group}</td>
            <td className="px-4 py-3">{p.name}</td>
            <td className="px-4 py-3"><OpsBadge state={p.mode} /></td>
            <td className="px-4 py-3"><OpsBadge state={p.health} /></td>
            <td className="px-4 py-3">{p.productionApproved ? "YES" : "NO"}</td>
            <td className="px-4 py-3 text-white/55">{p.note}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
