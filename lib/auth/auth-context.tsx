"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  login: (phone: string) => void;
  completeOnboarding: () => void;
  logout: () => void;
  setKycStatus: (status: KycStatus) => void;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as DemoUser);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  const persist = useCallback((next: DemoUser | null) => {
    setUser(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    (phone: string) => {
      persist({
        id: "demo-user-1",
        firstName: "مهدی",
        lastName: "محمدی",
        phone,
        kycStatus: "UNVERIFIED",
        onboardingDone: false,
        hasPin: false,
      });
    },
    [persist]
  );

  const completeOnboarding = useCallback(() => {
    if (!user) return;
    persist({ ...user, onboardingDone: true });
  }, [persist, user]);

  const logout = useCallback(() => persist(null), [persist]);

  const setKycStatus = useCallback(
    (status: KycStatus) => {
      if (!user) return;
      persist({ ...user, kycStatus: status });
    },
    [persist, user]
  );

  const setHasPin = useCallback(
    (value: boolean) => {
      if (!user) return;
      persist({ ...user, hasPin: value });
    },
    [persist, user]
  );

  const value = useMemo(
    () => ({
      user,
      hydrated,
      isAuthenticated: Boolean(user),
      login,
      completeOnboarding,
      logout,
      setKycStatus,
      setHasPin,
    }),
    [user, hydrated, login, completeOnboarding, logout, setKycStatus, setHasPin]
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
