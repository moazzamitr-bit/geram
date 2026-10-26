import { cn } from "@/lib/utils";
import Link from "next/link";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  href?: string;
  /** Show the «گرم» wordmark beside the mark (app/admin chrome). */
  showWordmark?: boolean;
  wordmarkClassName?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: 36,
  md: 48,
  lg: 64,
};

export function BrandLogo({
  className,
  markClassName,
  href = "/",
  size = "md",
  showWordmark = false,
  wordmarkClassName,
}: BrandLogoProps) {
  const px = sizes[size];
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={px} className={markClassName} />
      {showWordmark ? (
        <span className={cn("text-[20px] font-black leading-none tracking-tight", wordmarkClassName)}>گرم</span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} prefetch={false} className="inline-flex" aria-label="صفحه اصلی گرم">
      {content}
    </Link>
  );
}

export function LogoMark({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // Pre-sized webp renditions of public/brand/logo.png (40/80/120 px); 1x + 2x/3x via srcSet.
  const base = size <= 40 ? 40 : size <= 80 ? 80 : 120;
  const srcSet = base === 40 ? "/brand/logo-40.webp 1x, /brand/logo-80.webp 2x, /brand/logo-120.webp 3x" : "/brand/logo-80.webp 1x, /brand/logo-120.webp 2x";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/logo-${base}.webp`}
      srcSet={srcSet}
      alt=""
      width={size}
      height={size}
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
