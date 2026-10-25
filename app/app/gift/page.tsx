"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { useVerificationGate, type VerificationStep } from "@/components/app/VerificationGate";
import { AmountField } from "@/components/ui/AmountField";
import { GoldButton } from "@/components/ui/GoldButton";
import { apiJson, faDate, fieldClass, irrToTomanLabel, METAL_LABEL, ugLabel } from "@/lib/app/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, Copy, Gift, Share2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Asset = "GOLD" | "SILVER" | "COPPER";
type GiftItem = {
  id: string;
  code: string;
  asset: Asset;
  weight_ug: string;
  message: string | null;
  status: "ACTIVE" | "REDEEMED" | "CANCELLED" | "EXPIRED";
  expires_at: string;
  settled_at: string | null;
  created_at: string;
  direction: "SENT" | "RECEIVED";
};
type Preview = {
  code: string;
  asset: Asset;
  weightUg: string;
  message: string | null;
  status: GiftItem["status"];
  expiresAt: string;
  senderName: string;
};
type Msg = { ok: boolean; text: string } | null;

const ASSETS: Asset[] = ["GOLD", "SILVER", "COPPER"];
const STATUS: Record<GiftItem["status"], { label: string; cls: string }> = {
  ACTIVE: { label: "در انتظار دریافت", cls: "bg-amber-50 text-amber-700" },
  REDEEMED: { label: "دریافت شد", cls: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "لغو شد", cls: "bg-black/5 text-muted-app" },
  EXPIRED: { label: "منقضی؛ برگشت خورد", cls: "bg-black/5 text-muted-app" },
};
const CARD_BG: Record<Asset, string> = {
  GOLD: "from-[#F6D27A] via-[#E9B949] to-[#B8872B]",
  SILVER: "from-[#F1F1F1] via-[#CFCFCF] to-[#9C9C9C]",
  COPPER: "from-[#F2B08A] via-[#D9814F] to-[#9E5430]",
};

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-xl p-3 text-[13px]",
        msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
      )}
    >
      {msg.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
      {msg.text}
    </p>
  );
}

