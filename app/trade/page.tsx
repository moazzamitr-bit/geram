import {
  parseTradeMetalSlug,
  parseTradeSide,
  tradePath,
} from "@/lib/market/trade-routes";
import { notFound, redirect } from "next/navigation";

export default async function PublicTradeRedirect({
  searchParams,
}: {
  searchParams: Promise<{ metal?: string; instrument?: string; side?: string }>;
}) {
  const query = await searchParams;
  const slug = parseTradeMetalSlug(query.metal) ?? parseTradeMetalSlug(query.instrument);
  if (!slug) notFound();
  redirect(tradePath(slug, parseTradeSide(query.side)));
}
