"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, Smartphone, Tablet } from "lucide-react";
import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { relativeFa } from "@/lib/auth/sessions";

type S = { id: string; device: { label: string; kind: string }; ip: string; createdAt: string; lastActiveAt: string; current: boolean };

export default function SessionsPage() {
  const [list, setList] = useState<S[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/me/sessions", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.message);
      setList(j.sessions);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "خواندن نشست‌ها ممکن نشد. دوباره تلاش کنید.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function revoke(q: string, key: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(key); setMsg(null);
    try {
      const r = await fetch(`/api/me/sessions?${q}`, { method: "DELETE" });
      const j = await r.json();
      setMsg(j.message ?? null);
      await load();
    } catch { setMsg("ارتباط برقرار نشد. دوباره تلاش کنید."); }
    finally { setBusy(null); }
  }

  const others = list?.filter((s) => !s.current).length ?? 0;
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="نشست‌های فعال" description="دستگاه‌هایی که الان با حساب شما وارد شده‌اند. اگر دستگاهی را نمی‌شناسید، از آن خارج شوید." backHref="/app/profile" />
      {msg && <p className="rounded-xl bg-[#f3ead7] px-4 py-3 text-[13px] text-[#2b2216]" role="status">{msg}</p>}
      {error && (
        <AppCard>
          <p className="text-[13px] text-[#2b2216]">{error}</p>
          <button onClick={() => void load()} className="mt-3 rounded-xl bg-[#2b2216] px-4 py-2 text-[13px] font-bold text-white">تلاش دوباره</button>
        </AppCard>
      )}
      {!list && !error && [0, 1].map((i) => <div key={i} data-testid="session-skeleton" className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}
      {list?.map((s) => {
        const Icon = s.device.kind === "mobile" ? Smartphone : s.device.kind === "tablet" ? Tablet : Laptop;
        return (
          <AppCard key={s.id}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3ead7] text-[#8a6a2f]"><Icon size={22} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1f1a13]">{s.device.label}</span>
                  {s.current && <span className="rounded-full bg-[#e3f1e4] px-2 py-0.5 text-[11px] font-bold text-[#1d6b2c]">این دستگاه</span>}
                </div>
                <p className="mt-1 text-[12px] leading-6 text-[#4a4033]">
                  آخرین فعالیت: {relativeFa(s.lastActiveAt)} · ورود: {relativeFa(s.createdAt)}
                </p>
                <p className="text-[12px] text-[#4a4033]" dir="ltr" style={{ textAlign: "right" }}>IP {s.ip}</p>
              </div>
              {!s.current && (
                <button disabled={busy !== null} onClick={() => void revoke(`id=${s.id}`, s.id, `از «${s.device.label}» خارج شوید؟`)}
                  className="shrink-0 rounded-xl border border-[#c0392b]/40 px-3 py-2 text-[12px] font-bold text-[#a93226] disabled:opacity-50">
                  {busy === s.id ? "..." : "خروج"}
                </button>
              )}
            </div>
          </AppCard>
        );
      })}
      {list && others > 0 && (
        <button disabled={busy !== null} onClick={() => void revoke("scope=others", "all", "از همه دستگاه‌های دیگر خارج شوید؟ این دستگاه وارد می‌ماند.")}
          className="w-full rounded-2xl bg-[#2b2216] py-3 text-[14px] font-bold text-white disabled:opacity-50">
          {busy === "all" ? "در حال خروج..." : "خروج از همه دستگاه‌های دیگر"}
        </button>
      )}
      {list && others === 0 && <p className="text-center text-[12px] text-[#4a4033]">دستگاه دیگری با حساب شما وارد نشده است.</p>}
    </div>
  );
}
