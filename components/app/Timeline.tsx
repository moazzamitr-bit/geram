import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function Timeline({
  items,
}: {
  items: { label: string; done: boolean; at?: string }[];
}) {
  return (
    <ol className="space-y-0">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span
              className={cn(
                "absolute right-[11px] top-6 h-[calc(100%-12px)] w-px",
                item.done ? "bg-gold/40" : "bg-white/10"
              )}
            />
          )}
          <span
            className={cn(
              "relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
              item.done
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-muted-app"
            )}
          >
            {item.done ? <Check size={12} strokeWidth={2.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <div className="pt-0.5">
            <p className={cn("text-[13px]", item.done ? "text-text" : "text-muted-app")}>
              {item.label}
            </p>
            {item.at && <p className="mt-0.5 text-[11px] text-muted-app">{item.at}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
