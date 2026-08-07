import { getLiveGold18Price } from "@/lib/market/price-provider";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const quote = await getLiveGold18Price();
  return NextResponse.json(
    {
      ok: true,
      instrument: "gold18",
      unit: "toman_per_gram",
      ...quote,
      pollSeconds: 30,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
