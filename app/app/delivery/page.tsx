"use client";

import { AppCard } from "@/components/app/AppCard";
import { ReceiptSheet } from "@/components/app/ReceiptSheet";
import { formatTehranJalaliDateTime } from "@/lib/format/datetime";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { useVerificationGate, type VerificationStep } from "@/components/app/VerificationGate";
import { GoldButton } from "@/components/ui/GoldButton";
import { apiJson, faDate, faWeekdayDate, METAL_LABEL, ugLabel, upcomingDays } from "@/lib/app/format";
import { useAppData } from "@/lib/app/app-data";
import { cn } from "@/lib/utils";
import { MapPin, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Product = { id: string; asset: string; kind: string; brand?: string | null; title: string; weight_ug: string; fee_percent?: number | null };
type Branch = { id: string; name: string; address: string; hours: string };
type Settings = { feePercent: number; branches: Branch[]; slots: string[]; minLeadDays: number };
type Req = {
  id: string;
  product_title: string;
  asset: string;
  quantity: number;
  weight_ug: string;
  fee_ug: string;
  branch_name: string;
  pickup_date: string;
  pickup_slot: string;
  status: string;
  tracking_code: string;
  admin_note: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; cls: string; hint: string }> = {
  PENDING: { label: "در انتظار تأیید", cls: "bg-amber-50 text-amber-700 border-amber-200", hint: "فلز برای شما رزرو شده و درخواست در صف بررسی است." },
  APPROVED: { label: "آماده تحویل", cls: "bg-sky-50 text-sky-700 border-sky-200", hint: "نوبت شما تأیید شد. با کارت ملی در زمان انتخابی مراجعه کنید." },
  DELIVERED: { label: "تحویل شد", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", hint: "تحویل انجام و از موجودی شما کسر شد." },
  REJECTED: { label: "رد شد", cls: "bg-rose-50 text-rose-700 border-rose-200", hint: "فلز رزروشده به موجودی شما برگشت." },
  CANCELLED: { label: "لغو شد", cls: "bg-stone-100 text-stone-600 border-stone-200", hint: "فلز رزروشده به موجودی شما برگشت." },
};

function feeUg(weightUg: bigint, pct: number) {
  const bps = BigInt(Math.round(pct * 10_000));
  return (weightUg * bps + 9_999n) / 10_000n;
}

export default function PhysicalWithdrawalPage() {
  const store = useAppData();
  const gate = useVerificationGate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [branchId, setBranchId] = useState("");
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Req | null>(null);

  const load = useCallback(async () => {
    const data = await apiJson<{ settings: Settings; products: Product[]; requests: Req[] }>("/api/physical");
    if (!data.ok) {
      setErr(data.message ?? "اطلاعات بارگذاری نشد.");
      return;
    }
    setSettings(data.settings);
    setProducts(data.products);
    setRequests(data.requests);
    setBranchId((b) => b || data.settings.branches[0]?.id || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const product = products.find((p) => p.id === productId);
  const days = useMemo(() => (settings ? upcomingDays(settings.minLeadDays) : []), [settings]);
  const weight = product ? BigInt(product.weight_ug) * BigInt(qty) : 0n;
  const feePct = product ? (product.fee_percent ?? settings?.feePercent ?? 0) : 0;
  const fee = settings && product ? feeUg(weight, feePct) : 0n;
  const balanceMg =
    product?.asset === "GOLD" ? store.goldMg : product?.asset === "SILVER" ? store.silverMg : product ? store.copperMg : 0;
  const enough = product ? BigInt(Math.floor(balanceMg)) * 1000n >= weight + fee : true;

  const submit = async () => {
    setErr("");
    if (!gate.guard()) return;
    if (!product) return setErr("محصول را انتخاب کنید.");
    if (!day) return setErr("روز مراجعه را انتخاب کنید.");
    if (!slot) return setErr("ساعت مراجعه را انتخاب کنید.");
    setBusy(true);
    const data = await apiJson<{ request: Req }>("/api/physical", {
      method: "POST",
      body: JSON.stringify({ productId, quantity: qty, branchId, pickupDate: day, pickupSlot: slot }),
    });
    setBusy(false);
    if (!data.ok) {
      if (data.error === "verification_required") return gate.openGate(data.nextStep as VerificationStep);
      return setErr(data.message ?? "ثبت درخواست ممکن نشد.");
    }
    setDone(data.request);
    setProductId("");
    setQty(1);
    setDay("");
    setSlot("");
    await Promise.all([load(), store.refreshFinancial()]);
  };

  const cancel = async (id: string) => {
    if (!confirm("درخواست لغو شود؟ فلز رزروشده به موجودی برمی‌گردد.")) return;
    const data = await apiJson(`/api/physical/${id}/cancel`, { method: "POST" });
    if (!data.ok) return setErr(data.message ?? "لغو ممکن نشد.");
    await Promise.all([load(), store.refreshFinancial()]);
  };

  const branch = settings?.branches.find((b) => b.id === branchId);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <PageHeader
        title="برداشت فیزیکی"
        description="شمش طلای ۱۸ عیار یا ساچمه نقره را حضوری در شعبه تحویل بگیرید. کارمزد ضرب و بسته‌بندی هر محصول کنار آن آمده است."
      />

      <ReceiptSheet
        open={!!done}
        onClose={() => setDone(null)}
        title="درخواست برداشت فیزیکی ثبت شد"
        subtitle="فلز برای شما رزرو شد و درخواست در صف تأیید است."
        amount={done ? ugLabel(BigInt(done.weight_ug) + BigInt(done.fee_ug)) : undefined}
        amountCaption="از موجودی شما رزرو شد (وزن + کارمزد)"
        rows={
          done
            ? [
                { label: "محصول", value: `${done.product_title} × ${done.quantity.toLocaleString("fa-IR")}` },
                { label: "شعبه", value: done.branch_name },
                { label: "نوبت مراجعه", value: `${faWeekdayDate(done.pickup_date)} · ${done.pickup_slot}` },
                { label: "زمان ثبت", value: formatTehranJalaliDateTime(done.created_at) },
              ]
            : []
        }
        trackingCode={done?.tracking_code}
        steps={["ثبت", "تأیید", "تحویل"]}
        activeStep={0}
        reassurance={["تا تحویل یا لغو، فلز رزروشده از موجودی شما خارج نمی‌شود.", "تحویل فقط با کارت ملی به خود صاحب حساب انجام می‌شود."]}
        actions={[
          { label: "پیگیری درخواست", primary: true, onClick: () => { setDone(null); setTimeout(() => document.getElementById("delivery-requests")?.scrollIntoView({ behavior: "smooth" }), 50); } },
          { label: "بازگشت", onClick: () => setDone(null) },
        ]}
      />

      <AppCard className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] font-bold text-text">۱. محصول</p>
          {products.length === 0 ? (
            <p className="text-[13px] text-muted-app">فعلاً محصولی برای تحویل تعریف نشده است.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(p.id)}
                  className={cn(
                    "rounded-xl border p-3 text-right transition",
                    productId === p.id ? "border-[#FFB800] bg-[#FFF7E0]" : "border-black/10 bg-[#F6F4F1]"
                  )}
                >
                  <p className="text-[13px] font-bold text-text">{p.title}</p>
                  <p className="mt-1 text-[12px] text-muted-app">
                    {METAL_LABEL[p.asset]} · {ugLabel(p.weight_ug)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-app">
                    کارمزد {((p.fee_percent ?? settings?.feePercent ?? 0) * 100).toLocaleString("fa-IR")}٪
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {product && (
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-text">تعداد</p>
            <div className="flex items-center gap-3">
              <button type="button" className="h-9 w-9 rounded-full border border-black/10 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span className="w-8 text-center text-[16px] font-bold">{qty.toLocaleString("fa-IR")}</span>
              <button type="button" className="h-9 w-9 rounded-full border border-black/10 text-lg" onClick={() => setQty((q) => Math.min(100, q + 1))}>+</button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[13px] font-bold text-text">۲. محل تحویل</p>
          <div className="space-y-2">
            {settings?.branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBranchId(b.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl border p-3 text-right",
                  branchId === b.id ? "border-[#FFB800] bg-[#FFF7E0]" : "border-black/10 bg-[#F6F4F1]"
                )}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C08A00]" />
                <span>
                  <span className="block text-[13px] font-bold text-text">{b.name}</span>
                  <span className="block text-[12px] text-muted-app">{b.address}</span>
                  <span className="block text-[12px] text-muted-app">{b.hours}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-bold text-text">۳. زمان مراجعه</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={cn(
                  "shrink-0 rounded-xl border px-3 py-2 text-[12px]",
                  day === d ? "border-[#FFB800] bg-[#FFF7E0] font-bold" : "border-black/10 bg-[#F6F4F1]"
                )}
              >
                {faWeekdayDate(d)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {settings?.slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-[12px]",
                  slot === s ? "border-[#FFB800] bg-[#FFF7E0] font-bold" : "border-black/10 bg-[#F6F4F1]"
                )}
              >
                ساعت {s}
              </button>
            ))}
          </div>
        </div>

        {product && settings && (
          <div className="space-y-1.5 rounded-xl bg-[#F6F4F1] p-4 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-app">وزن تحویلی</span><span>{ugLabel(weight)}</span></div>
            <div className="flex justify-between"><span className="text-muted-app">کارمزد ضرب و بسته‌بندی ({(feePct * 100).toLocaleString("fa-IR")}٪)</span><span>{ugLabel(fee)}</span></div>
            <div className="flex justify-between font-bold"><span>کسر از موجودی {METAL_LABEL[product.asset]}</span><span>{ugLabel(weight + fee)}</span></div>
            <div className="flex justify-between text-[12px]"><span className="text-muted-app">موجودی فعلی</span><span>{ugLabel(BigInt(Math.floor(balanceMg)) * 1000n)}</span></div>
            {!enough && <p className="pt-1 text-[12px] text-rose-600">موجودی {METAL_LABEL[product.asset]} شما کافی نیست. اول خرید کنید.</p>}
          </div>
        )}

        {err && <p className="text-[13px] text-rose-600">{err}</p>}
        <GoldButton type="button" variant="black" className="w-full" disabled={busy || !product || !enough} onClick={submit}>
          {busy ? "در حال ثبت…" : "ثبت درخواست برداشت"}
        </GoldButton>
        {branch && <p className="text-center text-[11px] text-muted-app">هنگام مراجعه کارت ملی و کد پیگیری همراه داشته باشید.</p>}
      </AppCard>

      <div id="delivery-requests">
        <h2 className="mb-3 text-[16px] font-bold">درخواست‌های من</h2>
        {requests.length === 0 ? (
          <EmptyState title="هنوز درخواستی ندارید" description="درخواست‌های برداشت فیزیکی و وضعیت آن‌ها اینجا دیده می‌شود." icon={Package} />
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const st = STATUS[r.status] ?? STATUS.PENDING;
              return (
                <AppCard key={r.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-text">
                      {r.product_title} × {r.quantity.toLocaleString("fa-IR")}
                    </p>
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px]", st.cls)}>{st.label}</span>
                  </div>
                  <p className="text-[12px] text-muted-app">
                    کد پیگیری <span dir="ltr">{r.tracking_code}</span> · ثبت {faDate(r.created_at, true)}
                  </p>
                  <p className="text-[12px] text-muted-app">
                    {r.branch_name} · {faWeekdayDate(r.pickup_date)} ساعت {r.pickup_slot}
                  </p>
                  <p className="text-[12px] text-muted-app">
                    کسر از موجودی: {ugLabel(BigInt(r.weight_ug) + BigInt(r.fee_ug))} (کارمزد {ugLabel(r.fee_ug)})
                  </p>
                  <p className="text-[12px] text-text-secondary">{st.hint}</p>
                  {r.admin_note && r.status !== "PENDING" && (
                    <p className="text-[12px] text-text-secondary">توضیح پشتیبانی: {r.admin_note}</p>
                  )}
                  {r.status === "PENDING" && (
                    <button type="button" onClick={() => cancel(r.id)} className="text-[12px] font-bold text-rose-600">
                      لغو درخواست
                    </button>
                  )}
                </AppCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
