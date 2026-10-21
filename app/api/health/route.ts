export const dynamic = "force-dynamic";

/** Liveness probe for load balancers / Docker. No config or secrets are reported. */
export async function GET() {
  return Response.json({ ok: true, at: new Date().toISOString() });
}
