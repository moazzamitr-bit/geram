import { NextResponse } from "next/server";
import { normalizeGiftCode } from "@/lib/gift/service";

export const dynamic = "force-dynamic";

/** Gift link: remember the code (7 days) so it survives sign-in, then open the redeem screen. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = normalizeGiftCode(decodeURIComponent(code));
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const base = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : new URL(request.url).origin;
  const res = NextResponse.redirect(new URL(clean ? `/app/gift?code=${clean}` : "/app/gift", base));
  if (clean) res.cookies.set("geram_gift", clean, { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax", secure: true });
  return res;
}
