import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type SectionLabelProps = {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function SectionLabel({ children, icon, className }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-gold text-sm font-medium tracking-wide",
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}
