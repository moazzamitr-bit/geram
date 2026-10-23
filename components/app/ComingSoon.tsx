import { AppCard } from "@/components/app/AppCard";
import { GoldButton } from "@/components/ui/GoldButton";
import Link from "next/link";

type ComingSoonProps = {
  title: string;
  description: string;
};

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div>
      <h1 className="text-[24px] font-extrabold text-text md:text-[28px]">
        {title}
      </h1>
      <AppCard className="mt-6">
        <p className="text-[15px] leading-8 text-muted-app">{description}</p>
        <p className="mt-3 text-[12px] text-muted-app">این بخش هنوز آماده نیست.</p>
        <Link href="/app/dashboard" className="mt-6 inline-flex">
          <GoldButton type="button" size="sm">
            بازگشت به خانه
          </GoldButton>
        </Link>
      </AppCard>
    </div>
  );
}
