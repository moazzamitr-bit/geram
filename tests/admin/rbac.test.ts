import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLES,
  NEVER_ISSUED_PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  isNeverIssuedPermission,
  roleFromProfileRole,
} from "@/lib/admin/rbac";
import { listProviders } from "@/lib/admin/providers";

describe("admin RBAC", () => {
  it("never issues wallet.edit or balance.edit", () => {
    for (const perm of NEVER_ISSUED_PERMISSIONS) {
      expect(isNeverIssuedPermission(perm)).toBe(true);
    }
    for (const role of ADMIN_ROLES) {
      const granted = ROLE_PERMISSIONS[role] as string[];
      expect(granted).not.toContain("wallet.edit");
      expect(granted).not.toContain("balance.edit");
    }
  });

  it("maps legacy profiles.role=admin to SUPER_ADMIN", () => {
    expect(roleFromProfileRole("admin")).toBe("SUPER_ADMIN");
    expect(roleFromProfileRole("user")).toBeNull();
    expect(roleFromProfileRole("KYC_REVIEWER")).toBe("KYC_REVIEWER");
  });

  it("does not let KYC reviewer freely set VERIFIED", () => {
    expect(hasPermission("KYC_REVIEWER", "kyc.review")).toBe(true);
    expect(hasPermission("KYC_REVIEWER", "kyc.approve_verified")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "kyc.approve_verified")).toBe(true);
  });

  it("keeps auditor read-only for writes", () => {
    expect(hasPermission("AUDITOR_READONLY", "audit.view")).toBe(true);
    expect(hasPermission("AUDITOR_READONLY", "switches.write")).toBe(false);
    expect(hasPermission("AUDITOR_READONLY", "settings.write")).toBe(false);
    expect(hasPermission("AUDITOR_READONLY", "kyc.review")).toBe(false);
    expect(hasPermission("AUDITOR_READONLY", "support.reply")).toBe(false);
  });

  it("does not let support agents toggle kill switches", () => {
    expect(hasPermission("SUPPORT_AGENT", "support.reply")).toBe(true);
    expect(hasPermission("SUPPORT_AGENT", "switches.write")).toBe(false);
    expect(hasPermission("SUPPORT_AGENT", "treasury.write")).toBe(false);
  });
});

describe("provider honesty", () => {
  it("never marks MOCK providers production-approved", () => {
    for (const p of listProviders()) {
      if (p.mode === "MOCK") {
        expect(p.productionApproved).toBe(false);
        expect(p.health).not.toBe("LIVE");
      }
    }
  });
});
