import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-xl bg-white/[0.06]", className)}
      aria-hidden
    />
  );
}

export function AppShellSkeleton() {
  return (
    <div className="min-h-svh bg-bg px-4 py-6 md:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال آماده‌سازی پنل...</span>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}
