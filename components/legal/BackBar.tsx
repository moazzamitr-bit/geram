"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

/** Sticky back bar for standalone pages (PWA standalone has no browser back). */
export function BackBar() {
  const router = useRouter();
  async function goBack() {
    let sameOrigin = false;
    try {
      sameOrigin =
        sessionStorage.getItem("geram:inapp") === "1" ||
        (!!document.referrer && new URL(document.referrer).origin === location.origin);
    } catch {}
    if (sameOrigin && window.history.length > 1) return router.back();
    let loggedIn = false;
    try {
      loggedIn = (await fetch("/api/me/notifications", { cache: "no-store" })).ok;
    } catch {}
    router.replace(loggedIn ? "/app" : "/");
  }
  return (
    <div
      dir="rtl"
      className="sticky top-0 z-30 border-b border-white/10 bg-bg/90 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-12 max-w-3xl items-center px-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="بازگشت"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-bold text-text hover:text-gold"
        >
          <ArrowRight className="h-5 w-5" />
          <span>بازگشت</span>
        </button>
      </div>
    </div>
  );
}
