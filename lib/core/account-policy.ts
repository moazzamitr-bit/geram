import type { LedgerAsset } from "./assets";
import { ALL_ASSETS } from "./assets";
import {
  CoreError,
  isOpeningRefType,
  type AccountCode,
  type JournalEntry,
} from "./types";

const IRR_ONLY: AccountCode[] = [
  "PLATFORM_FEE_REVENUE",
  "PAYMENT_GATEWAY_CLEARING",
  "BANK_SETTLEMENT_CLEARING",
  "PLATFORM_CASH_CONTROL",
];

const HOLDER_USER: AccountCode[] = ["USER_AVAILABLE", "USER_RESERVED"];
const HOLDER_PLATFORM: AccountCode[] = [
  "PLATFORM_AVAILABLE",
  "PLATFORM_RESERVED",
  "PLATFORM_CLEARING",
  "PLATFORM_FEE_REVENUE",
  "PAYMENT_GATEWAY_CLEARING",
  "BANK_SETTLEMENT_CLEARING",
  "PLATFORM_CASH_CONTROL",
  "PLATFORM_OPENING",
  "PLATFORM_RESTRICTED",
];

export function allowedAssetsForAccount(code: AccountCode): LedgerAsset[] {
  if (IRR_ONLY.includes(code)) return ["IRR"];
  return ["IRR", ...ALL_ASSETS];
}

export function assertAccountPolicy(
  holderId: string,
  accountCode: AccountCode,
  asset: LedgerAsset,
  platformHolderId: string
) {
  const allowed = allowedAssetsForAccount(accountCode);
  if (!allowed.includes(asset)) {
    throw new CoreError(
      "invalid_account",
      `${accountCode} cannot hold ${asset}`,
      400
    );
  }
  if (HOLDER_USER.includes(accountCode) && holderId === platformHolderId) {
    throw new CoreError("invalid_account", "USER_* accounts cannot use the platform holder");
  }
  if (HOLDER_PLATFORM.includes(accountCode) && holderId !== platformHolderId) {
    throw new CoreError(
      "invalid_account",
      `${accountCode} must use the platform holder`
    );
  }
}

export { IRR_ONLY };

export function journalUsesOpening(entry: JournalEntry): boolean {
  return entry.lines.some((l) => l.accountCode === "PLATFORM_OPENING");
}

/**
 * PLATFORM_OPENING may only appear on SYSTEM_SEED / MIGRATION / APPROVED_OPENING_BALANCE.
 * Runtime Trade / Deposit / reservation journals must never use Opening.
 */
export function assertOpeningPostingAllowed(entry: JournalEntry): void {
  const usesOpening = journalUsesOpening(entry);
  if (!usesOpening) return;
  if (!isOpeningRefType(entry.refType)) {
    throw new CoreError(
      "opening_forbidden",
      "PLATFORM_OPENING is only postable for SYSTEM_SEED, MIGRATION, or APPROVED_OPENING_BALANCE",
      403
    );
  }
}

export function assertSystemSeedAllowed(mode: "SANDBOX" | "CLOSED_BETA" | "PRODUCTION"): void {
  if (mode !== "SANDBOX") {
    throw new CoreError(
      "opening_forbidden",
      "SYSTEM_SEED is sandbox-only",
      403
    );
  }
}
