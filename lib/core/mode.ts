export type ExecutionMode = "SANDBOX" | "CLOSED_BETA" | "PRODUCTION";

export type FeatureFlags = {
  GOALS_ENABLED: boolean;
  DCA_ENABLED: boolean;
  ALERT_AUTOBUY_ENABLED: boolean;
  REFERRAL_ENABLED: boolean;
  GERAM_PLUS_ENABLED: boolean;
  PHYSICAL_REDEMPTION_ENABLED: boolean;
  SANDBOX_DEPOSIT_ENABLED: boolean;
  SANDBOX_SEED_ENABLED: boolean;
};

export type KillSwitches = {
  TRADING_ENABLED: boolean;
  DEPOSIT_ENABLED: boolean;
  WITHDRAWAL_ENABLED: boolean;
  GOLD_BUY_ENABLED: boolean;
  GOLD_SELL_ENABLED: boolean;
  SILVER_BUY_ENABLED: boolean;
  SILVER_SELL_ENABLED: boolean;
  COPPER_BUY_ENABLED: boolean;
  COPPER_SELL_ENABLED: boolean;
};

export const KILL_SWITCH_KEYS: (keyof KillSwitches)[] = [
  "TRADING_ENABLED",
  "DEPOSIT_ENABLED",
  "WITHDRAWAL_ENABLED",
  "GOLD_BUY_ENABLED",
  "GOLD_SELL_ENABLED",
  "SILVER_BUY_ENABLED",
  "SILVER_SELL_ENABLED",
  "COPPER_BUY_ENABLED",
  "COPPER_SELL_ENABLED",
];

export const DEFAULT_KILLS: KillSwitches = {
  TRADING_ENABLED: true,
  DEPOSIT_ENABLED: true,
  WITHDRAWAL_ENABLED: false,
  GOLD_BUY_ENABLED: true,
  GOLD_SELL_ENABLED: true,
  SILVER_BUY_ENABLED: true,
  SILVER_SELL_ENABLED: true,
  COPPER_BUY_ENABLED: true,
  COPPER_SELL_ENABLED: true,
};

export const SANDBOX_FLAGS: FeatureFlags = {
  GOALS_ENABLED: true,
  DCA_ENABLED: false,
  ALERT_AUTOBUY_ENABLED: false,
  REFERRAL_ENABLED: true,
  GERAM_PLUS_ENABLED: true,
  PHYSICAL_REDEMPTION_ENABLED: false,
  SANDBOX_DEPOSIT_ENABLED: true,
  SANDBOX_SEED_ENABLED: false,
};

export const CONSERVATIVE_FLAGS: FeatureFlags = {
  GOALS_ENABLED: false,
  DCA_ENABLED: false,
  ALERT_AUTOBUY_ENABLED: false,
  REFERRAL_ENABLED: false,
  GERAM_PLUS_ENABLED: false,
  PHYSICAL_REDEMPTION_ENABLED: false,
  SANDBOX_DEPOSIT_ENABLED: false,
  SANDBOX_SEED_ENABLED: false,
};

export class ExecutionModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionModeError";
  }
}

export type EnvLike = Record<string, string | undefined>;

export function isDeployedEnvironment(env: EnvLike = process.env): boolean {
  if (env.GERAM_REQUIRE_EXPLICIT_MODE === "true") return true;
  if (env.VERCEL === "1") return true;
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") {
    return true;
  }
  if (env.CI === "true" || env.CI === "1") return true;
  if (env.GERAM_DEPLOYED === "true") return true;
  return false;
}

export function resolveExecutionMode(env: EnvLike = process.env): ExecutionMode {
  const raw = env.GERAM_EXECUTION_MODE?.trim();
  if (raw === "PRODUCTION" || raw === "CLOSED_BETA" || raw === "SANDBOX") {
    return raw;
  }
  if (raw) {
    throw new ExecutionModeError(
      `Unknown GERAM_EXECUTION_MODE="${raw}". Expected SANDBOX, CLOSED_BETA, or PRODUCTION.`
    );
  }
  if (isDeployedEnvironment(env)) {
    throw new ExecutionModeError(
      "GERAM_EXECUTION_MODE is required in deployed/CI environments and must be SANDBOX, CLOSED_BETA, or PRODUCTION."
    );
  }
  return "SANDBOX";
}

