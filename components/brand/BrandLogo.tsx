import { cn } from "@/lib/utils";
import Link from "next/link";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  href?: string;
  /** Show the «گرم» wordmark beside the mark (app/admin chrome). */
  showWordmark?: boolean;
  wordmarkClassName?: string;
  /** "light" = white logotype for dark backgrounds (admin sidebar). */
  tone?: "dark" | "light";
  logotypeHeight?: number;
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
  tone = "dark",
  logotypeHeight,
}: BrandLogoProps) {
  const px = sizes[size];
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={px} className={markClassName} />
      {showWordmark ? (
        <Logotype height={logotypeHeight ?? Math.round(px * 0.86)} tone={tone} className={wordmarkClassName} />
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
  const srcSet = base === 40 ? "/brand/logo-40.webp?v=3 1x, /brand/logo-80.webp?v=3 2x, /brand/logo-120.webp?v=3 3x" : "/brand/logo-80.webp?v=3 1x, /brand/logo-120.webp?v=3 2x";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/logo-${base}.webp?v=3`}
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

/** Brand logotype image («گرم» + GERAM); width follows the 1.86:1 artwork. */
export function Logotype({
  height = 32,
  tone = "dark",
  className,
}: {
  height?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  const f = (h: number) => `/brand/logotype-${tone}-${h}.webp?v=3`;
  const base = height <= 32 ? 32 : 64;
  const srcSet = base === 32 ? `${f(32)} 1x, ${f(64)} 2x, ${f(96)} 3x` : `${f(64)} 1x, ${f(96)} 2x`;
  const width = Math.round(height * 1.86);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={f(base)}
      srcSet={srcSet}
      alt="گرم"
      width={width}
      height={height}
      decoding="async"
      className={cn("block shrink-0 object-contain", className)}
      style={{ width, height }}
    />
  );
}