function GiftCardVisual({ asset, weightUg, code, message, from }: { asset: Asset; weightUg: string; code?: string; message?: string | null; from?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-[#2B1D00] shadow-md", CARD_BG[asset])}>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-extrabold">گرم · کارت هدیه</span>
        <Gift size={22} />
      </div>
      <p className="mt-5 text-[26px] font-extrabold">{ugLabel(weightUg)}</p>
      <p className="text-[13px] font-bold">{METAL_LABEL[asset]}</p>
      {message && <p className="mt-2 line-clamp-2 text-[12px]">«{message}»</p>}
      {from && <p className="mt-1 text-[12px]">از طرف {from}</p>}
      {code && (
        <p dir="ltr" className="mt-3 font-mono text-[16px] font-extrabold tracking-[0.15em]">
          {code}
        </p>
      )}
    </div>
  );
}

export default function GiftPage() {
  const gate = useVerificationGate();
  const [tab, setTab] = useState<"send" | "redeem">("send");
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [ttl, setTtl] = useState(30);
  const [asset, setAsset] = useState<Asset>("GOLD");
  const [grams, setGrams] = useState(0);
  const [value, setValue] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendMsg, setSendMsg] = useState<Msg>(null);
  const [created, setCreated] = useState<GiftItem | null>(null);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [redeemMsg, setRedeemMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const r = await apiJson<{ gifts: GiftItem[]; ttlDays: number }>("/api/gift");
    if (r.ok) {
      setGifts(r.gifts);
      setTtl(r.ttlDays);
    }
  }, []);

  const lookup = useCallback(async (c: string) => {
    setRedeemMsg(null);
    setPreview(null);
    const r = await apiJson<{ gift: Preview }>(`/api/gift/preview?code=${encodeURIComponent(c)}`);
    if (r.ok) setPreview(r.gift);
    else setRedeemMsg({ ok: false, text: r.message ?? "کد پیدا نشد." });
  }, []);

  useEffect(() => {
    void load();
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    const fromCookie = document.cookie.match(/(?:^|; )geram_gift=(GRM-[A-Z0-9-]+)/)?.[1];
    document.cookie = "geram_gift=; path=/; max-age=0; secure; samesite=lax";
    const c = fromUrl || fromCookie;
    if (c) {
      setTab("redeem");
      setCode(c);
      void lookup(c);
    }
  }, [load, lookup]);

  useEffect(() => {
    setValue(null);
    if (grams <= 0) return;
    const t = setTimeout(async () => {
      const r = await apiJson<{ grossIrr: string }>(`/api/reports/calc?asset=${asset}&side=BUY&grams=${grams}`);
      if (r.ok) setValue(r.grossIrr);
    }, 400);
    return () => clearTimeout(t);
  }, [asset, grams]);

  async function send() {
    if (!gate.guard()) return;
    setBusy(true);
    setSendMsg(null);
    setCreated(null);
    const r = await apiJson<{ gift: GiftItem; message: string }>("/api/gift", {
      method: "POST",
      body: JSON.stringify({ asset, weightUg: Math.round(grams * 1_000_000), message: note }),
    });
    setBusy(false);
    if (r.error === "verification_required") gate.openGate(r.nextStep as VerificationStep);
    setSendMsg({ ok: r.ok, text: r.message ?? "ساخت کارت هدیه انجام نشد." });
    if (r.ok) {
      setCreated(r.gift);
      setGrams(0);
      setNote("");
      void load();
    }
  }

  async function redeem() {
    if (!gate.guard()) return;
    setBusy(true);
    const r = await apiJson<{ message: string }>("/api/gift/redeem", { method: "POST", body: JSON.stringify({ code }) });
    setBusy(false);
    if (r.error === "verification_required") gate.openGate(r.nextStep as VerificationStep);
    setRedeemMsg({ ok: r.ok, text: r.message ?? "دریافت هدیه انجام نشد." });
    if (r.ok) {
      setPreview(null);
      setCode("");
      void load();
    }
  }

  async function cancel(id: string) {
    if (!window.confirm("کارت هدیه لغو شود؟ فلز به دارایی شما برمی‌گردد.")) return;
    const r = await apiJson<{ message: string }>(`/api/gift/${id}/cancel`, { method: "POST" });
    setSendMsg({ ok: r.ok, text: r.message ?? "لغو انجام نشد." });
    void load();
  }

  async function share(g: GiftItem) {
    const link = `https://geram.co/g/${g.code}`;
    const text = `یک کارت هدیه ${ugLabel(g.weight_ug)} ${METAL_LABEL[g.asset]} از گرم برایت فرستادم! کد: ${g.code}`;
    if (navigator.share) await navigator.share({ title: "کارت هدیه گرم", text, url: link }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(`${text}\n${link}`).catch(() => undefined);
      setCopied(g.id);
      setTimeout(() => setCopied(""), 2500);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <PageHeader title="کارت هدیه" />
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/[0.04] p-1">
        {(["send", "redeem"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("h-10 rounded-lg text-[14px]", tab === t ? "bg-white font-bold shadow-sm" : "text-muted-app")}
          >
            {t === "send" ? "ارسال هدیه" : "دریافت هدیه"}
          </button>
        ))}
      </div>

      {tab === "send" ? (
        <AppCard className="space-y-3">
          <p className="text-[13px] leading-6 text-muted-app">
            از موجودی خودتان طلا، نقره یا مس هدیه بدهید. فلز تا دریافت گیرنده کنار گذاشته می‌شود؛ اگر تا {ttl.toLocaleString("fa-IR")} روز
            دریافت نشود یا لغوش کنید، به دارایی شما برمی‌گردد. ارسال هدیه کارمزد ندارد.
          </p>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/[0.04] p-1">
            {ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                className={cn("h-9 rounded-lg text-[13px]", asset === a ? "bg-white font-bold shadow-sm" : "text-muted-app")}
              >
                {METAL_LABEL[a]}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-app">مقدار هدیه (گرم)</span>
            <AmountField value={grams} onValueChange={setGrams} decimals={3} className={fieldClass} />
          </label>
          {value && <p className="text-[12px] text-muted-app">ارزش تقریبی: {irrToTomanLabel(value)}</p>}
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-app">پیام روی کارت (اختیاری)</span>
            <input className={fieldClass} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="تولدت مبارک!" />
          </label>
          <GoldButton type="button" className="w-full" disabled={busy || grams <= 0} onClick={send}>
            {busy ? "در حال ساخت…" : "ساخت کارت هدیه"}
          </GoldButton>
          <Note msg={sendMsg} />
          {created && (
            <div className="space-y-2">
              <GiftCardVisual asset={created.asset} weightUg={created.weight_ug} code={created.code} message={created.message} />
              <GoldButton type="button" className="w-full" onClick={() => share(created)}>
                {copied === created.id ? <CheckCircle2 size={16} /> : <Share2 size={16} />}{" "}
                {copied === created.id ? "متن و لینک کپی شد" : "ارسال برای گیرنده"}
              </GoldButton>
            </div>
          )}
        </AppCard>
      ) : (
        <AppCard className="space-y-3">
          <p className="text-[13px] text-muted-app">کد کارت هدیه را وارد کنید. دریافت هدیه به احراز هویت کامل نیاز دارد.</p>
          <div className="flex gap-2">
            <input
              dir="ltr"
              className={`${fieldClass} font-mono uppercase`}
              placeholder="GRM-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <GoldButton type="button" variant="secondary" disabled={code.replace(/[^0-9A-Z]/g, "").length < 8} onClick={() => lookup(code)}>
              بررسی
            </GoldButton>
          </div>
          {preview && (
            <div className="space-y-2">
              <GiftCardVisual asset={preview.asset} weightUg={preview.weightUg} message={preview.message} from={preview.senderName} />
              {preview.status === "ACTIVE" ? (
                <>
                  <p className="text-[12px] text-muted-app">مهلت دریافت تا {faDate(preview.expiresAt, true)}</p>
                  <GoldButton type="button" className="w-full" disabled={busy} onClick={redeem}>
                    {busy ? "در حال دریافت…" : "دریافت هدیه"}
                  </GoldButton>
                </>
              ) : (
                <p className="rounded-xl bg-black/5 p-3 text-[13px] text-muted-app">وضعیت: {STATUS[preview.status].label}</p>
              )}
            </div>
          )}
          <Note msg={redeemMsg} />
        </AppCard>
      )}

      <AppCard>
        <h3 className="text-[15px] font-bold text-text">کارت‌های هدیه من</h3>
        {gifts.length === 0 ? (
          <EmptyState title="هنوز کارت هدیه‌ای ندارید" description="اولین هدیه را برای عزیزانتان بفرستید." />
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {gifts.map((g) => (
              <li key={g.id} className="py-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-text">
                    {g.direction === "SENT" ? "ارسالی" : "دریافتی"} · {ugLabel(g.weight_ug)} {METAL_LABEL[g.asset]}
                  </p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STATUS[g.status].cls)}>{STATUS[g.status].label}</span>
                </div>
                <p className="mt-1 text-[12px] text-muted-app">
                  <span dir="ltr" className="font-mono">{g.code}</span> · {faDate(g.created_at)}
                  {g.status === "ACTIVE" && ` · تا ${faDate(g.expires_at)}`}
                </p>
                {g.direction === "SENT" && g.status === "ACTIVE" && (
                  <div className="mt-2 flex gap-2">
                    <GoldButton type="button" size="sm" variant="secondary" onClick={() => share(g)}>
                      {copied === g.id ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied === g.id ? "کپی شد" : "ارسال دوباره"}
                    </GoldButton>
                    <GoldButton type="button" size="sm" variant="secondary" onClick={() => cancel(g.id)}>
                      <XCircle size={14} /> لغو
                    </GoldButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </div>
  );
}
