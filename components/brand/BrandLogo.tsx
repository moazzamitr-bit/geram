import { cn } from "@/lib/utils";
import Link from "next/link";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  href?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { mark: 24, text: "text-[20px]" },
  md: { mark: 34, text: "text-[28px]" },
  lg: { mark: 40, text: "text-[32px]" },
};

export function BrandLogo({
  className,
  markClassName,
  href = "/",
  showWordmark = true,
  size = "md",
}: BrandLogoProps) {
  const s = sizes[size];
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={s.mark} className={markClassName} />
      {showWordmark && (
        <span className={cn("font-extrabold tracking-tight text-text", s.text)}>
          گرم
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex" aria-label="گرم — صفحه اصلی">
      {content}
    </Link>
  );
}

export function LogoMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      aria-hidden
      className={cn("text-gold shrink-0", className)}
    >
      <circle cx="17" cy="17" r="15.2" stroke="url(#gram-logo-g)" strokeWidth="1.4" />
      <circle
        cx="17"
        cy="17"
        r="9.5"
        stroke="url(#gram-logo-g)"
        strokeWidth="1.1"
        opacity="0.7"
      />
      <path
        d="M17 7.5L19.6 14.1L26.5 14.8L21.2 19.2L22.7 26L17 22.4L11.3 26L12.8 19.2L7.5 14.8L14.4 14.1L17 7.5Z"
        stroke="url(#gram-logo-g)"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="gram-logo-g" x1="4" y1="4" x2="30" y2="30">
          <stop stopColor="#8A6526" />
          <stop offset="0.45" stopColor="#D6A84B" />
          <stop offset="0.7" stopColor="#F0C568" />
          <stop offset="1" stopColor="#A97A2E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
