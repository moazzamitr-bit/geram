import { cn } from "@/lib/utils";

export function SimulationBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning",
        className
      )}
    >
      داده نمایشی
    </span>
  );
}
