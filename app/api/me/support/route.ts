import { createTicket, listTickets } from "@/lib/app/user-data";
import { jsonError, requireCoreUserId } from "@/lib/core/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    return Response.json({ ok: true, tickets: await listTickets(userId) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = await createTicket(userId, body);
    return Response.json({ ok: true, id, message: "تیکت ثبت شد. پاسخ پشتیبانی همین‌جا نمایش داده می‌شود." });
  } catch (err) {
    return jsonError(err);
  }
}
