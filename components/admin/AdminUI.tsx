import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "gold" | "positive" | "warning";
}) {
  const tones = {
    default: "text-white",
    gold: "text-gold",
    positive: "text-positive",
    warning: "text-warning",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-white/50">{label}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-gold">
          <Icon size={18} />
        </span>
      </div>
      <p className={cn("mt-4 text-[28px] font-extrabold tabular-nums", tones[tone])}>
        {value}
      </p>
      {hint && <p className="mt-2 text-[12px] text-white/40">{hint}</p>}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[24px] font-extrabold md:text-[28px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-7 text-white/50">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AdminTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#0F1724] px-6 py-16 text-center text-[14px] text-white/50">
        داده‌ای برای نمایش نیست. اتصال سوپابیس یا seed را بررسی کنید.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F1724]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-right text-[13px]">
          <thead className="border-b border-white/10 text-white/45">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-3 font-medium md:px-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold" | "positive" | "warning" | "negative";
}) {
  const map = {
    neutral: "border-white/10 bg-white/5 text-white/70",
    gold: "border-gold/25 bg-gold/10 text-gold",
    positive: "border-positive/25 bg-positive/10 text-positive",
    warning: "border-warning/25 bg-warning/10 text-warning",
    negative: "border-negative/25 bg-negative/10 text-negative",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px]", map[tone])}>
      {children}
    </span>
  );
}
