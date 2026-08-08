"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

export type KycStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_UPDATE";

export type DemoUser = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  kycStatus: KycStatus;
  onboardingDone: boolean;
  hasPin: boolean;
};

type AuthState = {
  user: DemoUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  live: boolean;
  login: (phone: string, otp?: string) => Promise<{ ok: boolean; error?: string }>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  setKycStatus: (status: KycStatus) => Promise<void>;
  setHasPin: (value: boolean) => void;
};

const STORAGE_KEY = "gram_demo_session_v1";

const AuthContext = createContext<AuthState | null>(null);

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `۰${toFa(digits.slice(1, 4))}••••${toFa(digits.slice(-3))}`;
}

function toFa(input: string) {
  return input.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function profileToUser(
  profile: {
    id: string;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    kyc_status?: string | null;
    onboarding_done?: boolean | null;
  },
  fallbackPhone: string
): DemoUser {
  return {
    id: profile.id,
    firstName: profile.first_name || "کاربر",
    lastName: profile.last_name || "گرم",
    phone: profile.phone || fallbackPhone,
    kycStatus: (profile.kyc_status as KycStatus) || "UNVERIFIED",
    onboardingDone: Boolean(profile.onboarding_done),
    hasPin: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const live = hasSupabaseEnv();

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (live) {
        try {
          const supabase = createClient();
          const {
            data: { user: authUser },
          } = await supabase.auth.getUser();
          if (authUser && !cancelled) {
            const { data: profile } = await supabase
              .from("profiles")
              .select(
                "id, phone, first_name, last_name, kyc_status, onboarding_done"
              )
              .eq("id", authUser.id)
              .maybeSingle();
            if (profile) {
              setUser(
                profileToUser(
                  profile,
                  (authUser.user_metadata?.phone as string) || ""
                )
              );
              setHydrated(true);
              return;
            }
          }
        } catch {
          /* fall through to local */
        }
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) setUser(JSON.parse(raw) as DemoUser);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [live]);

  const persistLocal = useCallback((next: DemoUser | null) => {
    setUser(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    async (phone: string, otp = DEMO_OTP) => {
      const digits = phone.replace(/\D/g, "").replace(/^98/, "0");

      if (live) {
        try {
          const res = await fetch("/api/auth/phone-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: digits, otp }),
          });
          const data = (await res.json()) as {
            ok: boolean;
            error?: string;
            session?: { access_token: string; refresh_token: string };
            profile?: {
              id: string;
              phone?: string | null;
              first_name?: string | null;
              last_name?: string | null;
              kyc_status?: string | null;
              onboarding_done?: boolean | null;
            };
          };
          if (!data.ok || !data.session || !data.profile) {
            return { ok: false, error: data.error ?? "login_failed" };
          }
          const supabase = createClient();
          await supabase.auth.setSession(data.session);
          localStorage.removeItem(STORAGE_KEY);
          setUser(profileToUser(data.profile, digits));
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "login_failed",
          };
        }
      }

      persistLocal({
        id: "demo-user-1",
        firstName: "مهدی",
        lastName: "محمدی",
        phone: digits,
        kycStatus: "UNVERIFIED",
        onboardingDone: false,
        hasPin: false,
      });
      return { ok: true };
    },
    [live, persistLocal]
  );

  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    const next = { ...user, onboardingDone: true };
    setUser(next);
    if (live) {
      try {
        const supabase = createClient();
        await supabase
          .from("profiles")
          .update({ onboarding_done: true })
          .eq("id", user.id);
      } catch {
        /* ignore */
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [live, user]);

  const logout = useCallback(async () => {
    if (live) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
    persistLocal(null);
  }, [live, persistLocal]);

  const setKycStatus = useCallback(
    async (status: KycStatus) => {
      if (!user) return;
      const next = { ...user, kycStatus: status };
      setUser(next);
      if (live) {
        try {
          const supabase = createClient();
          await supabase
            .from("profiles")
            .update({ kyc_status: status })
            .eq("id", user.id);
        } catch {
          /* ignore */
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    },
    [live, user]
  );

  const setHasPin = useCallback(
    (value: boolean) => {
      if (!user) return;
      const next = { ...user, hasPin: value };
      setUser(next);
      if (!live) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    [live, user]
  );

  const value = useMemo(
    () => ({
      user,
      hydrated,
      isAuthenticated: Boolean(user),
      live,
      login,
      completeOnboarding,
      logout,
      setKycStatus,
      setHasPin,
    }),
    [
      user,
      hydrated,
      live,
      login,
      completeOnboarding,
      logout,
      setKycStatus,
      setHasPin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function formatMaskedPhone(phone: string) {
  return maskPhone(phone);
}

/** Sandbox OTP — always accepts 123456 */
export const DEMO_OTP = "123456";
