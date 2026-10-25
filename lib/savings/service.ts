import "server-only";
import { CoreError } from "@/lib/core/types";
import { buyFromLedger } from "@/lib/commerce/ledger-buy";
import { isPlusActive } from "@/lib/commerce/fees";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { readVerification } from "@/lib/kyc/verification";
import { createServiceClient } from "@/lib/supabase/admin";
import { CADENCE_LABEL, firstRunAt, nextRunAfter, type Cadence } from "@/lib/savings/schedule";

export const SAVINGS_ASSETS = ["GOLD", "SILVER", "COPPER"] as const;
export type SavingsAsset = (typeof SAVINGS_ASSETS)[number];
export const SAVINGS_MIN_TOMAN = 100_000; // engine minimum trade
export const SAVINGS_MAX_TOMAN = 100_000_000;
/** After this many failed runs in a row the plan pauses itself. */
export const SAVINGS_MAX_FAIL_STREAK = 3;

const ASSET_FA: Record<SavingsAsset, string> = { GOLD: "طلا", SILVER: "نقره", COPPER: "مس" };

export class SavingsError extends CoreError {
  constructor(message: string, status = 400) {
    super("savings_invalid", message, status);
  }
}

export type SavingsPlan = {
  id: string;
  asset: SavingsAsset;
  amountToman: number;
  cadence: Cadence;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  nextRunAt: string;
  lastRunAt: string | null;
  failStreak: number;
  createdAt: string;
};

export type SavingsRun = {
  id: string;
  planId: string;
  runFor: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  tradeId: string | null;
  amountIrr: string | null;
  weightUg: string | null;
  feeIrr: string | null;
  error: string | null;
};

type PlanRow = Record<string, unknown>;

function toPlan(r: PlanRow): SavingsPlan {
  return {
    id: String(r.id),
    asset: r.asset as SavingsAsset,
    amountToman: Number(r.amount_toman),
    cadence: r.cadence as Cadence,
    status: r.status as SavingsPlan["status"],
    nextRunAt: String(r.next_run_at),
    lastRunAt: (r.last_run_at as string | null) ?? null,
    failStreak: Number(r.fail_streak ?? 0),
    createdAt: String(r.created_at),
  };
}

function toRun(r: PlanRow): SavingsRun {
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    id: String(r.id),
    planId: String(r.plan_id),
    runFor: String(r.run_for),
    status: r.status as SavingsRun["status"],
    tradeId: s(r.trade_id),
    amountIrr: s(r.amount_irr),
    weightUg: s(r.weight_ug),
    feeIrr: s(r.fee_irr),
    error: s(r.error),
  };
}

async function maxActivePlans(userId: string) {
  const settings = await loadCommerceSettings();
  const db = createServiceClient();
  const { data } = await db.from("profiles").select("plan_tier, plan_expires_at").eq("id", userId).maybeSingle();
  const plus = isPlusActive((data?.plan_tier as "free" | "plus") ?? "free", data?.plan_expires_at as string | null);
  return plus ? settings.plus.maxDcaPlus : settings.plus.maxDcaFree;
}

