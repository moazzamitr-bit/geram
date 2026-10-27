import { AdminBadge, AdminNotice, AdminPageHeader } from "@/components/admin/AdminUI";
import { getLivePrice } from "@/lib/market/price-provider";
import { currentSettings } from "@/lib/pricing/policy";
import {
  average,
  compare,
  effectivePerGram,
  getCompetitorReadings,
  median,
  statusOf,
  type CompetitorReading,
} from "@/lib/market/competitors";
import { loadCompetitorHistory, pollCompetitors } from "@/lib/market/competitors-server";

export const dynamic = "force-dynamic";

const fa = (n: number, d = 0) => n.toLocaleString("fa-IR", { maximumFractionDigits: d, minimumFractionDigits: d });
const tehran = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : "—";

function Diff({ side, ours, theirs }: { side: "buy" | "sell"; ours: number | null; theirs: number | null }) {
  if (ours == null || theirs == null) return <span className="text-white/50">—</span>;
  const c = compare(side, ours, theirs);
  if (c.equal) return <span className="text-white/80">برابر</span>;
  const label = side === "buy" ? (c.good ? "گرم ارزان‌تر" : "گرم گران‌تر") : c.good ? "گرم بیشتر می‌خرد" : "گرم کمتر می‌خرد";
  return (
    <span className={c.good ? "font-bold text-positive" : "font-bold text-negative"}>
      {c.diff > 0 ? "+" : "−"}
      {fa(Math.abs(c.diff))} ({c.diff > 0 ? "+" : "−"}
      {fa(Math.abs(c.pct), 2)}٪)
      <span className="block text-[11px] font-medium">{label}</span>
    </span>
  );
}

function Chart({ points }: { points: { t: number; geram: number | null; med: number }[] }) {
  if (points.length < 2) return <p className="text-[13px] text-white/60">تاریخچه هنوز کافی نیست (هر ۵ دقیقه یک نمونه ذخیره می‌شود).</p>;
  const vals = points.flatMap((p) => [p.med, ...(p.geram ? [p.geram] : [])]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * 600;
  const y = (v: number) => 150 - ((v - lo) / span) * 140 - 5;
  const line = (k: "geram" | "med") =>
    points.filter((p) => p[k] != null).map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p[k] as number).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox="0 0 600 150" className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="نمودار ۲۴ ساعت">
        <path d={line("med")} fill="none" stroke="#9CA3AF" strokeWidth="2" />
        <path d={line("geram")} fill="none" stroke="#D4A537" strokeWidth="2.5" />
      </svg>
      <p className="mt-1 text-[12px] text-white/70">
        <span className="text-gold">━ قیمت مرجع گرم</span> · <span className="text-white/60">━ میانه خرید رقبا</span> · بازه {fa(lo)} تا {fa(hi)} تومان
      </p>
    </div>
  );
}

