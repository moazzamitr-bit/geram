import { cn } from "@/lib/utils";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  backHref?: string;
};

export function PageHeader({
  title,
  description,
  action,
  className,
  backHref,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-block text-[13px] text-muted-app hover:text-gold"
          >
            بازگشت
          </Link>
        )}
        <h1 className="text-[24px] font-extrabold text-text md:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-[14px] leading-7 text-muted-app">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
