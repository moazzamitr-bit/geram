import { getExecutionMode, getFeatureFlags, sandboxDepositAllowed } from "@/lib/core/mode";
import { WalletClient } from "./wallet-client";

export const dynamic = "force-dynamic";

export default function WalletPage() {
  let selfDepositEnabled = false;
  try {
    selfDepositEnabled = sandboxDepositAllowed(getExecutionMode(), getFeatureFlags());
  } catch {
    selfDepositEnabled = false;
  }
  return <WalletClient selfDepositEnabled={selfDepositEnabled} />;
}