export default async function CompetitorsPage() {
  await pollCompetitors().catch(() => undefined); // no-op if polled < 5 min ago
  const readings = getCompetitorReadings();
  let q: Awaited<ReturnType<typeof getLivePrice>> | null = null;
  try {
    q = await getLivePrice("gold18");
    if (!(q.priceToman > 0)) q = null;
  } catch {
    q = null;
  }
  const refStale = q?.stale ?? true;
  const refAt = q?.updatedAt ?? null;
  // Same numbers users see (lib/pricing/policy): base ± spread; fee from the admin fee setting (free tier).
  const fees = currentSettings().fees;
  const buyFeeBps = Math.round(fees.buyFeePercentFree * 10_000), sellFeeBps = Math.round(fees.sellFeePercentFree * 10_000);
  const pricing = currentSettings().pricing;
  const ourBuy = q ? q.buyToman : null;
  const ourSell = q ? q.sellToman : null;
  const ourBuyFee = ourBuy ? effectivePerGram(ourBuy, "buy", 0, buyFeeBps) : null;
  const ourSellFee = ourSell ? effectivePerGram(ourSell, "sell", 0, sellFeeBps) : null;
  const ref = q?.priceToman ?? null;

  const live = readings.filter((r) => statusOf(r) === "ok") as (CompetitorReading & { buy: number; sell: number })[];
  const buys = live.map((r) => r.buy), sells = live.map((r) => r.sell);
  const agg = [
    { name: "میانگین رقبا", buy: average(buys), sell: average(sells) },
    { name: "میانه رقبا", buy: median(buys), sell: median(sells) },
  ];
  const cheaperThan = ourBuy ? buys.filter((b) => ourBuy < b).length : 0;
  const payMoreThan = ourSell ? sells.filter((s) => ourSell > s).length : 0;

  const hist = await loadCompetitorHistory(24).catch(() => []);
  const byTime = new Map<string, { b: number[]; geram: number | null }>();
  for (const h of hist) {
    const e = byTime.get(h.observed_at) ?? { b: [], geram: null };
    if (h.competitor === "geram") e.geram = Number(h.buy_toman);
    else e.b.push(Number(h.buy_toman));
    byTime.set(h.observed_at, e);
  }
  const points = [...byTime.entries()]
    .filter(([, e]) => e.b.length)
    .map(([t, e]) => ({ t: Date.parse(t), geram: e.geram, med: median(e.b)! }));
  if (ourBuy) points.push({ t: Date.now(), geram: ourBuy, med: median(buys) ?? points.at(-1)?.med ?? ourBuy! });

  const statusBadge = (r: CompetitorReading) => {
    const s = statusOf(r);
    return s === "ok" ? <AdminBadge tone="positive">سالم</AdminBadge> : s === "stale" ? <AdminBadge tone="warning">قدیمی</AdminBadge> : <AdminBadge tone="negative">خطا</AdminBadge>;
  };
  const cell = "px-3 py-3 md:px-4 align-top";

  return (
    <div>
      <AdminPageHeader
        title="مقایسه قیمت با رقبا"
        description="قیمت طلای ۱۸ عیار هر گرم (تومان). فقط برای اطلاع ادمین — هیچ اثری روی معاملات و محافظ قیمت ندارد. هر ۵ دقیقه به‌روز می‌شود."
      />
      <AdminNotice title="راهنمای رنگ‌ها">
        ستون «خرید»: سبز یعنی خرید از گرم برای کاربر ارزان‌تر است، قرمز یعنی گران‌تر. ستون «فروش»: سبز یعنی گرم طلای کاربر را گران‌تر می‌خرد، قرمز یعنی ارزان‌تر.
        اعداد بدون کارمزد مقایسه شده‌اند (قیمت تابلوی رقبا هم بدون کارمزد است). کارمزد گرم: خرید {fa(buyFeeBps / 100, 2)}٪ · فروش {fa(sellFeeBps / 100, 2)}٪.
      </AdminNotice>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gold/30 bg-[#0F1724] p-4 text-[13px]">
          <p className="font-bold text-white">قیمت گرم (همان که کاربر می‌بیند)</p>
          <p className="mt-2 text-white/85">خرید: <b className="text-[17px] text-gold">{ourBuy ? fa(ourBuy) : "در دسترس نیست"}</b></p>
          <p className="text-white/85">فروش: <b className="text-[17px] text-gold">{ourSell ? fa(ourSell) : "—"}</b></p>
          <p className="mt-1 text-[12px] text-white/65">
            با کارمزد: خرید {ourBuyFee ? fa(ourBuyFee) : "—"} · فروش {ourSellFee ? fa(ourSellFee) : "—"}
          </p>
          <p className="text-[12px] text-white/65">
            پایه {ref ? fa(ref) : "—"} ({pricing.goldBase}) · اسپرد خرید {fa(pricing.goldBuySpreadPercent * 100, 2)}٪ · فروش {fa(pricing.goldSellSpreadPercent * 100, 2)}٪
          </p>
          <p className="text-[12px] text-white/65">{refStale ? "⚠ قیمت قدیمی" : "زنده"} · {tehran(refAt)} (تهران)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[13px] text-white/85">
          <p className="font-bold text-white">جایگاه ما در خرید</p>
          <p className="mt-2 text-[17px] font-extrabold">ارزان‌تر از {fa(cheaperThan)} رقیب از {fa(live.length)}</p>
          <p className="mt-1"><Diff side="buy" ours={ourBuy} theirs={median(buys)} /> نسبت به میانه</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[13px] text-white/85">
          <p className="font-bold text-white">جایگاه ما در فروش</p>
          <p className="mt-2 text-[17px] font-extrabold">گران‌تر از {fa(payMoreThan)} رقیب از {fa(live.length)} می‌خریم</p>
          <p className="mt-1"><Diff side="sell" ours={ourSell} theirs={median(sells)} /> نسبت به میانه</p>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0F1724]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-[13px] text-white/90">
            <thead className="border-b border-white/10 text-white/70">
              <tr>
                {["رقیب", "خرید آن‌ها", "فروش آن‌ها", "اختلاف خرید گرم", "اختلاف فروش گرم", "آخرین به‌روزرسانی (تهران)", "وضعیت"].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium md:px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className={cell}>
                    <a href={r.site} target="_blank" rel="noreferrer noopener" className="font-bold text-white hover:text-gold">{r.name}</a>
                  </td>
                  <td className={cell}>{r.buy ? fa(r.buy) : "—"}</td>
                  <td className={cell}>{r.sell ? fa(r.sell) : "—"}</td>
                  <td className={cell}><Diff side="buy" ours={ourBuy} theirs={r.buy} /></td>
                  <td className={cell}><Diff side="sell" ours={ourSell} theirs={r.sell} /></td>
                  <td className={cell}>{tehran(r.observedAt)}</td>
                  <td className={cell}>
                    {statusBadge(r)}
                    {r.error ? <span className="mt-1 block text-[11px] text-white/65">{r.error}</span> : null}
                  </td>
                </tr>
              ))}
              {agg.map((a) => (
                <tr key={a.name} className="border-b border-white/5 bg-white/[0.03] font-bold">
                  <td className={cell}>{a.name} ({fa(live.length)})</td>
                  <td className={cell}>{a.buy ? fa(a.buy) : "—"}</td>
                  <td className={cell}>{a.sell ? fa(a.sell) : "—"}</td>
                  <td className={cell}><Diff side="buy" ours={ourBuy} theirs={a.buy} /></td>
                  <td className={cell}><Diff side="sell" ours={ourSell} theirs={a.sell} /></td>
                  <td className={cell}>—</td>
                  <td className={cell} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-4">
        <p className="mb-2 text-[13px] font-bold text-white">۲۴ ساعت اخیر</p>
        <Chart points={points} />
      </div>
    </div>
  );
}
