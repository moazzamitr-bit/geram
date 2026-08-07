"use client";

import { AppShellSkeleton } from "@/components/app/Skeleton";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  desktopBottomNav,
  desktopNavSections,
  mobileBottomNav,
  notificationsNav,
  type AppNavItem,
} from "@/lib/app/navigation";
import { useDemoStore } from "@/lib/app/demo-store";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { Headphones, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

function isNavActive(pathname: string, href: string) {
  if (href === "/app/dashboard") {
    return pathname === "/app/dashboard" || pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="mr-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-[#0A0C0E] tabular-nums">
      {count > 9 ? "۹+" : count.toLocaleString("fa-IR")}
    </span>
  );
}

function SideLink({
  item,
  active,
  unread,
}: {
  item: AppNavItem;
  active: boolean;
  unread: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all duration-200",
        active
          ? "bg-gold/10 text-gold"
          : "text-text-secondary hover:bg-white/[0.03] hover:text-text",
        item.accent && !active && "text-gold-soft",
        item.accent && "border border-gold/20 bg-gold/[0.04] hover:border-gold/35"
      )}
    >
      {active && (
        <span className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-gold-gradient" />
      )}
      <Icon
        size={18}
        strokeWidth={active || item.accent ? 1.85 : 1.6}
        className="shrink-0"
      />
      <span className="truncate">{item.label}</span>
      {item.badgeKey === "notifications" && <UnreadBadge count={unread} />}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, hydrated, isAuthenticated, logout } = useAuth();
  const store = useDemoStore();
  const pathname = usePathname();
  const router = useRouter();

  const unread = useMemo(
    () => store.notifications.filter((n) => !n.read).length,
    [store.notifications]
  );

  const marketLabel =
    store.marketStatus === "open"
      ? "بازار باز است"
      : store.marketStatus === "paused"
        ? "بازار متوقف"
        : "بازار بسته است";
  const marketTone =
    store.marketStatus === "open"
      ? "border-positive/25 bg-positive/10 text-positive"
      : "border-warning/25 bg-warning/10 text-warning";

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    if (user && !user.onboardingDone) {
      router.replace("/auth/onboarding");
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated || !store.hydrated || !isAuthenticated || (user && !user.onboardingDone)) {
    return <AppShellSkeleton />;
  }

  return (
    <div className="min-h-svh bg-bg text-text">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-l border-white/[0.07] bg-bg-secondary lg:flex">
        <div className="flex h-[var(--app-header-h)] items-center px-5">
          <BrandLogo href="/app/dashboard" size="sm" />
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="منوی اصلی">
          {desktopNavSections.map((section, si) => (
            <div key={section.label ?? `sec-${si}`} className="space-y-1">
              {section.label && (
                <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wide text-muted-app">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <SideLink
                  key={item.href}
                  item={item}
                  active={isNavActive(pathname, item.href)}
                  unread={unread}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/[0.06] px-3 py-3">
          {desktopBottomNav.map((item) => (
            <SideLink
              key={item.href}
              item={item}
              active={isNavActive(pathname, item.href)}
              unread={unread}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/auth/login");
            }}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.03] hover:text-negative"
          >
            <LogOut size={18} strokeWidth={1.6} />
            خروج
          </button>
        </div>
      </aside>

      <div className="lg:mr-[var(--sidebar-w)]">
        <header className="sticky top-0 z-20 flex h-[var(--app-header-h)] items-center justify-between gap-3 border-b border-white/[0.07] bg-bg/90 px-4 backdrop-blur-md md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                marketTone
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  store.marketStatus === "open" ? "bg-positive" : "bg-warning"
                )}
              />
              {marketLabel}
            </span>
            <span className="hidden truncate text-[12px] text-muted-app sm:inline">
              قیمت:{" "}
              <span className="tabular-nums text-text-secondary">
                {store.marketPriceRial.toLocaleString("fa-IR")}
              </span>{" "}
              تومان
              {store.marketUpdatedAt && (
                <span className="mr-2 text-[11px] opacity-80">
                  · {store.marketStale ? "ذخیره‌شده" : "لایو"} · {store.marketSource}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/app/support"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] text-text-secondary transition-colors hover:text-gold"
              aria-label="پشتیبانی"
            >
              <Headphones size={18} strokeWidth={1.6} />
            </Link>
            <Link
              href={notificationsNav.href}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] text-text-secondary transition-colors hover:text-gold"
              aria-label={
                unread > 0 ? `اعلان‌ها، ${unread} خوانده‌نشده` : "اعلان‌ها"
              }
            >
              <notificationsNav.icon size={18} strokeWidth={1.6} />
              {unread > 0 && (
                <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-[#0A0C0E] tabular-nums">
                  {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
                </span>
              )}
            </Link>
            <Link
              href="/app/profile"
              className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.07] px-2.5 py-1.5 text-[13px] text-text-secondary transition-colors hover:text-text"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-gold">
                <UserRound size={14} />
              </span>
              <span className="hidden sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
            </Link>
          </div>
        </header>

        <main id="main" className="px-4 py-5 pb-28 md:px-6 md:py-7 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-bg-secondary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="ناوبری موبایل"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1.5">
          {mobileBottomNav.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            const showNotifDot = item.href === "/app/profile" && unread > 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex min-h-12 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-colors duration-200",
                    active ? "text-gold" : "text-muted-app"
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 active:scale-95",
                      item.accent &&
                        "bg-gold-gradient text-[#0A0C0E] shadow-[0_6px_18px_rgba(138,101,38,0.35)]",
                      !item.accent && active && "bg-gold/10"
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.7}
                      className={item.accent ? "text-[#0A0C0E]" : undefined}
                    />
                    {showNotifDot && (
                      <span className="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-gold ring-2 ring-bg-secondary" />
                    )}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
