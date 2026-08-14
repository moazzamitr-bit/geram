import { AdminBadge, AdminNotice, AdminPageHeader } from "@/components/admin/AdminUI";
import { computeReleaseReadiness } from "@/lib/admin/readiness";

export default function AdminReadinessPage() {
  const sections = computeReleaseReadiness();
  return (
    <div>
      <AdminPageHeader
        title="آمادگی انتشار"
        description="وضعیت از پیکربندی و شواهد سیستم مشتق می‌شود. ادمین نمی‌تواند READY را دستی اجبار کند."
      />
      <AdminNotice title="قانون">
        هیچ دکمه «Mark READY» وجود ندارد. Mock provider هرگز production-ready نیست.
      </AdminNotice>
      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">{s.title}</h2>
              <AdminBadge
                tone={s.status === "READY" ? "positive" : s.status === "DEGRADED" ? "warning" : "negative"}
              >
                {s.status}
              </AdminBadge>
            </div>
            {s.blockers.length ? (
              <ul className="mt-2 list-disc pr-5 text-[13px] leading-7 text-white/60">
                {s.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-white/45">مسدودکننده ثبت‌شده نیست.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
