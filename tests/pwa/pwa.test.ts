import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isBypassedRequest,
  isPageNavigation,
  isStaticAssetPath,
  shouldStorePage,
} from "@/lib/pwa/cache-policy";
import { installCopy } from "@/lib/pwa/copy";
import { installSurface, isIosUserAgent } from "@/lib/pwa/install-prompt";

function pngSize(buf: Buffer) {
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
  };
}

describe("pwa cache policy", () => {
  it("never stores financial, auth, or Supabase proxy URLs", () => {
    const blocked = [
      "https://geram.co/api/core/wallet",
      "https://geram.co/api/core/quotes",
      "https://geram.co/api/core/trades",
      "https://geram.co/api/market/price",
      "https://geram.co/api/auth/password-login",
      "https://geram.co/api/auth/register",
      "https://geram.co/sb/auth/v1/token",
      "https://geram.co/sb/rest/v1/profiles",
      "https://geram.co/auth/v1/user",
    ];
    for (const href of blocked) {
      expect(isBypassedRequest(new URL(href)), href).toBe(true);
      expect(
        isPageNavigation({ mode: "navigate", destination: "document" }, new URL(href)),
        href
      ).toBe(false);
    }
  });

  it("allows the app shell and static files", () => {
    expect(isBypassedRequest(new URL("https://geram.co/app/dashboard"))).toBe(false);
    expect(isBypassedRequest(new URL("https://geram.co/offline"))).toBe(false);
    expect(isStaticAssetPath("/icons/icon-192.png")).toBe(true);
    expect(isStaticAssetPath("/api/core/wallet")).toBe(false);
    expect(
      isPageNavigation(
        { mode: "navigate", destination: "document" },
        new URL("https://geram.co/app/dashboard")
      )
    ).toBe(true);
    expect(
      isPageNavigation({ mode: "cors", destination: "" }, new URL("https://geram.co/app/dashboard"))
    ).toBe(false);
  });

  it("rejects redirected and non-html page responses", () => {
    expect(
      shouldStorePage({
        status: 200,
        redirected: true,
        url: "https://geram.co/auth/login",
        contentType: "text/html",
      })
    ).toBe(false);
    expect(
      shouldStorePage({
        status: 200,
        redirected: false,
        url: "https://geram.co/api/core/wallet",
        contentType: "application/json",
      })
    ).toBe(false);
    expect(
      shouldStorePage({
        status: 200,
        redirected: false,
        url: "https://geram.co/app/dashboard",
        contentType: "text/html; charset=utf-8",
      })
    ).toBe(true);
  });

  it("keeps the worker off the default Next cache that stores GET /api", () => {
    const sw = readFileSync("app/sw.ts", "utf8");
    expect(sw).not.toContain("defaultCache");
    expect(sw).toContain("NetworkOnly");
    expect(sw.indexOf("matcher: ({ url }) => isBypassedRequest(url)")).toBeLessThan(
      sw.indexOf("new NetworkFirst")
    );
    expect(sw).toContain('url: "/offline.html"');
  });
});

describe("install prompt", () => {
  it("detects iOS and iPadOS", () => {
    expect(isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(false);
    expect(isIosUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
  });

  it("picks a surface and stays quiet once dismissed or installed", () => {
    expect(installSurface({ standalone: false, dismissed: false, ios: true, canPrompt: false })).toBe(
      "ios"
    );
    expect(installSurface({ standalone: false, dismissed: false, ios: false, canPrompt: true })).toBe(
      "android"
    );
    expect(installSurface({ standalone: true, dismissed: false, ios: true, canPrompt: true })).toBe(
      "hidden"
    );
    expect(installSurface({ standalone: false, dismissed: true, ios: false, canPrompt: true })).toBe(
      "hidden"
    );
    expect(installSurface({ standalone: false, dismissed: false, ios: false, canPrompt: false })).toBe(
      "hidden"
    );
  });

  it("uses Persian copy", () => {
    expect(installCopy.androidTitle).toMatch(/گرم/);
    expect(installCopy.iosBody).toContain("افزودن به صفحه اصلی");
    expect(installCopy.androidBody).toContain("آفلاین");
  });
});

describe("manifest and icons", () => {
  it("uses the cream logged-in shell, portrait, and maskable icons", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(manifest.background_color).toBe("#F6F4F1");
    expect(manifest.theme_color).toBe("#F6F4F1");
    expect(manifest.theme_color).not.toBe("#080B0D");
    expect(manifest.orientation).toBe("portrait-primary");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/app/dashboard");
    expect(manifest.dir).toBe("rtl");
    const maskable = manifest.icons.filter((icon: { purpose: string }) => icon.purpose === "maskable");
    expect(maskable.map((icon: { sizes: string }) => icon.sizes).sort()).toEqual(["192x192", "512x512"]);
  });

  it("ships opaque maskable, apple-touch, and two splash sizes", () => {
    const maskable192 = pngSize(readFileSync("public/icons/icon-maskable-192.png"));
    const maskable512 = pngSize(readFileSync("public/icons/icon-maskable-512.png"));
    const touch = pngSize(readFileSync("public/icons/apple-touch-icon.png"));
    const splashSmall = pngSize(readFileSync("public/splash/apple-splash-1170x2532.png"));
    const splashLarge = pngSize(readFileSync("public/splash/apple-splash-1290x2796.png"));
    expect(maskable192).toMatchObject({ width: 192, height: 192, colorType: 2 });
    expect(maskable512).toMatchObject({ width: 512, height: 512, colorType: 2 });
    expect(touch).toMatchObject({ width: 180, height: 180, colorType: 2 });
    expect(splashSmall).toMatchObject({ width: 1170, height: 2532, colorType: 2 });
    expect(splashLarge).toMatchObject({ width: 1290, height: 2796, colorType: 2 });
  });
});

describe("service worker registration", () => {
  it("registers /sw.js from the app shell instead of the broken webpack entry hook", () => {
    const registrar = readFileSync("components/pwa/RegisterServiceWorker.tsx", "utf8");
    const config = readFileSync("next.config.ts", "utf8");
    expect(registrar).toContain('register("/sw.js"');
    expect(registrar).toContain('scope: "/"');
    expect(registrar).toContain('NODE_ENV !== "production"');
    expect(config).toContain("register: false");
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("RegisterServiceWorker");
  });
});

describe("offline page", () => {
  it("is Persian, RTL, and cream, and says trades are not stored offline", () => {
    const html = readFileSync("public/offline.html", "utf8");
    expect(html).toContain('lang="fa"');
    expect(html).toContain('dir="rtl"');
    expect(html.toLowerCase()).toContain("#f6f4f1");
    expect(html).toContain("اتصال اینترنت برقرار نیست");
    expect(html).toContain("آفلاین ذخیره نمی‌شود");
    expect(html).not.toContain("gerami.com");
  });
});
