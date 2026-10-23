"use client";

import { TradeDesk } from "@/components/app/TradeDesk";
import { Suspense } from "react";

export default function BuyPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-6 text-muted-app">در حال بارگذاری...</div>}>
      <TradeDesk side="buy" />
    </Suspense>
  );
}
