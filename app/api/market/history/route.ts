import {
  getInstrumentHistory,
  parseHistoryRange,
} from "@/lib/market/history-provider";
import { parseInstrumentId } from "@/lib/market/instruments";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = parseHistoryRange(searchParams.get("range"));
  const instrument = parseInstrumentId(searchParams.get("instrument"));
  const history = await getInstrumentHistory(instrument, range);

  return NextResponse.json(
    {
      ok: true,
      ...history,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
