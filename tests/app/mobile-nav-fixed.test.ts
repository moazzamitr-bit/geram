import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the iOS "bottom nav moves while scrolling" bug (#71, #86).
const root = join(__dirname, "..", "..");
const shell = readFileSync(join(root, "components/app/AppShell.tsx"), "utf8");
const css = readFileSync(join(root, "app/globals.css"), "utf8");

describe("mobile bottom nav stays fixed on iOS", () => {
  it("nav is portaled to <body>, outside the scroller", () => {
    const navAt = shell.indexOf('aria-label="ناوبری موبایل"');
    const portalAt = shell.lastIndexOf("createPortal(", navAt);
    expect(navAt).toBeGreaterThan(0);
    expect(portalAt).toBeGreaterThan(0);
    expect(shell.slice(navAt, shell.indexOf("document.body", navAt))).not.toContain("geram-scroll");
    expect(shell).toMatch(/fixed inset-x-0 bottom-0[^"]*pb-\[env\(safe-area-inset-bottom\)\]/);
  });

  it("app content scrolls in .geram-scroll and the document is locked", () => {
    expect(shell).toContain('className="geram-scroll"');
    expect(css).toMatch(/html:has\(\.geram-scroll\),\s*html:has\(\.geram-scroll\) body\s*\{[^}]*overflow:\s*hidden/);
    const rule = css.match(/\.geram-scroll\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/position:\s*absolute/); // fixed would trap sheet z-index
    expect(rule).toMatch(/overflow-y:\s*auto/);
    expect(rule).not.toMatch(/transform|filter|will-change|contain:/);
  });

  it("body never becomes an overflow-x:hidden scroll container", () => {
    expect(css).not.toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/);
  });
});
