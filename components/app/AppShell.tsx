"use client";

import { PriceTicker } from "@/components/app/PriceTicker";
import { AssistantWidget } from "@/components/app/AssistantWidget";
import { PwaInstallBanner } from "@/components/app/PwaInstallBanner";
import { AppShellSkeleton } from "@/components/app/Skeleton";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { DesktopTradeMenu, MobileTradeButton } from "@/components/app/TradeNav";
import {
  desktopBottomNav,
  desktopNavSections,
  isTradeNavMenu,
  mobileBottomNav,
  notificationsNav,
  type AppNavItem,
} from "@/lib/app/navigation";
import { useAppData } from "@/lib/app/app-data";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

function isNavActive(pathname: string, href: string) {
  if (href === "/app/dashboard") {
    return pathname === "/app/dashboard" || pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="mr-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-bold text-white tabular-nums">
      {count > 9 ? "۹+" : count.toLocaleString("fa-IR")}
    </span>
  );
}

function SideLink({
  item,
  active,
  unread,
}: {
  item: Extract<AppNavItem, { href: string }>;
  active: boolean;
  unread: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors duration-200",
        active
          ? "bg-[#FFF4D6] font-semibold text-text"
          : "text-text-secondary hover:bg-black/[0.04] hover:text-text"
      )}
    >
      <Icon size={18} strokeWidth={active ? 1.9 : 1.6} className="shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badgeKey === "notifications" && <UnreadBadge count={unread} />}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, hydrated, isAuthenticated, logout } = useAuth();
  const store = useAppData();
  const pathname = usePathname();
  useEffect(() => { try { sessionStorage.setItem("geram:inapp", "1"); } catch {} }, []);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  // The document never scrolls (see .geram-scroll in globals.css); reset the
  // app scroller on route change like the browser would for the window.
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [pathname]);

  const unread = useMemo(
    () => store.notifications.filter((n) => !n.read).length,
    [store.notifications]
  );

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
    <div className="geram-app min-h-dvh bg-bg text-text">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-l border-black/[0.06] bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <BrandLogo href="/app/dashboard" size="sm" showWordmark />
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="منوی اصلی">
          {desktopNavSections.map((section, si) => (
            <div key={section.label ?? `sec-${si}`} className="space-y-1">
              {section.label && (
                <p className="mb-1.5 px-3 text-[11px] font-medium text-muted-app">
                  {section.label}
                </p>
              )}
              {section.items.map((item) =>
                isTradeNavMenu(item) ? (
                  <DesktopTradeMenu key={item.menuKey} item={item} pathname={pathname} />
                ) : (
                  <SideLink
                    key={item.href}
                    item={item}
                    active={isNavActive(pathname, item.href)}
                    unread={unread}
                  />
                )
              )}
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-black/[0.06] px-3 py-3">
          {desktopBottomNav.map((item) =>
            isTradeNavMenu(item) ? null : (
              <SideLink
                key={item.href}
                item={item}
                active={isNavActive(pathname, item.href)}
                unread={unread}
              />
            )
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/auth/login");
            }}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-text-secondary transition-colors hover:bg-black/[0.04] hover:text-negative"
          >
            <LogOut size={18} strokeWidth={1.6} />
            خروج
          </button>
        </div>
      </aside>

      <div ref={scrollRef} id="geram-scroll" className="geram-scroll">
        <header className="sticky top-0 z-20 flex min-h-12 items-center justify-between gap-3 bg-bg/90 px-4 py-2 backdrop-blur-md md:px-6">
          <BrandLogo href="/app/dashboard" size="sm" showWordmark className="shrink-0 lg:hidden" markClassName="!h-8 !w-8" logotypeHeight={28} />
          <PriceTicker className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/app/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#161616] text-white"
              aria-label="حساب کاربری"
            >
              <span className="text-[12px] font-bold">
                {(user?.firstName || "گ").slice(0, 1)}
              </span>
            </Link>
            <Link
              href={notificationsNav.href}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-black/[0.04] hover:text-text"
              aria-label={unread > 0 ? `اعلان‌ها، ${unread} خوانده‌نشده` : "اعلان‌ها"}
            >
              <notificationsNav.icon size={18} strokeWidth={1.7} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[9px] font-bold text-white tabular-nums">
                  {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main id="main" className="px-4 py-4 pb-28 md:px-6 md:py-5 lg:pb-8">
          <PwaInstallBanner />
          {children}
        </main>
      </div>

      {/* Portaled to <body> so no transformed/filtered ancestor or scroll container
          can turn position:fixed into position:absolute on iOS Safari. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="geram-app">
      <nav
        className="geram-mobile-nav fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="ناوبری موبایل"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1.5">
          {mobileBottomNav.map((item) => {
            if (isTradeNavMenu(item)) {
              return (
                <li key={item.menuKey}>
                  <MobileTradeButton item={item} pathname={pathname} />
                </li>
              );
            }
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-12 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-colors",
                    active ? "font-semibold text-text" : "text-muted-app"
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.6} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
          </div>,
          document.body
        )}
      <AssistantWidget />
    </div>
  );
}
