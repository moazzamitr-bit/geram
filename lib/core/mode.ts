export type ExecutionMode = "SANDBOX" | "CLOSED_BETA" | "PRODUCTION";

export type FeatureFlags = {
  GOALS_ENABLED: boolean;
  DCA_ENABLED: boolean;
  ALERT_AUTOBUY_ENABLED: boolean;
  REFERRAL_ENABLED: boolean;
  GERAM_PLUS_ENABLED: boolean;
  PHYSICAL_REDEMPTION_ENABLED: boolean;
  SANDBOX_DEPOSIT_ENABLED: boolean;
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

export const DEFAULT_FLAGS: FeatureFlags = {
  GOALS_ENABLED: true,
  DCA_ENABLED: false,
  ALERT_AUTOBUY_ENABLED: false,
  REFERRAL_ENABLED: true,
  GERAM_PLUS_ENABLED: true,
  PHYSICAL_REDEMPTION_ENABLED: false,
  SANDBOX_DEPOSIT_ENABLED: true,
};

export function parseExecutionMode(raw: string | undefined): ExecutionMode {
  if (raw === "PRODUCTION" || raw === "CLOSED_BETA" || raw === "SANDBOX") {
    return raw;
  }
  return "SANDBOX";
}

export function getExecutionMode(): ExecutionMode {
  return parseExecutionMode(process.env.GERAM_EXECUTION_MODE);
}

export function sandboxDepositAllowed(mode: ExecutionMode, flags: FeatureFlags) {
  return mode !== "PRODUCTION" && flags.SANDBOX_DEPOSIT_ENABLED;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    ...DEFAULT_FLAGS,
    GOALS_ENABLED: process.env.GOALS_ENABLED !== "false",
    DCA_ENABLED: process.env.DCA_ENABLED === "true",
    ALERT_AUTOBUY_ENABLED: process.env.ALERT_AUTOBUY_ENABLED === "true",
    REFERRAL_ENABLED: process.env.REFERRAL_ENABLED !== "false",
    GERAM_PLUS_ENABLED: process.env.GERAM_PLUS_ENABLED !== "false",
    PHYSICAL_REDEMPTION_ENABLED: process.env.PHYSICAL_REDEMPTION_ENABLED === "true",
    SANDBOX_DEPOSIT_ENABLED: process.env.SANDBOX_DEPOSIT_ENABLED !== "false",
  };
}

export function getKillSwitches(): KillSwitches {
  const envBool = (key: string, fallback: boolean) => {
    const raw = process.env[key];
    if (raw === "true") return true;
    if (raw === "false") return false;
    return fallback;
  };
  return {
    TRADING_ENABLED: envBool("TRADING_ENABLED", true),
    DEPOSIT_ENABLED: envBool("DEPOSIT_ENABLED", true),
    WITHDRAWAL_ENABLED: envBool("WITHDRAWAL_ENABLED", false),
    GOLD_BUY_ENABLED: envBool("GOLD_BUY_ENABLED", true),
    GOLD_SELL_ENABLED: envBool("GOLD_SELL_ENABLED", true),
    SILVER_BUY_ENABLED: envBool("SILVER_BUY_ENABLED", true),
    SILVER_SELL_ENABLED: envBool("SILVER_SELL_ENABLED", true),
    COPPER_BUY_ENABLED: envBool("COPPER_BUY_ENABLED", true),
    COPPER_SELL_ENABLED: envBool("COPPER_SELL_ENABLED", true),
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
