import { listBankAccounts } from "@/lib/app/user-data";
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
