import { TradeDesk } from "@/components/app/TradeDesk";
import {
  parseTradeMetalSlug,
  parseTradeSide,
  tradeMetalBySlug,
  tradePath,
} from "@/lib/market/trade-routes";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

export function generateStaticParams() {
  return [{ metal: "gold" }, { metal: "silver" }, { metal: "copper" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metal: string }>;
}): Promise<Metadata> {
  const { metal } = await params;
  const slug = parseTradeMetalSlug(metal);
  if (!slug) return { title: "خرید و فروش" };
  return { title: `خرید و فروش ${tradeMetalBySlug(slug).title}` };
}

export default async function MetalTradePage({
  params,
  searchParams,
}: {
  params: Promise<{ metal: string }>;
  searchParams: Promise<{ side?: string }>;
}) {
  const { metal } = await params;
  const slug = parseTradeMetalSlug(metal);
  if (!slug) notFound();
  const { side: sideParam } = await searchParams;
  const side = parseTradeSide(sideParam);
  if (metal !== slug) redirect(tradePath(slug, side));

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl p-6 text-muted-app">در حال بارگذاری...</div>
      }
    >
      <TradeDesk side={side} instrument={tradeMetalBySlug(slug).instrument} />
    </Suspense>
  );
}
