import {
  getGeram18History,
  parseHistoryRange,
} from "@/lib/market/history-provider";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = parseHistoryRange(searchParams.get("range"));
  const history = await getGeram18History(range);

  return NextResponse.json(
    {
      ok: true,
      instrument: "gold18",
      ...history,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
