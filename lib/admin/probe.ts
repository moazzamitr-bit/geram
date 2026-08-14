import { adminDb } from "./queries";

export type ProbeResult<T> = {
  ready: boolean;
  rows: T[];
  error?: string;
};

export async function probeTable<T = Record<string, unknown>>(
  table: string,
  select = "*",
  opts?: {
    eq?: [string, string];
    in?: [string, string[]];
    ilike?: [string, string];
    or?: string;
    order?: string;
    ascending?: boolean;
    limit?: number;
  }
): Promise<ProbeResult<T>> {
  const sb = await adminDb();
  if (!sb) return { ready: false, rows: [], error: "database unavailable" };
  try {
    let q = sb.from(table).select(select);
    if (opts?.eq) q = q.eq(opts.eq[0], opts.eq[1]);
    if (opts?.in) q = q.in(opts.in[0], opts.in[1]);
    if (opts?.ilike) q = q.ilike(opts.ilike[0], opts.ilike[1]);
    if (opts?.or) q = q.or(opts.or);
    if (opts?.order) q = q.order(opts.order, { ascending: opts.ascending ?? false });
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) return { ready: false, rows: [], error: error.message };
    return { ready: true, rows: (data ?? []) as T[] };
  } catch (err) {
    return { ready: false, rows: [], error: err instanceof Error ? err.message : "probe failed" };
  }
}

export async function probeCount(table: string, eq?: [string, string]) {
  const sb = await adminDb();
  if (!sb) return { ready: false as const, count: null as number | null, error: "database unavailable" };
  try {
    let q = sb.from(table).select("id", { count: "exact", head: true });
    if (eq) q = q.eq(eq[0], eq[1]);
    const { count, error } = await q;
    if (error) return { ready: false as const, count: null, error: error.message };
    return { ready: true as const, count: count ?? 0 };
  } catch (err) {
    return { ready: false as const, count: null, error: err instanceof Error ? err.message : "probe failed" };
  }
}
