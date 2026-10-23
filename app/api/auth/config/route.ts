import { NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/credentials";
import { publicAuthMethod } from "@/lib/auth/method";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      method: publicAuthMethod(),
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
