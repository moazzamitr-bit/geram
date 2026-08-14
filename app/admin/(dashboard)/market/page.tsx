import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listMarketPrices } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";
import { GoldButton } from "@/components/ui/GoldButton";
import Link from "next/link";
import { adminDb } from "@/lib/admin/queries";

export default async function AdminMarketPage() {
  const gold = await listMarketPrices(20);
  const sb = await adminDb();
  const all = sb
    ? await sb.from("market_prices").select("*").order("observed_at", { ascending: false }).limit(40)
    : { data: gold };
  const rows = all.data ?? gold;
  const latestByInstrument = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const inst = String(r.instrument ?? "gold18");
    if (!latestByInstrument.has(inst)) latestByInstrument.set(inst, r);
  }

  return (
    <div>
      <AdminPageHeader
        title="بازار و قیمت"
        description="ویرایش دستی قیمت نقل‌قول وجود ندارد. TGJU منبع موقت است و permittedForProduction=false."
        action={
          <Link href="/api/market/price?persist=1">
            <GoldButton type="button" size="sm">
              دریافت قیمت لایو
            </GoldButton>
          </Link>
        }
      />
      <div className="mb-4 flex gap-2">
        <OpsBadge state="SANDBOX" />
        <OpsBadge state="DEGRADED" />
      </div>
      <AdminNotice title="منابع">
        primary=TGJU public · secondary=NOT READY · کارمزد/سقف از تنظیمات با audit. تغییرات پرریسک: صف تأیید دو مرحله‌ای.
      </AdminNotice>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {["gold18", "silver925", "copper"].map((inst) => {
          const row = latestByInstrument.get(inst);
          const stale = row ? Date.now() - new Date(row.observed_at).getTime() > 15 * 60_000 : true;
          return (
            <div key={inst} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[13px]">
              <p className="font-bold">{inst === "gold18" ? "GOLD" : inst === "silver925" ? "SILVER" : "COPPER"}</p>
              <p className="mt-2 text-[18px] font-extrabold text-gold">
                {row ? formatToman(Number(row.price_toman)) : "داده در دسترس نیست"}
              </p>
              <p className="mt-1 text-white/45">
                سلامت: {row ? (stale ? "STALE" : "LIVE") : "UNAVAILABLE"} · منبع: {row?.source ?? "—"}
              </p>
              <p className="text-white/40">permittedForProduction: false</p>
            </div>
          );
        })}
      </div>
      <AdminTable headers={["ابزار", "قیمت", "تغییر", "منبع", "زمان"]} empty={rows.length === 0}>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-white/5 last:border-0">
            <td className="px-4 py-3.5 md:px-5">{r.instrument ?? "gold18"}</td>
            <td className="px-4 py-3.5 tabular-nums font-bold text-gold md:px-5">
              {formatToman(Number(r.price_toman))}
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {r.change_percent != null
                ? `${Number(r.change_percent).toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪`
                : "—"}
            </td>
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge tone="gold">{r.source}</AdminBadge>
            </td>
            <td className="px-4 py-3.5 text-white/45 md:px-5">
              {new Date(r.observed_at).toLocaleString("fa-IR")}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
