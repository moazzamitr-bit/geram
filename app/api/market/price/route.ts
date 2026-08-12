import { isSupabaseConfigured } from "@/lib/db/types";
import {
  type InstrumentId,
  parseInstrumentId,
} from "@/lib/market/instruments";
import { getLivePrice, getLivePrices } from "@/lib/market/price-provider";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function persistQuote(
  instrument: InstrumentId,
  quote: Awaited<ReturnType<typeof getLivePrice>>
) {
  if (
    !isSupabaseConfigured() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !quote.priceToman
  ) {
    return false;
  }
  try {
    const admin = createServiceClient();
    await admin.from("market_prices").insert({
      instrument,
      price_toman: quote.priceToman,
      price_rial: quote.priceToman * 10,
      high_toman: quote.highToman ?? null,
      low_toman: quote.lowToman ?? null,
      change_percent: quote.changePercent ?? null,
      source: quote.source ?? "بازار آزاد",
      source_key: quote.sourceKey ?? null,
      observed_at: quote.updatedAt ?? new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const persist = searchParams.get("persist") === "1";
  const all = searchParams.get("all") === "1";
  const instrument = parseInstrumentId(searchParams.get("instrument"));

  if (all) {
    const quotes = await getLivePrices(["gold18", "silver925", "copper"]);
    if (persist) {
      await Promise.all(quotes.map((q) => persistQuote(q.instrument, q)));
    }
    return NextResponse.json(
      {
        ok: true,
        unit: "toman_per_gram",
        quotes,
        pollSeconds: 30,
        persisted: persist,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const quote = await getLivePrice(instrument);
  const persisted = persist ? await persistQuote(instrument, quote) : false;

  return NextResponse.json(
    {
      ok: true,
      unit: "toman_per_gram",
      ...quote,
      instrument,
      pollSeconds: 30,
      persisted,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
