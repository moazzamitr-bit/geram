"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const GA_ID = "G-N88DY091QX";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Never analytics on admin. */
function excluded(path: string) {
  return path === "/admin" || path.startsWith("/admin/");
}

/**
 * Path-only page location: no query string or hash (gift codes, OTP, tokens), and
 * code-bearing path segments (/g/<code>, /r/<code>) are masked. No user identifiers are sent.
 */
export function safePath(path: string) {
  const p = path.split(/[?#]/)[0] || "/";
  return p.replace(/^\/(g|r)\/[^/]+/, "/$1/:code");
}

export function GoogleAnalytics() {
  const pathname = usePathname() ?? "/";
  const off = excluded(pathname);

  useEffect(() => {
    if (off || typeof window.gtag !== "function") return;
    const path = safePath(pathname);
    const w = window as unknown as { __gaLast?: string };
    if (w.__gaLast === path) return;
    w.__gaLast = path;
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: `${location.origin}${path}`,
      page_title: document.title,
    });
  }, [pathname, off]);

  if (off) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());
var p=location.pathname.replace(/^\\/(g|r)\\/[^/]+/,'/$1/:code');
gtag('config','${GA_ID}',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
window.__gaLast=p;gtag('event','page_view',{page_path:p,page_location:location.origin+p,page_title:document.title});`}
      </Script>
    </>
  );
}