export function parseExecutionMode(raw: string | undefined): ExecutionMode {
  return resolveExecutionMode({ GERAM_EXECUTION_MODE: raw });
}

export function getExecutionMode(): ExecutionMode {
  return resolveExecutionMode();
}

function envBool(env: EnvLike, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

export function getFeatureFlags(
  mode: ExecutionMode = getExecutionMode(),
  env: EnvLike = process.env
): FeatureFlags {
  const base = mode === "SANDBOX" ? SANDBOX_FLAGS : CONSERVATIVE_FLAGS;
  const flags: FeatureFlags = {
    GOALS_ENABLED: envBool(env, "GOALS_ENABLED", base.GOALS_ENABLED),
    DCA_ENABLED: envBool(env, "DCA_ENABLED", base.DCA_ENABLED),
    ALERT_AUTOBUY_ENABLED: envBool(env, "ALERT_AUTOBUY_ENABLED", base.ALERT_AUTOBUY_ENABLED),
    REFERRAL_ENABLED: envBool(env, "REFERRAL_ENABLED", base.REFERRAL_ENABLED),
    GERAM_PLUS_ENABLED: envBool(env, "GERAM_PLUS_ENABLED", base.GERAM_PLUS_ENABLED),
    PHYSICAL_REDEMPTION_ENABLED: envBool(
      env,
      "PHYSICAL_REDEMPTION_ENABLED",
      base.PHYSICAL_REDEMPTION_ENABLED
    ),
    SANDBOX_DEPOSIT_ENABLED: envBool(env, "SANDBOX_DEPOSIT_ENABLED", base.SANDBOX_DEPOSIT_ENABLED),
    SANDBOX_SEED_ENABLED: envBool(env, "SANDBOX_SEED_ENABLED", base.SANDBOX_SEED_ENABLED),
  };
  if (mode === "PRODUCTION") {
    flags.SANDBOX_SEED_ENABLED = false;
    flags.SANDBOX_DEPOSIT_ENABLED = false;
  }
  return flags;
}

export function sandboxDepositAllowed(mode: ExecutionMode, flags: FeatureFlags) {
  return mode !== "PRODUCTION" && flags.SANDBOX_DEPOSIT_ENABLED;
}

export function sandboxSeedAllowed(mode: ExecutionMode, flags: FeatureFlags) {
  if (mode !== "SANDBOX") return false;
  return flags.SANDBOX_SEED_ENABLED;
}

export function getKillSwitches(env: EnvLike = process.env): KillSwitches {
  return {
    TRADING_ENABLED: envBool(env, "TRADING_ENABLED", true),
    DEPOSIT_ENABLED: envBool(env, "DEPOSIT_ENABLED", true),
    WITHDRAWAL_ENABLED: envBool(env, "WITHDRAWAL_ENABLED", false),
    GOLD_BUY_ENABLED: envBool(env, "GOLD_BUY_ENABLED", true),
    GOLD_SELL_ENABLED: envBool(env, "GOLD_SELL_ENABLED", true),
    SILVER_BUY_ENABLED: envBool(env, "SILVER_BUY_ENABLED", true),
    SILVER_SELL_ENABLED: envBool(env, "SILVER_SELL_ENABLED", true),
    COPPER_BUY_ENABLED: envBool(env, "COPPER_BUY_ENABLED", true),
    COPPER_SELL_ENABLED: envBool(env, "COPPER_SELL_ENABLED", true),
  };
}

export function assertAssetSideEnabled(
  kills: KillSwitches,
  asset: "GOLD" | "SILVER" | "COPPER" | "TEST_METAL",
  side: "BUY" | "SELL"
) {
  if (!kills.TRADING_ENABLED) {
    throw new Error("TRADING_DISABLED");
  }
  if (asset === "TEST_METAL") return;
  const key = `${asset}_${side}_ENABLED` as keyof KillSwitches;
  if (!kills[key]) {
    throw new Error(`${key}_DISABLED`);
  }
}

export function postgresRequired(mode: ExecutionMode) {
  return mode === "CLOSED_BETA" || mode === "PRODUCTION";
}
