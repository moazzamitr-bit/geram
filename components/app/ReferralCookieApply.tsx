"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Applies an invite code saved by /r/<code> once the user is signed in, then forgets it.
 * A gift link (/g/<code>) opened before sign-in sends the user to the redeem screen.
 */
export function ReferralCookieApply() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!user || pathname === "/app/gift") return;
    if (/(?:^|; )geram_gift=GRM-/.test(document.cookie)) router.push("/app/gift");
  }, [user, pathname, router]);
  useEffect(() => {
    if (!user) return;
    const m = document.cookie.match(/(?:^|; )geram_ref=([A-Z0-9]{4,16})/);
    if (!m) return;
    document.cookie = "geram_ref=; path=/; max-age=0; secure; samesite=lax";
    void fetch("/api/referral/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: m[1] }),
    }).catch(() => undefined);
  }, [user]);
  return null;
}
