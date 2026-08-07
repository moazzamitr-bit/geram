import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type GoldButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
};

export const GoldButton = forwardRef<HTMLButtonElement, GoldButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const sizes = {
      sm: "h-10 px-4 text-sm",
      md: "h-[52px] px-6 text-[15px]",
      lg: "h-14 px-8 text-base",
    };

    const variants = {
      primary:
        "bg-gold-gradient text-[#0A0C0E] font-bold shadow-[0_8px_24px_rgba(138,101,38,0.28)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(138,101,38,0.38)] active:translate-y-0 active:scale-[0.98]",
      secondary:
        "bg-transparent text-text border border-white/10 hover:border-gold/40 hover:text-gold-highlight hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
      ghost:
        "bg-transparent text-text-secondary hover:text-text hover:-translate-y-0.5 active:translate-y-0",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[12px] transition-all duration-250 ease-out cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
          sizes[size],
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GoldButton.displayName = "GoldButton";
