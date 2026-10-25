import { finnotechCall, FinnotechError } from "@/lib/finnotech/client";
import { FINNOTECH_SCOPE } from "@/lib/finnotech/config";
import { finnotechClientId } from "@/lib/finnotech/config";

/**
 * Card and IBAN ownership, both matched to the national id already stored
 * after Shahkar.
 *
 * Card (scope kyc:card-owner-verification:post):
 *   POST /kyc/v2/clients/{clientId}/cardOwnerVerification
 * IBAN (scope kyc:iban-owner-verification:get):
 *   GET /kyc/v2/clients/{clientId}/ibanOwnerVerification
 */

export type OwnershipMatch = { matched: boolean; trackId: string };

function clientPath() {
  return `/kyc/v2/clients/${encodeURIComponent(finnotechClientId())}`;
}

function interpret(result: { isValid?: boolean; matched?: boolean }) {
  if (result.isValid === true || result.matched === true) return true;
  if (result.isValid === false || result.matched === false) return false;
  throw new FinnotechError("bank_unrecognized", 200);
}

export async function verifyCardOwner(card: string, nationalCode: string): Promise<OwnershipMatch> {
  const checked = await finnotechCall<{ isValid?: boolean; matched?: boolean }>({
    method: "POST",
    path: `${clientPath()}/cardOwnerVerification`,
    scopes: FINNOTECH_SCOPE.cardOwner,
    body: { card, nationalCode },
    idempotent: false,
  });
  return { matched: interpret(checked.result), trackId: checked.trackId };
}

export async function verifyIbanOwner(iban: string, nationalCode: string): Promise<OwnershipMatch> {
  const checked = await finnotechCall<{ isValid?: boolean; matched?: boolean }>({
    method: "GET",
    path: `${clientPath()}/ibanOwnerVerification`,
    scopes: FINNOTECH_SCOPE.ibanOwner,
    query: { iban, nationalCode },
  });
  return { matched: interpret(checked.result), trackId: checked.trackId };
}
