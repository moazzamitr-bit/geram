import { AdminBadge, AdminNotice, AdminPageHeader } from "@/components/admin/AdminUI";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";

export default function AdminFlagsPage() {
  let flags: ReturnType<typeof getFeatureFlags> | null = null;
  let mode: string | null = null;
  let modeError = false;
  try {
    mode = getExecutionMode();
    flags = getFeatureFlags();
  } catch (e) {
    modeError = true;
    mode = e instanceof Error ? e.message : "unknown";
  }
  return (
    <div>
      <AdminPageHeader title="فلگ ویژگی" description="از env و GERAM_EXECUTION_MODE خوانده می‌شود." />
      {modeError || !flags ? (
        <AdminBadge tone="warning">MODE نامعتبر</AdminBadge>
      ) : (
        <AdminBadge tone={mode === "PRODUCTION" ? "positive" : "gold"}>{mode}</AdminBadge>
      )}
      <AdminNotice title="GERAM_EXECUTION_MODE">{mode ?? "نامشخص"}</AdminNotice>
      {flags ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(flags).map(([key, enabled]) => (
            <div key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0F1724] px-4 py-3 text-[13px]">
              <span>{key}</span>
              <AdminBadge tone={enabled ? "positive" : "neutral"}>{enabled ? "روشن" : "خاموش"}</AdminBadge>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-white/45">فلگ‌ها قابل محاسبه نیستند.</p>
      )}
    </div>
  );
}
