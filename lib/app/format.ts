/** Shared display helpers for ledger-backed services (string micrograms / IRR from the API). */

export const METAL_LABEL: Record<string, string> = {
  GOLD: "طلا",
  SILVER: "نقره",
  COPPER: "مس",
};

export const fieldClass =
  "h-12 w-full rounded-xl border border-black/10 bg-[#F6F4F1] px-4 text-[15px] text-text outline-none transition focus:border-[#FFB800] focus:bg-white";

/** Micrograms → "۱۰٫۱ گرم" (up to 3 decimals). */
export function ugLabel(ug: string | number | bigint): string {
  const n = Number(BigInt(String(ug))) / 1_000_000;
  return `${n.toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`;
}

/** IRR (string) → toman label. */
export function irrToTomanLabel(irr: string | number | bigint): string {
  const t = Number(BigInt(String(irr)) / 10n);
  return `${t.toLocaleString("fa-IR")} تومان`;
}

export function faDate(iso: string, withTime = false): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleString("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function faWeekdayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("fa-IR-u-ca-persian", { weekday: "long", month: "long", day: "numeric" });
}

/** Next N pickup days from today+lead, skipping Fridays. ISO yyyy-mm-dd. */
export function upcomingDays(lead: number, count = 7): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + lead);
  while (out.length < count) {
    if (d.getDay() !== 5) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      out.push(`${y}-${m}-${day}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T & { ok: boolean; error?: string; message?: string; nextStep?: string }> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({ ok: false, message: "پاسخ نامعتبر از سرور" }));
  if (!res.ok && data.ok !== false) data.ok = false;
  return data;
}
