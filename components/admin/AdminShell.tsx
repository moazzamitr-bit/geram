"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { adminNavGroups } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";
import { LogOut, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AdminShell({
  children,
  adminName,
  roleLabel,
}: {
  children: React.ReactNode;
  adminName?: string;
  roleLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

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

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/admin/search?q=${encodeURIComponent(query)}`);
    setOpen(false);
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
        <p className="px-5 pb-3 text-[11px] text-white/40">کنسول عملیات گرم</p>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {adminNavGroups.map((group) => (
            <div key={group.id}>
              <p className="mb-1 px-3 text-[10px] font-bold tracking-wide text-white/35">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
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
                        "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition",
                        active
                          ? "bg-gold/15 text-gold"
                          : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <Icon size={16} strokeWidth={1.7} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#070B12]/90 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="منو"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="text-[15px] font-bold">مدیریت گرم</p>
              <p className="truncate text-[12px] text-white/45">RTL · عملیات چنددارایی</p>
            </div>
          </div>
          <form onSubmit={submitSearch} className="hidden max-w-md flex-1 md:block">
            <label className="relative block">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="جستجو: کد پیگیری، user id، تیکت…"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0B1220] pr-9 pl-3 text-[12px] outline-none focus:border-gold"
              />
            </label>
          </form>
          <div className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/70">
            {adminName || "ادمین"}
            {roleLabel ? <span className="text-white/40"> · {roleLabel}</span> : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
