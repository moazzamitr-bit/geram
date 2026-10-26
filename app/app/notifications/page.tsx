"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { useAppData } from "@/lib/app/app-data";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

export default function NotificationsPage() {
  const store = useAppData();
  const unread = useMemo(
    () => store.notifications.filter((n) => !n.read).length,
    [store.notifications]
  );

  useEffect(() => {
    // Keep badge accurate after visit; individual click still marks one as read.
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="اعلان‌ها"
        description={
          unread > 0
            ? `${unread.toLocaleString("fa-IR")} اعلان خوانده‌نشده`
            : store.notifications.length === 0
              ? "اعلانی ندارید."
              : "همه اعلان‌ها را دیده‌اید."
        }
        action={
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void store.markAllNotificationsRead()}
                className="min-h-10 rounded-xl border border-white/10 px-3 text-[12px] text-text-secondary transition-colors hover:border-gold/35 hover:text-gold"
              >
                همه خوانده شد
              </button>
            )}
          </div>
        }
      />

      {store.userDataError && (
        <p role="alert" className="rounded-xl border border-rose-600/30 bg-rose-600/5 px-3 py-2 text-[13px] text-rose-700">
          {store.userDataError}{" "}
          <button type="button" className="underline" onClick={() => void store.refreshUserData()}>
            تلاش دوباره
          </button>
        </p>
      )}
      {store.notifications.length === 0 ? (
        <EmptyState
          title="هنوز اعلانی ندارید"
          description="بعد از خرید، فروش یا رویداد امنیتی، پیام‌ها اینجا می‌آیند."
          icon={Bell}
          actionHref="/app/trade/gold"
          actionLabel="اولین خرید طلا"
        />
      ) : (
        <div className="space-y-2.5">
          {store.notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className="block w-full cursor-pointer text-right"
              onClick={() => void store.markNotificationRead(n.id)}
            >
              <AppCard
                className={`transition duration-200 ${
                  n.read
                    ? "opacity-75 hover:opacity-100"
                    : "border-gold/30 bg-gold/[0.04]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && (
                    <span
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold"
                      aria-hidden
                    />
                  )}
                  <div className={`min-w-0 flex-1 ${n.read ? "pr-0" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-gold">{n.type}</p>
                        <p className="mt-1 font-bold text-text">{n.title}</p>
                        <p className="mt-1 text-[13px] leading-6 text-muted-app">
                          {n.message}
                        </p>
                        {n.href && (
                          <Link
                            href={n.href}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 inline-block text-[12px] text-gold hover:text-gold-highlight"
                          >
                            مشاهده جزئیات
                          </Link>
                        )}
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-muted-app">
                        {n.createdAt}
                      </span>
                    </div>
                  </div>
                </div>
              </AppCard>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
