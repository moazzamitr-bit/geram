import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/admin/rbac";
import { parsePlanTier, planTierPatch } from "@/lib/admin/plan-tier";

describe("admin plan tier", () => {
  it("revokes Plus by clearing the tier and its expiry", () => {
    expect(parsePlanTier("PLUS")).toBe("plus");
    expect(parsePlanTier("nope")).toBeNull();
    expect(planTierPatch("free")).toEqual({ plan_tier: "free", plan_expires_at: null });
    expect(planTierPatch("plus")).toEqual({ plan_tier: "plus", plan_expires_at: null });
  });

  it("is a super-admin action", () => {
    expect(hasPermission("SUPER_ADMIN", "user.plan")).toBe(true);
    expect(hasPermission("SUPPORT_AGENT", "user.plan")).toBe(false);
    expect(hasPermission("AUDITOR_READONLY", "user.plan")).toBe(false);
  });
});
