"use client";

import { GoldButton } from "@/components/ui/GoldButton";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProcurementActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState("");

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "خطا");
        return;
      }
      router.refresh();
    } catch {
      setError("خطای شبکه");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {(status === "PENDING" || status === "APPROVED") && (
        <div className="flex flex-wrap gap-2">
          <input
            dir="ltr"
            className="h-9 w-36 rounded-lg border border-white/10 bg-[#070B12] px-2 text-[12px]"
            placeholder="cost toman"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <input
            className="h-9 w-36 rounded-lg border border-white/10 bg-[#070B12] px-2 text-[12px]"
            placeholder="تأمین‌کننده"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" && (
          <>
            <GoldButton
              type="button"
              size="sm"
              disabled={loading}
              onClick={() =>
                void run("replenish_decide", {
                  decision: "APPROVED",
                  acquisitionCostToman: Number(cost) || undefined,
                  supplier: supplier || undefined,
                })
              }
            >
              تأیید
            </GoldButton>
            <GoldButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() =>
                void run("replenish_decide", { decision: "REJECTED" })
              }
            >
              رد
            </GoldButton>
          </>
        )}
        {status === "APPROVED" && (
          <GoldButton
            type="button"
            size="sm"
            disabled={loading}
            onClick={() =>
              void run("replenish_execute", {
                acquisitionCostToman: Number(cost) || undefined,
                supplier: supplier || undefined,
              })
            }
          >
            اجرای خرید
          </GoldButton>
        )}
      </div>
      {error && <p className="text-[12px] text-negative">{error}</p>}
    </div>
  );
}

export function ProcurementCreateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  return (
    <div className="flex items-center gap-3">
      <GoldButton
        type="button"
        size="sm"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMsg("");
          try {
            const res = await fetch("/api/admin/treasury", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "replenish_create", asset: "GOLD" }),
            });
            const data = (await res.json()) as {
              ok: boolean;
              error?: string;
              recommendation?: unknown;
            };
            if (!data.ok) {
              setMsg(data.error === "null" || !data.recommendation
                ? data.error ?? "پیشنهادی لازم نیست (پوشش کافی)"
                : data.error ?? "خطا");
            } else if (!data.recommendation) {
              setMsg("پوشش کافی است — پیشنهادی ساخته نشد.");
            } else {
              setMsg("پیشنهاد ثبت شد.");
              router.refresh();
            }
          } catch {
            setMsg("خطای شبکه");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "..." : "تولید پیشنهاد GOLD"}
      </GoldButton>
      {msg && <span className="text-[12px] text-white/55">{msg}</span>}
    </div>
  );
}

export function ManualPurchaseForm() {
  const router = useRouter();
  const [weightGrams, setWeightGrams] = useState("1000");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  return (
    <form
      className="rounded-2xl border border-white/10 bg-[#0F1724] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          setLoading(true);
          setMsg("");
          try {
            const weightMg = Math.floor(Number(weightGrams) * 1000);
            const res = await fetch("/api/admin/treasury", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "purchase",
                asset: "GOLD",
                weightMg,
                acquisitionCostToman: Number(cost),
                supplier,
              }),
            });
            const data = (await res.json()) as { ok: boolean; error?: string };
            if (!data.ok) {
              setMsg(data.error ?? "خطا");
              return;
            }
            setMsg("لات انبار ثبت شد.");
            setCost("");
            router.refresh();
          } catch {
            setMsg("خطای شبکه");
          } finally {
            setLoading(false);
          }
        })();
      }}
    >
      <h2 className="font-bold">ثبت خرید فیزیکی (با مسیر رویداد)</h2>
      <p className="mt-1 text-[12px] text-white/45">
        این فرم لات + movement از نوع PURCHASE می‌سازد — ویرایش موجودی دستی نیست.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-[12px] text-white/55">
          وزن (گرم)
          <input
            dir="ltr"
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#070B12] px-3"
            value={weightGrams}
            onChange={(e) => setWeightGrams(e.target.value)}
            required
          />
        </label>
        <label className="text-[12px] text-white/55">
          بهای تمام‌شده (تومان)
          <input
            dir="ltr"
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#070B12] px-3"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
          />
        </label>
        <label className="text-[12px] text-white/55">
          تأمین‌کننده
          <input
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#070B12] px-3"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <GoldButton type="submit" size="sm" disabled={loading}>
          {loading ? "..." : "ثبت لات"}
        </GoldButton>
        {msg && <span className="text-[12px] text-white/55">{msg}</span>}
      </div>
    </form>
  );
}
