import { GoldIcon } from "@/components/ui/GoldIcon";
import { metrics } from "@/lib/data";
import { cn } from "@/lib/utils";

export function MetricsSection() {
  return (
    <section
      id="club"
      className="relative py-14 md:py-16"
      aria-label="آمار و اعتماد"
    >
      <div className="container-site">
        <div className="rounded-[20px] border border-white/[0.07] bg-bg-secondary px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
            <div className="flex shrink-0 items-start gap-4 lg:max-w-[260px]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/[0.08]">
                <GoldIcon name="shield" size={24} />
              </span>
              <div>
                <h2 className="text-[20px] font-bold text-text md:text-[22px]">
                  اعتماد هزاران نفر
                </h2>
                <p className="mt-1 text-[13px] text-text-secondary">
                  سرمایه‌گذاری مطمئن با گرم
                </p>
              </div>
            </div>

            <ul className="grid flex-1 grid-cols-2 gap-6 md:grid-cols-4 md:gap-0">
              {metrics.map((metric, i) => (
                <li
                  key={metric.label}
                  className={cn(
                    "text-center md:px-4",
                    i < metrics.length - 1 && "md:border-l md:border-white/[0.07]"
                  )}
                >
                  <p className="text-[28px] font-extrabold tracking-tight text-gold md:text-[32px]">
                    {metric.value}
                  </p>
                  <p className="mt-1.5 text-[13px] text-text-secondary">
                    {metric.label}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Alias for TrustStrip naming in the brief */
export { MetricsSection as TrustStrip };
