import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listProviders } from "@/lib/admin/providers";

export default function AdminProvidersPage() {
  const rows = listProviders();
  return (
    <div>
      <AdminPageHeader
        title="وضعیت سرویس‌ها"
        description="Mock هرگز production-ready نیست."
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
