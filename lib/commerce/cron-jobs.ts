import { getFeatureFlags } from "@/lib/core/mode";
import { dcaExecutionFee, isPlusActive } from "@/lib/commerce/fees";
import { buyGoldFromLedger } from "@/lib/commerce/ledger-buy";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { ledgerCoversToman, parseLedgerBalance } from "@/lib/ledger/display";
import { createServiceClient } from "@/lib/supabase/admin";
import { getLiveGold18Price } from "@/lib/market/price-provider";

function cadenceDays(cadence: string): number {
  if (/هفته|weekly/i.test(cadence)) return 7;
  return 30;
}

export type CronRunSummary = {
  dca: { processed: number; success: number; failed: number };
  alerts: { checked: number; triggered: number; orders: number };
};

async function readUserAvailableIrr(
  admin: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<{ ok: true; irr: bigint } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("core_ledger_accounts")
    .select("balance")
    .eq("holder_id", userId)
    .eq("account_code", "USER_AVAILABLE")
    .eq("asset", "IRR")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  try {
    return { ok: true, irr: parseLedgerBalance(data?.balance ?? 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "bad_balance" };
  }
}

function scheduleStamp(row: { id: string; next_run_at?: string | null }, now: Date) {
  return `${row.id}:${row.next_run_at ?? now.toISOString()}`;
}

async function notifyUser(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
  title: string,
  message: string,
  href?: string
) {
  await admin.from("notifications").insert({
    user_id: userId,
    type: "SYSTEM",
    title,
    message,
    href: href ?? null,
    read: false,
  });
}

export async function runDcaCron(): Promise<CronRunSummary["dca"]> {
  const summary = { processed: 0, success: 0, failed: 0 };
  if (!getFeatureFlags().DCA_ENABLED) return summary;
  const admin = createServiceClient();
  const settings = await loadCommerceSettings();
  const quote = await getLiveGold18Price();
  const price = quote.priceToman;
  if (!price || price < 100_000) return summary;

  const now = new Date();
  const { data: schedules } = await admin
    .from("scheduled_purchases")
    .select("*")
    .eq("status", "ACTIVE");

  for (const row of schedules ?? []) {
    summary.processed += 1;
    const nextRunAt = row.next_run_at
      ? new Date(row.next_run_at)
      : now;
    if (nextRunAt > now) continue;

    const userId = row.user_id as string;
    const amount = Number(row.amount_toman);

    const [funds, { data: profile }] = await Promise.all([
      readUserAvailableIrr(admin, userId),
      admin
        .from("profiles")
        .select("plan_tier, plan_expires_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const plus = isPlusActive(
      (profile?.plan_tier as "free" | "plus") ?? "free",
      profile?.plan_expires_at
    );
    const dcaFee = dcaExecutionFee(plus, settings.fees);
    const totalDebit = amount + dcaFee;
    const advance = async () => {
      const next = new Date(now);
      next.setDate(next.getDate() + cadenceDays(row.cadence));
      await admin
        .from("scheduled_purchases")
        .update({
          next_run_at: next.toISOString(),
          next_run: next.toLocaleDateString("fa-IR"),
        })
        .eq("id", row.id);
    };

    if (!funds.ok || !ledgerCoversToman(funds.irr, totalDebit)) {
      summary.failed += 1;
      await notifyUser(
        admin,
        userId,
        "خرید دوره‌ای انجام نشد",
        funds.ok
          ? `موجودی دفترکل برای خرید ${amount.toLocaleString("fa-IR")} تومان (به‌علاوه کارمزد) کافی نیست.`
          : "موجودی دفترکل خوانده نشد.",
        "/app/wallet"
      );
      if (funds.ok) await advance();
      continue;
    }

    const bought = await buyGoldFromLedger({
      userId,
      amountToman: amount,
      idempotencyKey: `dca:${scheduleStamp(row, now)}`,
      plus,
      settings,
    });
    if (!bought.ok) {
      summary.failed += 1;
      await notifyUser(
        admin,
        userId,
        "خرید دوره‌ای انجام نشد",
        "ثبت خرید در دفترکل ممکن نشد.",
        "/app/wallet"
      );
      continue;
    }

    const next = new Date(now);
    next.setDate(next.getDate() + cadenceDays(row.cadence));
    await admin
      .from("scheduled_purchases")
      .update({
        last_run_at: now.toISOString(),
        next_run_at: next.toISOString(),
        next_run: next.toLocaleDateString("fa-IR"),
      })
      .eq("id", row.id);

    await notifyUser(
      admin,
      userId,
      "خرید دوره‌ای انجام شد",
      "خرید طلا در دفترکل ثبت شد.",
      "/app/transactions"
    );
    summary.success += 1;
  }

  return summary;
}

export async function runAlertsCron(): Promise<
  Pick<CronRunSummary, "alerts">
> {
  const summary = { checked: 0, triggered: 0, orders: 0 };
  if (!getFeatureFlags().ALERT_AUTOBUY_ENABLED) {
    return { alerts: summary };
  }
  const admin = createServiceClient();
  const settings = await loadCommerceSettings();
  const quote = await getLiveGold18Price();
  const price = quote.priceToman;

  if (!price || price < 100_000) {
    return { alerts: summary };
  }

  const { data: alerts } = await admin
    .from("price_alerts")
    .select("*")
    .eq("status", "ACTIVE");

  for (const alert of alerts ?? []) {
    summary.checked += 1;
    const target = Number(alert.price_toman);
    const hit =
      alert.direction === "above" ? price >= target : price <= target;
    if (!hit) continue;

    summary.triggered += 1;
    const userId = alert.user_id as string;
    const channels: string[] = alert.channels ?? ["app"];

    await notifyUser(
      admin,
      userId,
      "هشدار قیمت فعال شد",
      `قیمت geram18 به ${price.toLocaleString("fa-IR")} تومان رسید (هدف: ${target.toLocaleString("fa-IR")}).`,
      "/app/market"
    );

    if (channels.includes("sms")) {
      await admin.from("notifications").insert({
        user_id: userId,
        type: "SMS",
        title: "SMS (سندباکس)",
        message: `گرم: قیمت به ${price.toLocaleString("fa-IR")} رسید.`,
        read: false,
      });
    }

    await admin
      .from("price_alerts")
      .update({ status: "TRIGGERED" })
      .eq("id", alert.id);

    if (!alert.auto_buy_enabled || Number(alert.auto_buy_toman) <= 0) {
      continue;
    }

    const buyAmount = Number(alert.auto_buy_toman);
    const [funds, { data: profile }] = await Promise.all([
      readUserAvailableIrr(admin, userId),
      admin
        .from("profiles")
        .select("plan_tier, plan_expires_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const plus = isPlusActive(
      (profile?.plan_tier as "free" | "plus") ?? "free",
      profile?.plan_expires_at
    );

    if (!funds.ok || !ledgerCoversToman(funds.irr, buyAmount)) {
      await admin.from("price_alert_orders").insert({
        user_id: userId,
        alert_id: alert.id,
        amount_toman: buyAmount,
        status: "FAILED",
        error_message: funds.ok ? "موجودی دفترکل کافی نیست" : "موجودی دفترکل خوانده نشد",
      });
      await notifyUser(
        admin,
        userId,
        "سفارش خودکار انجام نشد",
        "موجودی دفترکل برای خرید خودکار پس از هشدار کافی نبود.",
        "/app/wallet"
      );
      continue;
    }

    const bought = await buyGoldFromLedger({
      userId,
      amountToman: buyAmount,
      idempotencyKey: `alert:${alert.id}:${new Date().toISOString()}`,
      plus,
      settings,
    });
    if (!bought.ok) {
      await admin.from("price_alert_orders").insert({
        user_id: userId,
        alert_id: alert.id,
        amount_toman: buyAmount,
        status: "FAILED",
        error_message: "ثبت خرید در دفترکل ممکن نشد",
      });
      await notifyUser(
        admin,
        userId,
        "سفارش خودکار انجام نشد",
        "ثبت خرید در دفترکل ممکن نشد.",
        "/app/wallet"
      );
      continue;
    }

    await admin.from("price_alert_orders").insert({
      user_id: userId,
      alert_id: alert.id,
      amount_toman: buyAmount,
      status: "EXECUTED",
      executed_at: new Date().toISOString(),
    });

    summary.orders += 1;
    await notifyUser(
      admin,
      userId,
      "خرید خودکار انجام شد",
      "خرید طلا پس از هشدار قیمت در دفترکل ثبت شد.",
      "/app/transactions"
    );
  }

  return { alerts: summary };
}

export async function runRevenueCrons(): Promise<CronRunSummary> {
  const dca = await runDcaCron();
  const { alerts } = await runAlertsCron();
  return { dca, alerts };
}
