"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { GoldButton } from "@/components/ui/GoldButton";
import { navItems } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Menu, User, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 h-[84px] transition-all duration-300",
          scrolled
            ? "border-b border-white/[0.07] bg-[#080B0D]/72 backdrop-blur-[18px]"
            : "bg-transparent"
        )}
      >
        <div className="container-site flex h-full items-center justify-between gap-4">
          <BrandLogo href="/" size="md" />

          <nav
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-7 lg:flex"
            aria-label="منوی اصلی"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setActive(item.href)}
                className={cn(
                  "link-underline text-[14px] transition-colors duration-250",
                  active === item.href
                    ? "text-gold"
                    : "text-text-secondary hover:text-text"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:inline-flex">
              <GoldButton
                size="sm"
                className="min-w-[140px]"
                aria-label="ورود یا ثبت‌نام"
                type="button"
              >
                <User className="h-4 w-4" strokeWidth={1.75} />
                ورود / ثبت‌نام
              </GoldButton>
            </Link>

            <button
              type="button"
              className="relative z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-text lg:hidden"
              aria-label={open ? "بستن منو" : "باز کردن منو"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-30 bg-[#080B0D]/96 backdrop-blur-xl transition-all duration-300 lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
      >
        <nav
          className="container-site flex h-full flex-col justify-center gap-2 pt-[84px] pb-10"
          aria-label="منوی موبایل"
        >
          {navItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setActive(item.href);
                setOpen(false);
              }}
              className="border-b border-white/[0.06] py-4 text-[22px] font-semibold text-text transition-colors hover:text-gold"
              style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/auth/login" onClick={() => setOpen(false)} className="mt-8 block">
            <GoldButton className="w-full" type="button">
              <User className="h-4 w-4" strokeWidth={1.75} />
              ورود / ثبت‌نام
            </GoldButton>
          </Link>
        </nav>
      </div>
    </>
  );
}
