"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";

type Product = { id: string; asset: string; kind: string; title: string; weight_ug: string; active: boolean; sort: number };
type Settings = {
  feePercent: number;
  branches: { id: string; name: string; address: string; hours: string }[];
  slots: string[];
  minLeadDays: number;
};

const input = "h-10 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 text-[13px] outline-none focus:border-gold";

async function post(body: unknown) {
  const res = await fetch("/api/admin/physical", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; message?: string; error?: string };
}

export function PhysicalSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [fee, setFee] = useState(String(settings.feePercent * 100));
  const [lead, setLead] = useState(String(settings.minLeadDays));
  const [slots, setSlots] = useState(settings.slots.join("، "));
  const [branches, setBranches] = useState(JSON.stringify(settings.branches, null, 2));
  const [msg, setMsg] = useState("");

  const save = async () => {
    setMsg("");
    let parsedBranches;
    try {
      parsedBranches = JSON.parse(branches);
    } catch {
      return setMsg("فرمت شعب (JSON) درست نیست.");
    }
    const r = await post({
      action: "settings",
      settings: {
        feePercent: Number(fee) / 100,
        minLeadDays: Number(lead),
        slots: slots.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
        branches: parsedBranches,
      },
    });
    setMsg(r.ok ? "تنظیمات ذخیره شد." : r.message || r.error || "ناموفق");
    if (r.ok) router.refresh();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0F1724] p-5">
      <h2 className="font-bold">تنظیمات برداشت فیزیکی</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-[12px] text-white/60">کارمزد خدمات (٪ وزن)<input className={input} value={fee} onChange={(e) => setFee(e.target.value)} /></label>
        <label className="text-[12px] text-white/60">حداقل فاصله تا مراجعه (روز)<input className={input} value={lead} onChange={(e) => setLead(e.target.value)} /></label>
        <label className="text-[12px] text-white/60">بازه‌های ساعت (با ، جدا)<input className={input} value={slots} onChange={(e) => setSlots(e.target.value)} /></label>
      </div>
      <label className="block text-[12px] text-white/60">
        شعب تحویل (JSON: id, name, address, hours)
        <textarea dir="ltr" className="mt-1 h-32 w-full rounded-lg border border-white/10 bg-[#0B1220] p-3 font-mono text-[12px]" value={branches} onChange={(e) => setBranches(e.target.value)} />
      </label>
      <GoldButton type="button" size="sm" onClick={save}>ذخیره تنظیمات</GoldButton>
      {msg && <p className="text-[12px] text-gold">{msg}</p>}
    </div>
  );
}

export function PhysicalProductsForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const blank = { id: "", asset: "GOLD", kind: "BAR", title: "", grams: "", active: true, sort: "0" };
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState("");

  const save = async () => {
    const r = await post({ action: "product", product: form });
    setMsg(r.ok ? "محصول ذخیره شد." : r.message || r.error || "ناموفق");
    if (r.ok) {
      setForm(blank);
      router.refresh();
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0F1724] p-5">
      <h2 className="font-bold">محصولات قابل تحویل</h2>
      <ul className="space-y-1 text-[13px]">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <span>
              {p.title} · {(Number(p.weight_ug) / 1e6).toLocaleString("fa-IR")} گرم · {p.asset} {p.active ? "" : "(غیرفعال)"}
            </span>
            <button
              type="button"
              className="text-gold"
              onClick={() =>
                setForm({ id: p.id, asset: p.asset, kind: p.kind, title: p.title, grams: String(Number(p.weight_ug) / 1e6), active: p.active, sort: String(p.sort) })
              }
            >
              ویرایش
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-6">
        <input className={`${input} sm:col-span-2`} placeholder="عنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select className={input} value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}>
          <option value="GOLD">طلا</option><option value="SILVER">نقره</option><option value="COPPER">مس</option>
        </select>
        <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="BAR">شمش</option><option value="COIN">سکه</option>
        </select>
        <input className={input} dir="ltr" placeholder="وزن (گرم)" value={form.grams} onChange={(e) => setForm({ ...form, grams: e.target.value })} />
        <input className={input} dir="ltr" placeholder="ترتیب" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-[12px]">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> فعال
      </label>
      <GoldButton type="button" size="sm" onClick={save}>{form.id ? "ذخیره تغییرات" : "افزودن محصول"}</GoldButton>
      {msg && <p className="text-[12px] text-gold">{msg}</p>}
    </div>
  );
}
