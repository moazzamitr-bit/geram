import { isSupabaseConfigured } from "@/lib/db/types";
import { getLiveGold18Price } from "@/lib/market/price-provider";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const quote = await getLiveGold18Price();
  const { searchParams } = new URL(request.url);
  const persist = searchParams.get("persist") === "1";

  if (
    persist &&
    isSupabaseConfigured() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    quote.priceToman
  ) {
    try {
      const admin = createServiceClient();
      await admin.from("market_prices").insert({
        instrument: "gold18",
        price_toman: quote.priceToman,
        price_rial: quote.priceToman * 10,
        high_toman: quote.highToman ?? null,
        low_toman: quote.lowToman ?? null,
        change_percent: quote.changePercent ?? null,
        source: quote.source ?? "بازار آزاد",
        observed_at: quote.updatedAt ?? new Date().toISOString(),
      });
    } catch {
      /* ignore persist errors — quote still returned */
    }
  }

  return NextResponse.json(
    {
      ok: true,
      instrument: "gold18",
      unit: "toman_per_gram",
      ...quote,
      pollSeconds: 30,
      persisted: persist,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
