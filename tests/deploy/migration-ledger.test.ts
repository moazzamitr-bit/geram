import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("check-db apply ledger", () => {
  const script = readFileSync("deploy/check-db.sh", "utf8");

  it("records applied files and skips them on the next run", () => {
    expect(script).toContain("geram_schema_migrations");
    expect(script).toContain("BASELINE_BEFORE=20261024210000");
    expect(script).toContain("without running them again");
    expect(script).toContain('echo "  $base ... skip"');
  });

  it("checks the ledger before applying a file", () => {
    const apply = script.slice(script.indexOf('if [ "${1:-}" = "--apply" ]'));
    const ledger = apply.indexOf("geram_schema_migrations");
    const loop = apply.indexOf("Applying migrations that are not");
    expect(ledger).toBeGreaterThan(0);
    expect(loop).toBeGreaterThan(ledger);
    expect(apply.indexOf("select 1 from public.geram_schema_migrations")).toBeLessThan(
      apply.indexOf("ON_ERROR_STOP=1 -1")
    );
  });
});
