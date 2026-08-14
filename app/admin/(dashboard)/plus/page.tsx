import { AdminNotice, AdminPageHeader, OpsBadge } from "@/components/admin/AdminUI";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { formatToman } from "@/lib/utils";

export default async function AdminPlusPage() {
  let flags = null;
  try {
    flags = getFeatureFlags(getExecutionMode());
  } catch {
    flags = null;
  }
  const settings = await loadCommerceSettings().catch(() => null);
  return (
    <div>
      <AdminPageHeader title="گرم پلاس" description="وضعیت عملیاتی ویژگی. اجرای مالی اشتراک بعداً." />
      <OpsBadge state={flags?.GERAM_PLUS_ENABLED ? "SANDBOX" : "NOT_READY"} />
      <AdminNotice title="GERAM_PLUS_ENABLED">{String(flags?.GERAM_PLUS_ENABLED ?? false)}</AdminNotice>
      {settings ? (
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
          <p>قیمت ماهانه تنظیمات: {formatToman(settings.plus.monthlyPriceToman)}</p>
          <p>حداکثر DCA رایگان / پلاس: {settings.plus.maxDcaFree} / {settings.plus.maxDcaPlus}</p>
        </div>
      ) : (
        <p className="text-[13px] text-white/45">تنظیمات در دسترس نیست</p>
      )}
    </div>
  );
}
