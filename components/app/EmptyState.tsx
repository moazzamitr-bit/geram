import { GoldButton } from "@/components/ui/GoldButton";
import { cn } from "@/lib/utils";
import { type LucideIcon, Inbox } from "lucide-react";
import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-white/10 bg-card-app px-6 py-12 text-center",
        className
      )}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
        <Icon size={22} strokeWidth={1.7} />
      </span>
      <h3 className="mt-4 text-[18px] font-bold text-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-7 text-muted-app">
        {description}
      </p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-6 inline-flex">
          <GoldButton type="button" size="sm">
            {actionLabel}
          </GoldButton>
        </Link>
      )}
    </div>
  );
}
