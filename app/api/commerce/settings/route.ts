import { NextResponse } from "next/server";
import { DEFAULT_COMMERCE_SETTINGS } from "@/lib/commerce/types";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await loadCommerceSettings().catch(
    () => DEFAULT_COMMERCE_SETTINGS
  );
  return NextResponse.json(settings);
}
