import { finnotechCall, FinnotechError } from "@/lib/finnotech/client";
import { FINNOTECH_SCOPE, finnotechClientId } from "@/lib/finnotech/config";

/**
 * Card ownership against the national code already verified by Shahkar and
 * the civil registry (which used the same national code + birth date).
 *
 *   POST /kyc/v2/clients/{clientId}/cardOwnerVerification
 *   scope kyc:card-owner-verification:post
 *   body { card, nid } -> result { isValid }
 */

export type OwnershipMatch = { matched: boolean; trackId: string };

export async function verifyCardOwner(card: string, nationalCode: string): Promise<OwnershipMatch> {
  const checked = await finnotechCall<{ isValid?: boolean }>({
    method: "POST",
    path: `/kyc/v2/clients/${encodeURIComponent(finnotechClientId())}/cardOwnerVerification`,
    scopes: FINNOTECH_SCOPE.cardOwner,
    body: { card, nid: nationalCode },
    idempotent: false,
  });
  if (checked.result.isValid === true) return { matched: true, trackId: checked.trackId };
  if (checked.result.isValid === false) return { matched: false, trackId: checked.trackId };
  throw new FinnotechError("bank_unrecognized", 200);
}
