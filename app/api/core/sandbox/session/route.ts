import { cookies } from "next/headers";
import { getExecutionMode } from "@/lib/core/mode";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (getExecutionMode() === "PRODUCTION") {
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
