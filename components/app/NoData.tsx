import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

export function NoData({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.03] text-muted-app">
        <FileText size={26} strokeWidth={1.4} />
      </span>
      <p className="text-[13px] text-muted-app">داده‌ای برای نمایش وجود ندارد</p>
    </div>
  );
}
