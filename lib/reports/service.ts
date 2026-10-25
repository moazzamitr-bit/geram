import { getFinancialCore } from "@/lib/core/runtime";
import { CoreError } from "@/lib/core/types";

export type ReportKind = "TRADE" | "CASH" | "PHYSICAL";

export type ReportRow = {
  kind: ReportKind;
  at: string;
  title: string;
  asset: string | null;
  weightUg: string | null;
  /** Signed toman flow for the wallet, IRR. Positive = into the wallet. */
  amountIrr: string | null;
  feeIrr: string | null;
  feeUg: string | null;
  status: string;
  ref: string;
};

export type ReportFilter = { kinds: ReportKind[]; asset: string | null; from: string | null; to: string | null };

const METAL = { GOLD: "طلا", SILVER: "نقره", COPPER: "مس" } as Record<string, string>;
const PHY_STATUS: Record<string, string> = {
  PENDING: "در انتظار تأیید",
  APPROVED: "آماده تحویل",
  DELIVERED: "تحویل شد",
  REJECTED: "رد شد",
  CANCELLED: "لغو شد",
};

function cashTitle(refType: string, signed: bigint) {
  if (refType === "referral_reward") return "پاداش معرفی دوستان";
  return signed >= 0n ? "واریز تومان" : "برداشت تومان";
}

export function parseReportFilter(sp: URLSearchParams): ReportFilter {
  const kindsRaw = (sp.get("kinds") ?? "TRADE,CASH,PHYSICAL").split(",");
  const kinds = kindsRaw.filter((k): k is ReportKind => k === "TRADE" || k === "CASH" || k === "PHYSICAL");
  const asset = sp.get("asset");
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    kinds: kinds.length ? kinds : ["TRADE", "CASH", "PHYSICAL"],
    asset: asset && METAL[asset] ? asset : null,
    from: iso(sp.get("from")),
    to: iso(sp.get("to")),
  };
}

