export type AdminRole =
  | "SUPER_ADMIN"
  | "OPERATIONS_ADMIN"
  | "FINANCE_ADMIN"
  | "KYC_REVIEWER"
  | "TREASURY_ADMIN"
  | "SUPPORT_AGENT"
  | "SECURITY_ADMIN"
  | "AUDITOR_READONLY";

export type AdminPermission =
  | "user.view"
  | "kyc.view"
  | "kyc.review"
  | "kyc.approve_verified"
  | "bank.view"
  | "bank.act"
  | "trade.view"
  | "deposit.view"
  | "payout.view"
  | "treasury.view"
  | "treasury.write"
  | "procurement.view"
  | "procurement.approve"
  | "custody.view"
  | "reconciliation.view"
  | "reconciliation.resolve"
  | "support.view"
  | "support.reply"
  | "settings.view"
  | "settings.write"
  | "switches.view"
  | "switches.write"
  | "security.view"
  | "security.act"
  | "audit.view"
  | "admin.manage"
  | "search.sensitive"
  | "export.run";

/** Never create or grant these. Financial mutation is journal + maker-checker only. */
export const NEVER_ISSUED_PERMISSIONS = ["wallet.edit", "balance.edit"] as const;

const ALL: AdminPermission[] = [
  "user.view",
  "kyc.view",
  "kyc.review",
  "kyc.approve_verified",
  "bank.view",
  "bank.act",
  "trade.view",
  "deposit.view",
  "payout.view",
  "treasury.view",
  "treasury.write",
  "procurement.view",
  "procurement.approve",
  "custody.view",
  "reconciliation.view",
  "reconciliation.resolve",
  "support.view",
  "support.reply",
  "settings.view",
  "settings.write",
  "switches.view",
  "switches.write",
  "security.view",
  "security.act",
  "audit.view",
  "admin.manage",
  "search.sensitive",
  "export.run",
];

/** Explicitly never issued: wallet.edit / balance.edit */

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: ALL,
  OPERATIONS_ADMIN: [
    "user.view",
    "kyc.view",
    "bank.view",
    "trade.view",
    "deposit.view",
    "payout.view",
    "treasury.view",
    "reconciliation.view",
    "support.view",
    "settings.view",
    "switches.view",
    "audit.view",
    "export.run",
  ],
  FINANCE_ADMIN: [
    "user.view",
    "trade.view",
    "deposit.view",
    "payout.view",
    "treasury.view",
    "treasury.write",
    "reconciliation.view",
    "reconciliation.resolve",
    "settings.view",
    "audit.view",
    "export.run",
  ],
  KYC_REVIEWER: ["user.view", "kyc.view", "kyc.review", "bank.view", "bank.act", "audit.view"],
  TREASURY_ADMIN: [
    "treasury.view",
    "treasury.write",
    "procurement.view",
    "procurement.approve",
    "custody.view",
    "trade.view",
    "audit.view",
  ],
  SUPPORT_AGENT: ["user.view", "support.view", "support.reply", "trade.view"],
  SECURITY_ADMIN: [
    "user.view",
    "security.view",
    "security.act",
    "audit.view",
    "admin.manage",
    "search.sensitive",
  ],
  AUDITOR_READONLY: [
    "user.view",
    "kyc.view",
    "bank.view",
    "trade.view",
    "deposit.view",
    "payout.view",
    "treasury.view",
    "custody.view",
    "reconciliation.view",
    "support.view",
    "settings.view",
    "switches.view",
    "security.view",
    "audit.view",
    "export.run",
  ],
};

export function roleFromProfileRole(profileRole: string | null | undefined): AdminRole | null {
  if (profileRole === "admin") return "SUPER_ADMIN";
  if (profileRole && profileRole in ROLE_PERMISSIONS) return profileRole as AdminRole;
  return null;
}

export function hasPermission(role: AdminRole, permission: AdminPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isNeverIssuedPermission(permission: string) {
  return (NEVER_ISSUED_PERMISSIONS as readonly string[]).includes(permission);
}

export const ADMIN_ROLES: AdminRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "FINANCE_ADMIN",
  "KYC_REVIEWER",
  "TREASURY_ADMIN",
  "SUPPORT_AGENT",
  "SECURITY_ADMIN",
  "AUDITOR_READONLY",
];
