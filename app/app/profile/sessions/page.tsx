"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useState } from "react";

type Session = {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
};

const seed: Session[] = [
  {
    id: "s1",
    device: "Safari · macOS",
    location: "تهران",
    lastActive: "اکنون",
    current: true,
  },
  {
    id: "s2",
    device: "Chrome · Android",
    location: "تهران",
    lastActive: "دیروز، ۲۲:۱۰",
    current: false,
  },
];

export default function SessionsPage() {
  const [sessions, setSessions] = useState(seed);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="نشست‌های فعال"
        description="دستگاه‌هایی که به حساب شما وارد شده‌اند."
        backHref="/app/profile"
        action={<SimulationBadge />}
      />

      <div className="space-y-3">
        {sessions.map((s) => (
          <AppCard key={s.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-text">
                {s.device}
                {s.current && (
                  <span className="mr-2 text-[11px] text-positive"> (فعلی)</span>
                )}
              </p>
              <p className="mt-1 text-[12px] text-muted-app">
                {s.location} · {s.lastActive}
              </p>
            </div>
            {!s.current && (
              <GoldButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setSessions((list) => list.filter((x) => x.id !== s.id))}
              >
                خروج
              </GoldButton>
            )}
          </AppCard>
        ))}
      </div>

      <GoldButton
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => setSessions((list) => list.filter((s) => s.current))}
      >
        خروج از همه دستگاه‌های دیگر
      </GoldButton>
    </div>
  );
}
