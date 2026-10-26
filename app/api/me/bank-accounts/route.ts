import { addBankAccount, listBankAccounts } from "@/lib/app/user-data";
import { jsonError, requireCoreUserId } from "@/lib/core/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    return Response.json({ ok: true, bankAccounts: await listBankAccounts(userId) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await addBankAccount(userId, body);
    return Response.json({ ok: true, message: "حساب ثبت شد. تأیید مالکیت شبا هنوز انجام نشده است." });
  } catch (err) {
    return jsonError(err);
  }
}
