import {
  AdminNotice,
  AdminPageHeader,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { loadDashboardOps } from "@/lib/admin/ops";

const ASSETS = ["GOLD", "SILVER", "COPPER"] as const;

export default async function AdminTreasuryPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string }>;
}) {
  const sp = await searchParams;
  const asset = (ASSETS.includes(sp.asset as (typeof ASSETS)[number]) ? sp.asset : "GOLD") as (typeof ASSETS)[number];
  const ops = await loadDashboardOps();
  const book =
    asset === "GOLD"
      ? ops.connected && ops.metals.customerGoldBookMg.kind === "value"
        ? ops.metals.customerGoldBookMg.value
        : null
      : asset === "SILVER"
        ? ops.connected && ops.metals.customerSilverBookMg.kind === "value"
          ? ops.metals.customerSilverBookMg.value
          : null
        : ops.connected && ops.metals.customerCopperBookMg.kind === "value"
          ? ops.metals.customerCopperBookMg.value
          : null;

  const metrics: { label: string; value: string | null; hint: string }[] = [
    { label: "Customer metal book (wallets, mg)", value: book != null ? String(book) : null, hint: "میراث — بدهی دفترکل نیست" },
    { label: "CustomerMetalLiability", value: null, hint: "NOT READY" },
    { label: "PlatformFreeControlledInventory", value: null, hint: "CORE_MILESTONE_PLACEHOLDER" },
    { label: "ReservedInventory", value: null, hint: "NOT READY" },
    { label: "OpenSoftReservations", value: null, hint: "NOT READY" },
    { label: "RestrictedInventory", value: null, hint: "NOT READY" },
    { label: "SafetyBuffer", value: null, hint: "NOT READY" },
    { label: "AvailableToSell", value: null, hint: "NOT READY" },
    { label: "NetPosition", value: null, hint: "NOT READY" },
    { label: "WeightedAverageCost", value: null, hint: "NOT READY" },
    { label: "Realized PnL", value: null, hint: "NOT READY" },
  ];

  return (
    <div>
      <AdminPageHeader title="خزانه‌داری" description="صفر جعلی نشان داده نمی‌شود. نوشتن حساس نیازمند مجوز + audit است." />
      <div className="mb-4 flex gap-2">
        {ASSETS.map((a) => (
          <a
            key={a}
            href={`/admin/treasury?asset=${a}`}
            className={`rounded-full border px-3 py-1 text-[12px] ${asset === a ? "border-gold text-gold" : "border-white/10 text-white/60"}`}
          >
            {a}
          </a>
        ))}
      </div>
      <OpsBadge state="NOT_READY" />
      <AdminNotice title={asset}>
        CustomerMetalLiability محاسبه نمی‌شود. موجودی دفتری wallets بدهی عملیاتی خزانه نیست.
      </AdminNotice>
      <div className="grid gap-3 md:grid-cols-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[13px]">
            <p className="text-white/50">{m.label}</p>
            <p className="mt-2 font-bold">{m.value != null ? (typeof m.value === "number" || !Number.isNaN(Number(m.value)) ? `${(Number(m.value) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم` : m.value) : "داده در دسترس نیست"}</p>
            <p className="mt-1 text-[12px] text-white/40">{m.hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <AdminActionForm
          action="create"
          endpoint="/api/admin/approvals"
          extra={{ kind: "SETTINGS_CHANGE", asset }}
          submitLabel="پیشنهاد تغییر Safety Buffer (maker-checker)"
        />
        <AdminActionForm
          action="create"
          endpoint="/api/admin/approvals"
          extra={{ kind: "PROCUREMENT_SUBMIT", asset }}
          submitLabel="پیشنهاد تأمین"
        />
      </div>
    </div>
  );
}
