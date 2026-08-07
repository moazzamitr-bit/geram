"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { useAuth } from "@/lib/auth/auth-context";
import { useState } from "react";

export default function SecurityPage() {
  const store = useDemoStore();
  const { setHasPin } = useAuth();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="امنیت حساب"
        description="پین تراکنش برای خرید، فروش، برداشت و تحویل لازم است."
        backHref="/app/profile"
        action={<SimulationBadge />}
      />

      <AppCard>
        <h2 className="text-[15px] font-bold">پین تراکنش</h2>
        <p className="mt-2 text-[13px] text-muted-app">
          وضعیت: {store.pin ? "تنظیم شده" : "تنظیم نشده"}
        </p>

        {store.pin ? (
          <div className="mt-4 space-y-3">
            <label className="block text-[13px]">
              <span className="text-muted-app">پین فعلی</span>
              <input
                dir="ltr"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={current}
                onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
              />
            </label>
            <label className="block text-[13px]">
              <span className="text-muted-app">پین جدید (۶ رقم)</span>
              <input
                dir="ltr"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
              />
            </label>
            <label className="block text-[13px]">
              <span className="text-muted-app">تکرار پین جدید</span>
              <input
                dir="ltr"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
              />
            </label>
            <GoldButton
              type="button"
              className="w-full"
              onClick={() => {
                if (current !== store.pin) {
                  setErr("پین فعلی نادرست است.");
                  setMsg("");
                  return;
                }
                if (pin.length !== 6 || pin !== confirm) {
                  setErr("پین جدید باید ۶ رقم و یکسان باشد.");
                  setMsg("");
                  return;
                }
                store.setPin(pin);
                setHasPin(true);
                setErr("");
                setMsg("پین تراکنش به‌روزرسانی شد.");
                setCurrent("");
                setPin("");
                setConfirm("");
              }}
            >
              تغییر پین
            </GoldButton>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-[13px]">
              <span className="text-muted-app">پین ۶ رقمی</span>
              <input
                dir="ltr"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
              />
            </label>
            <label className="block text-[13px]">
              <span className="text-muted-app">تکرار پین</span>
              <input
                dir="ltr"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
              />
            </label>
            <GoldButton
              type="button"
              className="w-full"
              onClick={() => {
                if (pin.length !== 6 || pin !== confirm) {
                  setErr("پین باید ۶ رقم و یکسان باشد.");
                  setMsg("");
                  return;
                }
                store.setPin(pin);
                setHasPin(true);
                setErr("");
                setMsg("پین تراکنش تنظیم شد. اکنون می‌توانید خرید و فروش کنید.");
                setPin("");
                setConfirm("");
              }}
            >
              تنظیم پین
            </GoldButton>
          </div>
        )}

        {err && <p className="mt-3 text-[13px] text-negative">{err}</p>}
        {msg && <p className="mt-3 text-[13px] text-positive">{msg}</p>}
      </AppCard>

      <AppCard>
        <h2 className="text-[15px] font-bold">سایر تنظیمات امنیتی</h2>
        <ul className="mt-3 space-y-2 text-[13px] text-muted-app">
          <li className="rounded-xl border border-white/[0.06] px-3 py-3">
            ورود دو مرحله‌ای — در فاز بعدی
          </li>
          <li className="rounded-xl border border-white/[0.06] px-3 py-3">
            اعلان ورود از دستگاه جدید — فعال (نمایشی)
          </li>
        </ul>
      </AppCard>
    </div>
  );
}
