import { describe, expect, it } from "vitest";
import {
  ExecutionModeError,
  getFeatureFlags,
  isDeployedEnvironment,
  resolveExecutionMode,
  sandboxSeedAllowed,
  CONSERVATIVE_FLAGS,
  SANDBOX_FLAGS,
} from "@/lib/core/mode";

describe("execution mode fail-closed", () => {
  it("defaults to SANDBOX only in a clearly local environment", () => {
    expect(resolveExecutionMode({})).toBe("SANDBOX");
    expect(isDeployedEnvironment({})).toBe(false);
  });

  it("rejects missing mode on Vercel", () => {
    expect(() => resolveExecutionMode({ VERCEL: "1" })).toThrow(ExecutionModeError);
  });

  it("rejects missing mode in CI", () => {
    expect(() => resolveExecutionMode({ CI: "true" })).toThrow(ExecutionModeError);
  });

  it("rejects unknown mode strings", () => {
    expect(() => resolveExecutionMode({ GERAM_EXECUTION_MODE: "PROD" })).toThrow(
      ExecutionModeError
    );
  });

  it("accepts explicit PRODUCTION", () => {
    expect(resolveExecutionMode({ GERAM_EXECUTION_MODE: "PRODUCTION", VERCEL: "1" })).toBe(
      "PRODUCTION"
    );
  });
});

describe("conservative feature flags", () => {
  it("defaults demo flags OFF in PRODUCTION even if env tries to enable seed/deposit", () => {
    const flags = getFeatureFlags("PRODUCTION", {
      SANDBOX_SEED_ENABLED: "true",
      SANDBOX_DEPOSIT_ENABLED: "true",
      DCA_ENABLED: "true",
    });
    expect(flags.SANDBOX_SEED_ENABLED).toBe(false);
    expect(flags.SANDBOX_DEPOSIT_ENABLED).toBe(false);
    expect(flags.DCA_ENABLED).toBe(true); // explicit env still honored for unused flags
    expect(getFeatureFlags("PRODUCTION", {}).DCA_ENABLED).toBe(false);
    expect(getFeatureFlags("PRODUCTION", {}).GOALS_ENABLED).toBe(false);
    expect(getFeatureFlags("CLOSED_BETA", {}).REFERRAL_ENABLED).toBe(false);
    expect(sandboxSeedAllowed("PRODUCTION", { ...SANDBOX_FLAGS, SANDBOX_SEED_ENABLED: true })).toBe(
      false
    );
  });

  it("keeps SANDBOX demo UI flags on by default but seed off unless explicit", () => {
    expect(SANDBOX_FLAGS.GOALS_ENABLED).toBe(true);
    expect(SANDBOX_FLAGS.SANDBOX_SEED_ENABLED).toBe(false);
    expect(CONSERVATIVE_FLAGS.SANDBOX_DEPOSIT_ENABLED).toBe(false);
    expect(getFeatureFlags("SANDBOX", {}).SANDBOX_SEED_ENABLED).toBe(false);
    expect(getFeatureFlags("SANDBOX", { SANDBOX_SEED_ENABLED: "true" }).SANDBOX_SEED_ENABLED).toBe(
      true
    );
  });
});
