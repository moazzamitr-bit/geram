import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeTrade, tradeToDemoTx } from "@/lib/core/adapters";
import { irrToSafeTomanNumber } from "@/lib/core/money";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const core = getFinancialCore();
    const { trades, deposits } = await core.listActivity(userId);
    const ui = [
      ...trades.map((t) => tradeToDemoTx(t)),
      ...deposits.map((d) => ({
        id: d.id,
        trackingCode: d.trackingCode,
        type: "واریز" as const,
        instrument: "gold18" as const,
        goldMg: 0,
        amountRial: irrToSafeTomanNumber(d.irr),
        feeRial: 0,
        pricePerGram: 0,
        status: "تکمیل‌شده" as const,
        createdAt: new Intl.DateTimeFormat("fa-IR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(d.createdAt)),
        timeline: [
          { label: "درخواست واریز", done: true },
          { label: "تأیید درگاه (سندباکس)", done: true },
          { label: "افزایش موجودی", done: true },
        ],
      })),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return Response.json({
      ok: true,
      trades: trades.map(serializeTrade),
      ui,
    });
  } catch (err) {
    return jsonError(err);
  }
}
