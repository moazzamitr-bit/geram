import { describe, expect, it } from "vitest";
import {
  ExecutionModeError,
  getFeatureFlags,
  isDeployedEnvironment,
  resolveExecutionMode,
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
  it("defaults demo flags OFF in PRODUCTION even if env tries to enable them", () => {
    const flags = getFeatureFlags("PRODUCTION", {
      DCA_ENABLED: "true",
    });
    expect(flags.DCA_ENABLED).toBe(true);
    expect(getFeatureFlags("PRODUCTION", {}).DCA_ENABLED).toBe(false);
    expect(getFeatureFlags("PRODUCTION", {}).GOALS_ENABLED).toBe(false);
    expect(getFeatureFlags("CLOSED_BETA", {}).REFERRAL_ENABLED).toBe(false);
    expect(getFeatureFlags("CLOSED_BETA", {}).GERAM_PLUS_ENABLED).toBe(false);
    expect("SANDBOX_DEPOSIT_ENABLED" in getFeatureFlags("SANDBOX", {})).toBe(false);
    expect("SANDBOX_SEED_ENABLED" in getFeatureFlags("CLOSED_BETA", {})).toBe(false);
  });

  it("keeps SANDBOX demo UI flags on by default", () => {
    expect(SANDBOX_FLAGS.GOALS_ENABLED).toBe(true);
    expect(SANDBOX_FLAGS.REFERRAL_ENABLED).toBe(true);
    expect(getFeatureFlags("CLOSED_BETA", {}).GOALS_ENABLED).toBe(false);
  });
});
