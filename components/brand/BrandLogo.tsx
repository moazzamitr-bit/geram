import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  href?: string;
  /** @deprecated Wordmark is disabled — logo mark only */
  showWordmark?: boolean;
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
}: BrandLogoProps) {
  const px = sizes[size];
  const content = (
    <span className={cn("inline-flex items-center", className)}>
      <LogoMark size={px} className={markClassName} />
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex" aria-label="صفحه اصلی گرم">
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
  return (
    <Image
      src="/brand/logo.png"
      alt=""
      width={size}
      height={size}
      priority
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
