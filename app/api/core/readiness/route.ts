import { jsonError } from "@/lib/core/http";
import { ExecutionModeError } from "@/lib/core/mode";
import { readinessSnapshot } from "@/lib/core/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = readinessSnapshot();
    const ready =
      snapshot.executionMode != null &&
      (snapshot.executionMode === "SANDBOX" || snapshot.databaseBacked);
    return Response.json(
      { ok: ready, ready, ...snapshot },
      { status: ready ? 200 : 503 }
    );
  } catch (err) {
    if (err instanceof ExecutionModeError) {
      return Response.json(
        {
          ok: false,
          ready: false,
          error: "execution_mode_required",
          message: err.message,
          executionMode: null,
          databaseBacked: false,
          sandboxSeedEnabled: false,
          marketDataProductionApproved: false,
          financialWritesAllowed: false,
        },
        { status: 503 }
      );
    }
    return jsonError(err);
  }
}
