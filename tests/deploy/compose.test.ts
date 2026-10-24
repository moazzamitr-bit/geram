import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("self-host compose network", () => {
  it("keeps the app on deploy_default and the external supabase network", () => {
    const compose = readFileSync("deploy/docker-compose.yml", "utf8");
    const app = compose.slice(compose.indexOf("  app:"), compose.indexOf("  caddy:"));
    expect(app).toContain("networks:");
    expect(app).toMatch(/networks:\n\s*- default\n\s*- supabase\n/);
    expect(compose).toContain("external: true");
    expect(compose).toMatch(/supabase:\n    external: true\n    name: supabase_default\n/);
    const caddy = compose.slice(compose.indexOf("  caddy:"), compose.indexOf("volumes:"));
    expect(caddy).not.toContain("supabase");
  });
});