export async function userReport(userId: string, f: ReportFilter) {
  const store = getFinancialCore().ledgerStore();
  if (!store.rawQuery) throw new CoreError("misconfigured", "Postgres ledger required", 500);
  const q = store.rawQuery.bind(store);
  // Tehran day bounds: [from 00:00, to+1 00:00) in Asia/Tehran.
  const from = f.from ? `${f.from} 00:00 Asia/Tehran` : null;
  const to = f.to ? `${f.to} 00:00 Asia/Tehran` : null;
  const rows: ReportRow[] = [];

  if (f.kinds.includes("TRADE")) {
    const r = await q(
      `select id, asset, side, weight_ug::text w, gross_irr::text g, fee_irr::text fee, net_irr::text n,
              tracking_code, created_at
         from core_trades
        where user_id = $1 and status = 'SETTLED'
          and ($2::text is null or asset = $2)
          and ($3::timestamptz is null or created_at >= $3::timestamptz)
          and ($4::timestamptz is null or created_at < $4::timestamptz + interval '1 day')
        order by created_at desc limit 2000`,
      [userId, f.asset, from, to]
    );
    for (const t of r.rows as Array<Record<string, string>>) {
      const buy = t.side === "BUY";
      rows.push({
        kind: "TRADE",
        at: new Date(t.created_at).toISOString(),
        title: `${buy ? "خرید" : "فروش"} ${METAL[t.asset] ?? t.asset}`,
        asset: t.asset,
        weightUg: buy ? t.w : `-${t.w}`,
        amountIrr: buy ? `-${t.g}` : t.n,
        feeIrr: t.fee,
        feeUg: null,
        status: "انجام شد",
        ref: t.tracking_code ?? t.id,
      });
    }
  }

  if (f.kinds.includes("CASH") && !f.asset) {
    const r = await q(
      `select j.id, j.ref_type, j.created_at, sum(l.credit - l.debit)::text as signed
         from core_journals j join core_journal_lines l on l.journal_id = j.id
        where l.holder_id = $1 and l.account_code = 'USER_AVAILABLE' and l.asset = 'IRR'
          and j.ref_type not in ('trade', 'quote', 'physical_withdrawal')
          and ($2::timestamptz is null or j.created_at >= $2::timestamptz)
          and ($3::timestamptz is null or j.created_at < $3::timestamptz + interval '1 day')
        group by j.id, j.ref_type, j.created_at
        having sum(l.credit - l.debit) <> 0
        order by j.created_at desc limit 2000`,
      [userId, from, to]
    );
    for (const c of r.rows as Array<Record<string, string>>) {
      const signed = BigInt(c.signed);
      rows.push({
        kind: "CASH",
        at: new Date(c.created_at).toISOString(),
        title: cashTitle(c.ref_type, signed),
        asset: null,
        weightUg: null,
        amountIrr: c.signed,
        feeIrr: null,
        feeUg: null,
        status: "انجام شد",
        ref: c.id.slice(-10).toUpperCase(),
      });
    }
  }

  if (f.kinds.includes("PHYSICAL")) {
    const r = await q(
      `select product_title, asset, quantity, weight_ug::text w, fee_ug::text fee, status, tracking_code, created_at
         from physical_withdrawals
        where user_id = $1::uuid
          and ($2::text is null or asset = $2)
          and ($3::timestamptz is null or created_at >= $3::timestamptz)
          and ($4::timestamptz is null or created_at < $4::timestamptz + interval '1 day')
        order by created_at desc limit 2000`,
      [userId, f.asset, from, to]
    );
    for (const p of r.rows as Array<Record<string, string>>) {
      rows.push({
        kind: "PHYSICAL",
        at: new Date(p.created_at).toISOString(),
        title: `برداشت فیزیکی: ${p.product_title} × ${Number(p.quantity).toLocaleString("fa-IR")}`,
        asset: p.asset,
        weightUg: `-${p.w}`,
        amountIrr: null,
        feeIrr: null,
        feeUg: p.fee,
        status: PHY_STATUS[p.status] ?? p.status,
        ref: p.tracking_code,
      });
    }
  }

  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const summary = {
    count: rows.length,
    boughtIrr: 0n,
    soldIrr: 0n,
    depositIrr: 0n,
    withdrawIrr: 0n,
    feesIrr: 0n,
    netUg: {} as Record<string, bigint>,
  };
  for (const r of rows) {
    if (r.kind === "TRADE") {
      const amt = BigInt(r.amountIrr!);
      if (amt < 0n) summary.boughtIrr += -amt;
      else summary.soldIrr += amt;
      summary.feesIrr += BigInt(r.feeIrr ?? "0");
    }
    if (r.kind === "CASH") {
      const amt = BigInt(r.amountIrr!);
      if (amt >= 0n) summary.depositIrr += amt;
      else summary.withdrawIrr += -amt;
    }
    if (r.asset && r.weightUg && (r.kind === "TRADE" || r.status === "تحویل شد")) {
      summary.netUg[r.asset] = (summary.netUg[r.asset] ?? 0n) + BigInt(r.weightUg);
    }
  }
  return {
    rows,
    summary: {
      count: summary.count,
      boughtIrr: summary.boughtIrr.toString(),
      soldIrr: summary.soldIrr.toString(),
      depositIrr: summary.depositIrr.toString(),
      withdrawIrr: summary.withdrawIrr.toString(),
      feesIrr: summary.feesIrr.toString(),
      netUg: Object.fromEntries(Object.entries(summary.netUg).map(([k, v]) => [k, v.toString()])),
    },
  };
}

const KIND_LABEL: Record<ReportKind, string> = { TRADE: "معامله", CASH: "تومان", PHYSICAL: "برداشت فیزیکی" };

function jalali(iso: string) {
  return new Date(iso).toLocaleString("fa-IR-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const grams = (ug: string | null) => (ug == null ? "" : (Number(BigInt(ug)) / 1_000_000).toFixed(6).replace(/\.?0+$/, ""));
const toman = (irr: string | null) => (irr == null ? "" : (BigInt(irr) / 10n).toString());

/** Excel-friendly CSV: UTF-8 BOM, Jalali dates (Tehran), toman and grams as plain numbers. */
export function reportCsv(rows: ReportRow[]) {
  const head = ["تاریخ", "نوع", "شرح", "فلز", "وزن (گرم)", "مبلغ (تومان)", "کارمزد (تومان)", "کارمزد (گرم)", "وضعیت", "کد پیگیری"];
  const lines = rows.map((r) =>
    [
      jalali(r.at),
      KIND_LABEL[r.kind],
      r.title,
      r.asset ? (METAL[r.asset] ?? r.asset) : "",
      grams(r.weightUg),
      toman(r.amountIrr),
      toman(r.feeIrr),
      grams(r.feeUg),
      r.status,
      r.ref,
    ]
      .map((c) => csvCell(String(c)))
      .join(",")
  );
  return "\uFEFF" + [head.join(","), ...lines].join("\r\n") + "\r\n";
}
