import { AdminNotice, AdminPageHeader, OpsBadge } from "@/components/admin/AdminUI";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";

export default function AdminFlagsPage() {
  let flags: ReturnType<typeof getFeatureFlags> | null = null;
  let mode: string | null = null;
  try {
    mode = getExecutionMode();
    flags = getFeatureFlags();
  } catch (e) {
    mode = e instanceof Error ? e.message : "unknown";
  }
  return (
    <div>
      <AdminPageHeader title="فلگ ویژگی" description="از env/mode مشتق می‌شود. اجرای مالی دمو روی دفترکل تولید ممنوع است." />
      {flags ? <OpsBadge state="SANDBOX" /> : <OpsBadge state="NOT_READY" />}
      <AdminNotice title="GERAM_EXECUTION_MODE">{mode ?? "نامشخص"}</AdminNotice>
      {flags ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(flags).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0F1724] px-4 py-3 text-[13px]">
              <span>{k}</span>
              <OpsBadge state={v ? "SANDBOX" : "NOT_READY"} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-white/45">فلگ‌ها قابل محاسبه نیستند.</p>
      )}
    </div>
  );
}
