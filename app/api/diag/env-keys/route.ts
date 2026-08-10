import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Temporary diagnostic — lists env KEY NAMES only (no secret values). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const ok =
    (secret && url.searchParams.get("secret") === secret) ||
    request.headers.get("authorization") === `Bearer ${secret}`;
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const keys = Object.keys(process.env)
    .filter((k) => /SUPABASE|POSTGRES|DATABASE|CRON|PHONE|^Supabase$/i.test(k))
    .sort();

  let supabaseBlob: {
    present: boolean;
    typeof: string;
    jsonKeys?: string[];
    parseError?: string;
  } = { present: false, typeof: "undefined" };

  const raw = process.env.Supabase;
  if (raw != null) {
    supabaseBlob = { present: true, typeof: typeof raw };
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      supabaseBlob.jsonKeys = Object.keys(parsed).sort();
    } catch (err) {
      supabaseBlob.parseError =
        err instanceof Error ? err.message : "parse_failed";
      supabaseBlob.jsonKeys = [
        raw.startsWith("eyJ") ? "looks_like_jwt" : `len_${raw.length}`,
      ];
    }
  }

  return NextResponse.json({
    ok: true,
    keys,
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseBlob,
  });
}
