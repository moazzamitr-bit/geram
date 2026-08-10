import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/db/admin-queries";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import {
  mergeWithDefaults,
  parseCommerceSettings,
  saveCommerceSettings,
} from "@/lib/commerce/save-settings";
import { DEFAULT_COMMERCE_SETTINGS } from "@/lib/commerce/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason },
      { status: auth.reason === "unauthenticated" ? 401 : 403 }
    );
  }

  const settings = await loadCommerceSettings().catch(
    () => DEFAULT_COMMERCE_SETTINGS
  );
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason },
      { status: auth.reason === "unauthenticated" ? 401 : 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = parseCommerceSettings(mergeWithDefaults(body));
    const settings = await saveCommerceSettings(parsed);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "save_failed",
      },
      { status: 400 }
    );
  }
}
