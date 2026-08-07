import { cn } from "@/lib/utils";

type AppCardProps = {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
};

export function AppCard({ children, className, padded = true }: AppCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-card-app",
        padded && "p-5 md:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
