"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { withTimeout } from "@/lib/auth/timeout";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

export type KycStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_UPDATE";

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  kycStatus: KycStatus;
  onboardingDone: boolean;
  hasPin: boolean;
};

type AuthState = {
  user: AppUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  live: boolean;
  login: (phone: string, otp?: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithPassword: (
    phone: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; onboardingDone?: boolean }>;
  register: (input: {
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<{ ok: boolean; error?: string; onboardingDone?: boolean }>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  setKycStatus: (status: KycStatus) => Promise<void>;
  applyKycResult: (patch: {
    kycStatus: KycStatus;
    firstName?: string;
    lastName?: string;
  }) => void;
  setHasPin: (value: boolean) => void;
};

/** Pre-launch demo sessions were stored here; cleared on load so none survive. */
const LEGACY_DEMO_KEY = "gram_demo_session_v1";

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
): AppUser {
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const live = hasSupabaseEnv();

  useEffect(() => {
    let cancelled = false;

    function finish(next: AppUser | null) {
      if (cancelled) return;
      setUser(next);
      setHydrated(true);
    }

    async function hydrate() {
      try {
        localStorage.removeItem(LEGACY_DEMO_KEY);
      } catch {
        /* storage unavailable */
      }
      if (!live) {
        finish(null);
        return;
      }

      try {
        const supabase = createClient();
        const { data } = await withTimeout(supabase.auth.getUser(), 5_000, "auth_timeout");
        const authUser = data.user;
        if (!authUser) {
          finish(null);
          return;
        }
        const { data: profile } = await withTimeout(
          supabase
            .from("profiles")
            .select("id, phone, first_name, last_name, kyc_status, onboarding_done")
            .eq("id", authUser.id)
            .maybeSingle(),
          5_000,
          "auth_timeout"
        );
        if (profile) {
          finish(profileToUser(profile, (authUser.user_metadata?.phone as string) || ""));
          return;
        }
        finish({
          id: authUser.id,
          firstName: "کاربر",
          lastName: "گرم",
          phone: (authUser.user_metadata?.phone as string) || "",
          kycStatus: "UNVERIFIED",
          onboardingDone: false,
          hasPin: false,
        });
      } catch {
        finish(null);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [live]);

  const login = useCallback(
    async (phone: string, otp = "") => {
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
          setUser(profileToUser(data.profile, digits));
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "login_failed",
          };
        }
      }

      return { ok: false, error: "unavailable" };
    },
    [live]
  );

  const exchangePassword = useCallback(
    async (
      url: string,
      body: Record<string, string>
    ): Promise<{ ok: boolean; error?: string; onboardingDone?: boolean }> => {
      const digits = (body.phone || "").replace(/\D/g, "").replace(/^98/, "0");
      if (!live) return { ok: false, error: "unavailable" };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ ...body, phone: digits }),
          signal: AbortSignal.timeout(12_000),
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
        if (!data.ok || !data.profile) {
          return { ok: false, error: data.error ?? "login_failed" };
        }
        if (data.session?.access_token && data.session.refresh_token) {
          try {
            const supabase = createClient();
            await withTimeout(supabase.auth.setSession(data.session), 4_000, "auth_timeout");
          } catch {
            // The route already set the cookies middleware reads.
          }
        }
        setUser(profileToUser(data.profile, digits));
        return { ok: true, onboardingDone: Boolean(data.profile.onboarding_done) };
      } catch (err) {
        const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.message === "auth_timeout");
        return { ok: false, error: timedOut ? "timeout" : "network" };
      }
    },
    [live]
  );

  const loginWithPassword = useCallback(
    (phone: string, password: string) =>
      exchangePassword(
        "/api/auth/password-login",
        { phone, password }
      ),
    [exchangePassword]
  );

  const register = useCallback(
    (input: { phone: string; password: string; firstName: string; lastName: string }) =>
      exchangePassword(
        "/api/auth/register",
        {
          phone: input.phone,
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
        }
      ),
    [exchangePassword]
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
    setUser(null);
  }, [live]);

  const setKycStatus = useCallback(
    async (status: KycStatus) => {
      if (!user) return;
      // KYC status is server-owned; only a fresh profile read changes it.
      void status;
    },
    [live, user]
  );

  const applyKycResult = useCallback(
    (patch: { kycStatus: KycStatus; firstName?: string; lastName?: string }) => {
      setUser((current) => {
        if (!current) return current;
        const next = {
          ...current,
          kycStatus: patch.kycStatus,
          firstName: patch.firstName || current.firstName,
          lastName: patch.lastName || current.lastName,
        };
        return next;
      });
    },
    [live]
  );

  const setHasPin = useCallback(
    (value: boolean) => {
      if (!user) return;
      const next = { ...user, hasPin: value };
      setUser(next);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      hydrated,
      isAuthenticated: Boolean(user),
      live,
      login,
      loginWithPassword,
      register,
      completeOnboarding,
      logout,
      setKycStatus,
      applyKycResult,
      setHasPin,
    }),
    [
      user,
      hydrated,
      live,
      login,
      loginWithPassword,
      register,
      completeOnboarding,
      logout,
      setKycStatus,
      applyKycResult,
      setHasPin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  // Keep this loud: a missing provider means the root layout is not wrapping
  // the tree (e.g. the wrong layout became root), and the build must fail.
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function formatMaskedPhone(phone: string) {
  return maskPhone(phone);
}

