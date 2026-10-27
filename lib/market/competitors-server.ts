import { createServiceClient } from "@/lib/supabase/admin";
import { getLivePrice } from "@/lib/market/price-provider";
import { refreshCompetitors, RETENTION_DAYS, type SnapshotSink } from "@/lib/market/competitors";

/** Persist snapshots (informational history) and prune rows older than RETENTION_DAYS. */
export const supabaseSnapshotSink: SnapshotSink = async (rows) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const db = createServiceClient();
  // Our own display reference at the same moment, so the chart can show our line too.
  const ours = await getLivePrice("gold18").catch(() => null);
  const all = ours && ours.priceToman > 0 && !ours.stale
    ? [...rows, { competitor: "geram", buy_toman: ours.priceToman, sell_toman: ours.priceToman, observed_at: rows[0].observed_at }]
    : rows;
  const { error } = await db.from("competitor_price_snapshots").insert(all);
  if (error) throw new Error(error.message);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await db.from("competitor_price_snapshots").delete().lt("observed_at", cutoff);
};

export function pollCompetitors(force = false) {
  return refreshCompetitors({ force, sink: supabaseSnapshotSink });
}

export async function loadCompetitorHistory(hours = 24) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data } = await createServiceClient()
    .from("competitor_price_snapshots")
    .select("competitor, buy_toman, sell_toman, observed_at")
    .gte("observed_at", since)
    .order("observed_at", { ascending: true })
    .limit(5000);
  return (data ?? []) as { competitor: string; buy_toman: number; sell_toman: number; observed_at: string }[];
}
