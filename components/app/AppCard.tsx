import { cn } from "@/lib/utils";

type AppCardProps = {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
};

export function AppCard({ children, className, padded = true, id }: AppCardProps) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border border-border bg-card-app shadow-[0_10px_30px_rgba(28,25,23,0.04)]",
        padded && "p-5 md:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
