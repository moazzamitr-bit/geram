import {
  AdminNotice,
  AdminPageHeader,
  AdminStatCard,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { loadDashboardOps } from "@/lib/admin/ops";
import { listProviders } from "@/lib/admin/providers";
import { computeReleaseReadiness } from "@/lib/admin/readiness";
import { getKillSwitches } from "@/lib/core/mode";
import { Activity, AlertTriangle, Shield } from "lucide-react";
import Link from "next/link";

export default async function AdminHealthPage() {
  const ops = await loadDashboardOps();
  const providers = listProviders();
  const readiness = computeReleaseReadiness();
  const kills = getKillSwitches();
  const mockCount = providers.filter((p) => p.mode === "MOCK").length;
  const notReady = readiness.filter((s) => s.status === "NOT_READY").length;

  return (
    <div>
      <AdminPageHeader
        title="سلامت عملیات"
        description="وضعیت واقعی سیستم. Mock هرگز production-ready نمایش داده نمی‌شود."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {ops.mode ? <OpsBadge state={ops.mode === "PRODUCTION" ? "LIVE" : "SANDBOX"} /> : <OpsBadge state="NOT_READY" />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="ارائه‌دهنده MOCK" value={String(mockCount)} icon={Activity} tone="warning" />
        <AdminStatCard label="بخش‌های NOT_READY" value={String(notReady)} icon={AlertTriangle} tone="warning" />
        <AdminStatCard
          label="قیمت کهنه"
          value={ops.connected ? String(ops.operations.stalePrices.kind === "value" ? ops.operations.stalePrices.value : "—") : "—"}
          unavailable={!ops.connected || ops.operations.stalePrices.kind === "unavailable"}
          icon={Activity}
        />
        <AdminStatCard
          label="کلیدهای خاموش"
          value={String(Object.values(kills).filter((v) => !v).length)}
          icon={Shield}
          tone="warning"
        />
      </div>
      <AdminNotice title="موتور تطبیق / outbox / حوادث">
        اگر جدول‌های admin_ops و financial core روی این پروژه اعمال نشده باشند، این شاخص‌ها NOT READY هستند — صفر جعلی نیست.
      </AdminNotice>
      <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
        <Link className="text-gold" href="/admin/providers">وضعیت سرویس‌ها</Link>
        <Link className="text-gold" href="/admin/readiness">آمادگی انتشار</Link>
        <Link className="text-gold" href="/admin/incidents">حوادث</Link>
        <Link className="text-gold" href="/admin/switches">کلیدهای اضطراری</Link>
      </div>
    </div>
  );
}
