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

/**
 * IBAN of the account behind a card (withdrawals go only there).
 *
 *   GET /facility/v2/clients/{clientId}/cardToIban?version=2&card=...
 *   scope facility:card-to-iban:get
 *   result { IBAN, bankName, deposit, card, depositStatus, depositOwners }
 *   depositStatus "02" = active; 03 blocked but can receive; others cannot receive.
 */
export type CardIban = {
  iban: string;
  bankName: string | null;
  owners: string | null;
  depositStatus: string | null;
  trackId: string;
};

type CardToIbanResult = {
  IBAN?: string;
  iban?: string;
  bankName?: string;
  depositStatus?: string;
  depositOwners?: string | string[] | { firstName?: string; lastName?: string }[];
};

export function parseCardIban(result: CardToIbanResult, trackId: string): CardIban {
  const iban = String(result.IBAN ?? result.iban ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^IR\d{24}$/.test(iban)) throw new FinnotechError("bank_unrecognized", 200);
  const raw = result.depositOwners;
  const owners = Array.isArray(raw)
    ? raw
        .map((o) => (typeof o === "string" ? o : `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim()))
        .filter(Boolean)
        .join("، ")
    : typeof raw === "string"
      ? raw.trim()
      : "";
  return {
    iban,
    bankName: result.bankName?.trim() || null,
    owners: owners || null,
    depositStatus: result.depositStatus?.trim() || null,
    trackId,
  };
}

/** Accounts that can receive a transfer (02 active, 03 blocked for withdrawal only). */
export function ibanCanReceive(depositStatus: string | null) {
  return depositStatus === null || depositStatus === "02" || depositStatus === "03";
}

export async function cardToIban(card: string): Promise<CardIban> {
  const res = await finnotechCall<CardToIbanResult>({
    method: "GET",
    path: `/facility/v2/clients/${encodeURIComponent(finnotechClientId())}/cardToIban`,
    scopes: FINNOTECH_SCOPE.cardToIban,
    query: { version: "2", card },
    idempotent: true,
  });
  return parseCardIban(res.result, res.trackId);
}
