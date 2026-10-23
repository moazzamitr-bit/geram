import { afterEach, describe, expect, it, vi } from "vitest";

const sandboxDeposit = vi.fn(async () => ({ id: "dep-1", trackingCode: "GRM-1" }));

vi.mock("@/lib/core/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/core/http")>("@/lib/core/http");
  return {
    ...actual,
    requireCoreUserId: vi.fn(async () => "user-1"),
  };
});

vi.mock("@/lib/core/runtime", () => ({
  getFinancialCore: () => ({ sandboxDeposit }),
}));

import { POST } from "@/app/api/core/sandbox/deposit/route";

function depositRequest() {
  return new Request("http://localhost/api/core/sandbox/deposit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ toman: 1000, idempotencyKey: "idem-route-1" }),
  });
}

describe("POST /api/core/sandbox/deposit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sandboxDeposit.mockClear();
  });

  it("blocks an authenticated user when self-deposit is disabled", async () => {
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    vi.stubEnv("SANDBOX_DEPOSIT_ENABLED", "false");
    const res = await POST(depositRequest());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: "sandbox_deposit_blocked",
    });
    expect(sandboxDeposit).not.toHaveBeenCalled();
  });

  it("still reaches the ledger only when SANDBOX_DEPOSIT_ENABLED=true", async () => {
    vi.stubEnv("GERAM_EXECUTION_MODE", "SANDBOX");
    vi.stubEnv("SANDBOX_DEPOSIT_ENABLED", "true");
    const res = await POST(depositRequest());
    expect(res.status).toBe(200);
    expect(sandboxDeposit).toHaveBeenCalledOnce();
  });
});
