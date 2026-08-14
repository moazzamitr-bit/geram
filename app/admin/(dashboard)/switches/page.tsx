import {
  AdminNotice,
  AdminPageHeader,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { getKillSwitches, KILL_SWITCH_KEYS } from "@/lib/core/mode";
import { probeTable } from "@/lib/admin/probe";

export default async function AdminSwitchesPage() {
  const env = getKillSwitches();
  const db = await probeTable<{ key: string; enabled: boolean; reason?: string; actor_id?: string; updated_at?: string }>(
    "admin_kill_switches",
    "*",
    { limit: 50 }
  );
  const byKey = Object.fromEntries((db.rows ?? []).map((r) => [r.key, r]));

  return (
    <div>
      <AdminPageHeader
        title="کلیدهای اضطراری"
        description="مرجع تولید باید Postgres باشد. موتور معامله فعلاً env می‌خواند — اختلاف DEGRADED است. Step-up OTP ادمین هنوز پیاده نشده."
      />
      {!db.ready ? <OpsBadge state="NOT_READY" /> : <OpsBadge state="DEGRADED" />}
      <AdminNotice title="OTP / step-up">
        تغییر نیازمند switches.write + دلیل + audit است. OTP پله‌ای ادمین remaining dependency است.
      </AdminNotice>
      <div className="space-y-4">
        {KILL_SWITCH_KEYS.map((key) => {
          const row = byKey[key];
          const envVal = env[key];
          const dbVal = row ? row.enabled : null;
          const diverge = dbVal != null && dbVal !== envVal;
          return (
            <div key={key} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{key}</p>
                {diverge ? <OpsBadge state="DEGRADED" /> : null}
              </div>
              <p className="mt-2 text-[13px] text-white/60">
                env: {String(envVal)} · Postgres: {dbVal == null ? "داده در دسترس نیست" : String(dbVal)}
              </p>
              {row?.reason ? <p className="text-[12px] text-white/40">دلیل قبلی: {row.reason}</p> : null}
              {row?.updated_at ? (
                <p className="text-[12px] text-white/40">
                  تغییر: {new Date(row.updated_at).toLocaleString("fa-IR")}
                </p>
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <AdminActionForm
                  action="update"
                  endpoint="/api/admin/kills"
                  extra={{ key, enabled: "true" }}
                  submitLabel="روشن"
                />
                <AdminActionForm
                  action="update"
                  endpoint="/api/admin/kills"
                  extra={{ key, enabled: "false" }}
                  submitLabel="خاموش"
                  danger
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
