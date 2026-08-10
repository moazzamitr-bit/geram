import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Temporary diagnostic — lists env KEY NAMES only (no values). Remove after setup. */
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
    .filter((k) =>
      /SUPABASE|POSTGRES|DATABASE|CRON|PHONE/i.test(k)
    )
    .sort();

  return NextResponse.json({
    ok: true,
    keys,
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}