export async function savingsOverview(userId: string) {
  const db = createServiceClient();
  const [plans, runs, limit] = await Promise.all([
    db.from("scheduled_purchases").select("*").eq("user_id", userId).neq("status", "CANCELLED").order("created_at", { ascending: false }),
    db.from("scheduled_purchase_runs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    maxActivePlans(userId),
  ]);
  if (plans.error) throw new Error(plans.error.message);
  return {
    plans: (plans.data ?? []).map(toPlan),
    runs: (runs.data ?? []).map(toRun),
    limits: { minToman: SAVINGS_MIN_TOMAN, maxToman: SAVINGS_MAX_TOMAN, maxActive: limit },
  };
}

export async function createSavingsPlan(
  userId: string,
  input: { asset: unknown; amountToman: unknown; cadence: unknown }
) {
  const asset = String(input.asset) as SavingsAsset;
  const cadence = String(input.cadence) as Cadence;
  const amount = Math.floor(Number(input.amountToman));
  if (!SAVINGS_ASSETS.includes(asset)) throw new SavingsError("فلز انتخاب‌شده معتبر نیست.");
  if (!(cadence in CADENCE_LABEL)) throw new SavingsError("دوره خرید معتبر نیست.");
  if (!Number.isFinite(amount) || amount < SAVINGS_MIN_TOMAN)
    throw new SavingsError(`حداقل مبلغ هر خرید ${SAVINGS_MIN_TOMAN.toLocaleString("fa-IR")} تومان است.`);
  if (amount > SAVINGS_MAX_TOMAN)
    throw new SavingsError(`حداکثر مبلغ هر خرید ${SAVINGS_MAX_TOMAN.toLocaleString("fa-IR")} تومان است.`);

  const db = createServiceClient();
  const limit = await maxActivePlans(userId);
  const { count } = await db
    .from("scheduled_purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ACTIVE");
  if ((count ?? 0) >= limit)
    throw new SavingsError(`حداکثر ${limit.toLocaleString("fa-IR")} طرح فعال می‌توانید داشته باشید.`, 409);

  const { data, error } = await db
    .from("scheduled_purchases")
    .insert({
      user_id: userId,
      asset,
      amount_toman: amount,
      cadence,
      status: "ACTIVE",
      next_run_at: firstRunAt().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toPlan(data);
}

export async function updateSavingsPlan(userId: string, planId: string, action: unknown) {
  const db = createServiceClient();
  const { data: row } = await db
    .from("scheduled_purchases")
    .select("*")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || row.status === "CANCELLED") throw new SavingsError("طرح پیدا نشد.", 404);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (action === "pause") {
    if (row.status !== "ACTIVE") throw new SavingsError("این طرح فعال نیست.", 409);
    patch.status = "PAUSED";
  } else if (action === "resume") {
    if (row.status !== "PAUSED") throw new SavingsError("این طرح متوقف نیست.", 409);
    const limit = await maxActivePlans(userId);
    const { count } = await db
      .from("scheduled_purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "ACTIVE");
    if ((count ?? 0) >= limit)
      throw new SavingsError(`حداکثر ${limit.toLocaleString("fa-IR")} طرح فعال می‌توانید داشته باشید.`, 409);
    patch.status = "ACTIVE";
    patch.fail_streak = 0;
    // Resuming never back-fills missed buys: next slot from now.
    const due = new Date(String(row.next_run_at));
    patch.next_run_at = (due > new Date() ? due : firstRunAt()).toISOString();
  } else if (action === "cancel") {
    patch.status = "CANCELLED";
  } else {
    throw new SavingsError("درخواست نامعتبر است.");
  }
  const { data, error } = await db
    .from("scheduled_purchases")
    .update(patch)
    .eq("id", planId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toPlan(data);
}

const FAILURE_FA: Record<string, string> = {
  insufficient_funds: "موجودی کیف پول کافی نبود.",
  insufficient_inventory: "موجودی خزانه برای این خرید کافی نبود.",
  price_unavailable: "قیمت بازار در دسترس نبود.",
  price_stale: "قیمت بازار به‌روز نبود.",
  daily_limit: "سقف خرید روزانه شما پر شده بود.",
  trade_limit: "مبلغ خارج از سقف مجاز خرید بود.",
  invalid_amount: "مبلغ کمتر از حداقل خرید بود.",
  asset_disabled: "خرید این فلز موقتاً غیرفعال است.",
  kill_switch: "معاملات موقتاً متوقف بود.",
  VERIFICATION_REQUIRED: "احراز هویت کامل نیست.",
};

function failureMessage(code: string | undefined) {
  return (code && FAILURE_FA[code]) || "خرید انجام نشد.";
}

async function notify(userId: string, title: string, message: string) {
  const db = createServiceClient();
  await db.from("notifications").insert({
    user_id: userId,
    type: "SYSTEM",
    title,
    message,
    href: "/app/savings",
    read: false,
  });
}

export type SavingsCronSummary = { due: number; success: number; failed: number; skipped: number; paused: number };

/**
 * Runs every due ACTIVE plan once per scheduled slot. A run is claimed by
 * inserting (plan_id, run_for); the unique key and the trade idempotency key
 * `savings:<plan>:<slot>` make overlapping cron calls harmless.
 */
export async function runSavingsCron(now = new Date()): Promise<SavingsCronSummary> {
  const summary: SavingsCronSummary = { due: 0, success: 0, failed: 0, skipped: 0, paused: 0 };
  const db = createServiceClient();
  const { data: due, error } = await db
    .from("scheduled_purchases")
    .select("*")
    .eq("status", "ACTIVE")
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  for (const row of due ?? []) {
    summary.due += 1;
    const plan = toPlan(row);
    const userId = String(row.user_id);
    const runFor = plan.nextRunAt;

    const claim = await db
      .from("scheduled_purchase_runs")
      .upsert(
        { plan_id: plan.id, user_id: userId, run_for: runFor, status: "RUNNING" },
        { onConflict: "plan_id,run_for", ignoreDuplicates: true }
      )
      .select("id");
    if (claim.error) throw new Error(claim.error.message);
    if (!claim.data?.length) {
      summary.skipped += 1;
      continue;
    }
    const runId = claim.data[0].id as string;

    let result: Awaited<ReturnType<typeof buyFromLedger>>;
    const verification = await readVerification(userId);
    if (verification.nextStep) {
      result = { ok: false, error: "verification_required", code: "VERIFICATION_REQUIRED" };
    } else {
      result = await buyFromLedger({
        userId,
        asset: plan.asset,
        amountToman: plan.amountToman,
        idempotencyKey: `savings:${plan.id}:${new Date(runFor).toISOString()}`,
      });
    }

    const anchorDay = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", day: "numeric" }).format(firstRunAt(new Date(plan.createdAt)))
    );
    const nextRunAt = nextRunAfter(new Date(runFor), plan.cadence, now, anchorDay).toISOString();
    const label = `${ASSET_FA[plan.asset]} ${CADENCE_LABEL[plan.cadence]}`;

    if (result.ok) {
      summary.success += 1;
      await db
        .from("scheduled_purchase_runs")
        .update({
          status: "SUCCESS",
          trade_id: result.tradeId,
          amount_irr: result.amountIrr.toString(),
          weight_ug: result.weightUg.toString(),
          fee_irr: result.feeIrr.toString(),
        })
        .eq("id", runId);
      await db
        .from("scheduled_purchases")
        .update({ next_run_at: nextRunAt, last_run_at: now.toISOString(), fail_streak: 0, updated_at: now.toISOString() })
        .eq("id", plan.id);
      const grams = (Number(result.weightUg) / 1_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 4 });
      await notify(
        userId,
        "خرید طرح پس‌انداز انجام شد",
        `${grams} گرم ${ASSET_FA[plan.asset]} به مبلغ ${plan.amountToman.toLocaleString("fa-IR")} تومان برای طرح «${label}» خریده شد.`
      );
    } else {
      summary.failed += 1;
      const reason = failureMessage(result.code);
      if (!FAILURE_FA[result.code ?? ""]) console.error("savings run failed", plan.id, result.code, result.error);
      const streak = plan.failStreak + 1;
      const pause = streak >= SAVINGS_MAX_FAIL_STREAK;
      if (pause) summary.paused += 1;
      await db.from("scheduled_purchase_runs").update({ status: "FAILED", error: reason }).eq("id", runId);
      await db
        .from("scheduled_purchases")
        .update({
          next_run_at: nextRunAt,
          fail_streak: streak,
          status: pause ? "PAUSED" : "ACTIVE",
          updated_at: now.toISOString(),
        })
        .eq("id", plan.id);
      await notify(
        userId,
        pause ? "طرح پس‌انداز متوقف شد" : "خرید طرح پس‌انداز انجام نشد",
        pause
          ? `خرید طرح «${label}» ${SAVINGS_MAX_FAIL_STREAK.toLocaleString("fa-IR")} بار پشت سر هم انجام نشد و طرح متوقف شد. علت آخر: ${reason}`
          : `خرید طرح «${label}» انجام نشد: ${reason} نوبت بعدی طبق برنامه انجام می‌شود.`
      );
    }
  }
  return summary;
}

export async function adminSavingsOverview() {
  const db = createServiceClient();
  const [plans, runs] = await Promise.all([
    db.from("scheduled_purchases").select("*, profiles(first_name,last_name,phone)").order("created_at", { ascending: false }).limit(200),
    db.from("scheduled_purchase_runs").select("*, profiles(first_name,last_name,phone)").order("created_at", { ascending: false }).limit(100),
  ]);
  return { plans: plans.data ?? [], runs: runs.data ?? [] };
}
