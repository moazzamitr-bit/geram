import { AdminNotice, AdminPageHeader, OpsBadge } from "@/components/admin/AdminUI";

const ASSETS = ["GOLD", "SILVER", "COPPER"] as const;

export default async function AdminCustodyPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string }>;
}) {
  const sp = await searchParams;
  const asset = ASSETS.includes(sp.asset as (typeof ASSETS)[number]) ? sp.asset : "GOLD";
  const fields = [
    "internal book liability",
    "expected controlled",
    "externally verified",
    "backing eligible",
    "encumbered",
    "blocked",
    "last provider snapshot",
    "freshness",
  ];
  return (
    <div>
      <AdminPageHeader title="حضانت" description="اگر CustodyProvider متصل نباشد MOCK / NOT READY. نسبت ذخیره جعل نمی‌شود." />
      <div className="mb-4 flex gap-2">
        {ASSETS.map((a) => (
          <a
            key={a}
            href={`/admin/custody?asset=${a}`}
            className={`rounded-full border px-3 py-1 text-[12px] ${asset === a ? "border-gold text-gold" : "border-white/10 text-white/60"}`}
          >
            {a}
          </a>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        <OpsBadge state="MOCK" />
        <OpsBadge state="NOT_READY" />
      </div>
      <AdminNotice title={`${asset} · CustodyProvider`}>
        FRESH / STALE / UNAVAILABLE / DISPUTED. هیچ نسبت پوشش ساختگی نشان داده نمی‌شود.
      </AdminNotice>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[13px]">
            <p className="text-white/50">{f}</p>
            <p className="mt-2 font-bold text-white/45">داده در دسترس نیست</p>
          </div>
        ))}
      </div>
    </div>
  );
}
