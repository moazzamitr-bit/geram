import {
  parseTradeMetalSlug,
  parseTradeSide,
  tradePath,
} from "@/lib/market/trade-routes";
import { notFound, redirect } from "next/navigation";

export default async function PublicMetalTradeRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ metal: string }>;
  searchParams: Promise<{ side?: string }>;
}) {
  const { metal } = await params;
  const slug = parseTradeMetalSlug(metal);
  if (!slug) notFound();
  const { side } = await searchParams;
  redirect(tradePath(slug, parseTradeSide(side)));
}
