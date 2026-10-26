import { listBankAccounts, setDepositCard } from "@/lib/app/user-data";
import { jsonError, requireCoreUserId } from "@/lib/core/http";

export const dynamic = "force-dynamic";

/** Read-only: cards are added (and their IBAN fetched) through /api/kyc/bank. */
export async function GET() {
  try {
    const userId = await requireCoreUserId();
    return Response.json({ ok: true, bankAccounts: await listBankAccounts(userId) });
  } catch (err) {
    return jsonError(err);
  }
}

/** Pick the deposit card: { depositCardId }. Cards themselves are added via /api/kyc/bank. */
export async function PATCH(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as { depositCardId?: string };
    if (!body.depositCardId) return Response.json({ ok: false, error: "card_required" }, { status: 400 });
    await setDepositCard(userId, body.depositCardId);
    return Response.json({ ok: true, bankAccounts: await listBankAccounts(userId) });
  } catch (err) {
    return jsonError(err);
  }
}
