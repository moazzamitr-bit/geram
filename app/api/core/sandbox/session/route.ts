import { cookies } from "next/headers";
import { sandboxCookieIdentityAllowed } from "@/lib/core/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sandboxCookieIdentityAllowed()) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = body.userId || "demo-user-1";
  const jar = await cookies();
  jar.set("geram_sandbox_uid", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return Response.json({ ok: true, userId });
}
