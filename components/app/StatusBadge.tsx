import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  "تکمیل‌شده": "bg-positive/10 text-positive border-positive/20",
  "در انتظار تسویه": "bg-warning/10 text-warning border-warning/20",
  "در حال پردازش": "bg-gold/10 text-gold border-gold/20",
  ناموفق: "bg-negative/10 text-negative border-negative/20",
  "لغو شده": "bg-white/5 text-muted-app border-white/10",
  OPEN: "bg-gold/10 text-gold border-gold/20",
  ACTIVE: "bg-positive/10 text-positive border-positive/20",
  REQUESTED: "bg-gold/10 text-gold border-gold/20",
  VERIFIED: "bg-positive/10 text-positive border-positive/20",
  UNVERIFIED: "bg-warning/10 text-warning border-warning/20",
  PENDING: "bg-warning/10 text-warning border-warning/20",
  WAITING_USER: "bg-warning/10 text-warning border-warning/20",
  REJECTED: "bg-negative/10 text-negative border-negative/20",
  NEEDS_UPDATE: "bg-warning/10 text-warning border-warning/20",
  TRIGGERED: "bg-gold/10 text-gold border-gold/20",
  DISABLED: "bg-white/5 text-muted-app border-white/10",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        map[status] ?? "bg-white/5 text-muted-app border-white/10",
        className
      )}
    >
      {status}
    </span>
  );
}
