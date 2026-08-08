import { AdminPageHeader, AdminTable } from "@/components/admin/AdminUI";
import { listGoals } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";

export default async function AdminGoalsPage() {
  const rows = await listGoals(100);

  return (
    <div>
      <AdminPageHeader
        title="اهداف پس‌انداز"
        description="اهداف پس‌انداز کاربران و پیشرفت آن‌ها."
      />
      <AdminTable
        headers={["عنوان", "کاربر", "هدف", "پیشرفت", "ماهانه"]}
        empty={rows.length === 0}
      >
        {rows.map((g) => {
          const profile = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
          const target = Number(g.target_toman);
          const current = Number(g.current_toman);
          const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
          return (
            <tr key={g.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 md:px-5">{g.name}</td>
              <td className="px-4 py-3.5 text-white/60 md:px-5">
                {profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                    profile.phone
                  : "—"}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {formatToman(target)}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {pct.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {formatToman(Number(g.monthly_toman))}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
