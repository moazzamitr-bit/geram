"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
} from "@/lib/commerce/types";
import type { KycStatus } from "@/lib/auth/auth-context";

export type UserCommerce = {
  planTier: "free" | "plus";
  plusActive: boolean;
  referralCode: string | null;
  kycStatus: KycStatus;
};

export function useCommerce() {
  const [settings, setSettings] = useState<CommerceSettings>(
    DEFAULT_COMMERCE_SETTINGS
  );
  const [userCommerce, setUserCommerce] = useState<UserCommerce>({
    planTier: "free",
    plusActive: false,
    referralCode: null,
    kycStatus: "UNVERIFIED",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [settingsRes, planRes] = await Promise.all([
          fetch("/api/commerce/settings", { cache: "no-store" }),
          fetch("/api/commerce/plan", { cache: "no-store" }),
        ]);
        if (settingsRes.ok) {
          const data = (await settingsRes.json()) as CommerceSettings;
          if (!cancelled) setSettings(data);
        }
        if (planRes.ok) {
          const data = (await planRes.json()) as {
            planTier: "free" | "plus";
            referralCode: string | null;
            kycStatus: KycStatus;
          };
          if (!cancelled) {
            setUserCommerce({
              planTier: data.planTier,
              plusActive: data.planTier === "plus",
              referralCode: data.referralCode,
              kycStatus: data.kycStatus ?? "UNVERIFIED",
            });
          }
        }
      } catch {
        /* defaults */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, userCommerce, loaded };
}
