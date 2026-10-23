"use client";

import { useEffect } from "react";

/**
 * @serwist/next tries to inject registration into webpack entries named
 * `main-app` / `main.js`. Next 15.5 does not expose those entry names, so the
 * generated worker never starts. Register it here instead.
 * Development stays on Turbopack and does not emit /sw.js.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      console.error("service worker registration failed", error);
    });
  }, []);
  return null;
}
