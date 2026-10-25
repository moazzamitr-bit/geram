import { NextResponse } from "next/server";
import { normalizeReferralCode } from "@/lib/referral/service";

export const dynamic = "force-dynamic";

/** Invite link: remember the code for 30 days and open signup. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = normalizeReferralCode(decodeURIComponent(code));
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const base = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : new URL(request.url).origin;
  const res = NextResponse.redirect(new URL("/auth/login?tab=register", base));
  if (/^[A-Z0-9]{4,16}$/.test(clean)) {
    res.cookies.set("geram_ref", clean, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", secure: true });
  }
  return res;
}
