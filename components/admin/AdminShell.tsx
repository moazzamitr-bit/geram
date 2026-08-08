"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { adminNav } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AdminShell({
  children,
  adminName,
}: {
  children: React.ReactNode;
  adminName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-svh bg-[#070B12] text-[#F4F2ED]">
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          aria-label="بستن منو"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col border-l border-white/10 bg-[#0B1220] transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <BrandLogo href="/admin" size="sm" />
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>
        <p className="px-5 pb-3 text-[11px] text-white/40">پنل مدیریت گرم</p>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {adminNav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition",
                  active
                    ? "bg-gold/15 text-gold"
                    : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <Icon size={18} strokeWidth={1.7} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/65 hover:bg-white/[0.04] hover:text-negative"
          >
            <LogOut size={18} />
            خروج
          </button>
        </div>
      </aside>

      <div className="lg:mr-[280px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#070B12]/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="منو"
            >
              <Menu size={18} />
            </button>
            <div>
              <p className="text-[15px] font-bold">مدیریت گرم</p>
              <p className="text-[12px] text-white/45">Supabase · کنترل عملیات</p>
            </div>
          </div>
          <div className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/70">
            {adminName || "ادمین"}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
