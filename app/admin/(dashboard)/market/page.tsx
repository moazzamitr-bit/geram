import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listMarketPrices } from "@/lib/db/admin-queries";
import { COPPER_STALE_AFTER_MS, isTimestampStale, SPOT_STALE_AFTER_MS } from "@/lib/market/freshness";
import { getLivePrices, type MarketPriceQuote } from "@/lib/market/price-provider";
import { formatToman } from "@/lib/utils";
import { GoldButton } from "@/components/ui/GoldButton";
import Link from "next/link";
import { adminDb } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

const CARDS = [
  { instrument: "gold18" as const, label: "GOLD" },
  { instrument: "silver925" as const, label: "SILVER" },
  { instrument: "copper" as const, label: "COPPER" },
];

export default async function AdminMarketPage() {
  const gold = await listMarketPrices(20);
  const sb = await adminDb();
  const all = sb
    ? await sb.from("market_prices").select("*").order("observed_at", { ascending: false }).limit(40)
    : { data: gold };
  const rows = all.data ?? gold;
  let live: MarketPriceQuote[] = [];
  let liveError: string | null = null;
  try {
    live = await getLivePrices();
  } catch (err) {
    liveError = err instanceof Error ? err.message : "قیمت لایو خوانده نشد";
  }
  const liveByInstrument = new Map(live.map((quote) => [quote.instrument, quote]));

  return (
    <div>
      <AdminPageHeader
        title="بازار و قیمت"
        description="ویرایش دستی قیمت نقل‌قول وجود ندارد. کارت‌ها از TGJU زنده هستند. permittedForProduction=false."
        action={
          <Link href="/api/market/price?persist=1">
            <GoldButton type="button" size="sm">
              دریافت قیمت لایو
            </GoldButton>
          </Link>
        }
      />
      <AdminNotice title="منبع">
        primary=TGJU public · permittedForProduction=false
        {liveError ? ` · ${liveError}` : ""}
      </AdminNotice>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {CARDS.map(({ instrument, label }) => {
          const quote = liveByInstrument.get(instrument);
          return (
            <div key={instrument} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[13px]">
              <p className="font-bold">{label}</p>
              <p className="mt-2 text-[18px] font-extrabold text-gold">
                {quote ? formatToman(quote.priceToman) : "در این درخواست خوانده نشد"}
              </p>
              <p className="mt-1 text-white/45">
                سلامت: {quote ? (quote.stale ? "STALE" : "LIVE") : "خوانده نشد"} · منبع: {quote?.sourceKey ?? "—"}
              </p>
              <p className="text-white/60">
                {quote?.updatedAt ? new Date(quote.updatedAt).toLocaleString("fa-IR") : "—"} · permittedForProduction: false
              </p>
            </div>
          );
        })}
      </div>
      <AdminTable headers={["ابزار", "قیمت", "تغییر", "منبع", "سلامت", "زمان"]} empty={rows.length === 0}>
        {rows.map((r) => {
          const instrument = String(r.instrument ?? "gold18");
          const window = instrument === "copper" ? COPPER_STALE_AFTER_MS : SPOT_STALE_AFTER_MS;
          const stale = isTimestampStale(r.observed_at, window);
          return (
            <tr key={r.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 md:px-5">{instrument}</td>
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
              <td className="px-4 py-3.5 md:px-5">{stale ? "STALE" : "FRESH"}</td>
              <td className="px-4 py-3.5 text-white/45 md:px-5">
                {new Date(r.observed_at).toLocaleString("fa-IR")}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
