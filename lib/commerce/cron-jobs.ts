import { randomBytes, randomUUID } from "crypto";
import { getFeatureFlags } from "@/lib/core/mode";
import { buyQuote, dcaExecutionFee, isPlusActive } from "@/lib/commerce/fees";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getLiveGold18Price } from "@/lib/market/price-provider";

function trackingCode() {
  return `GRM-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function cadenceDays(cadence: string): number {
  if (/هفته|weekly/i.test(cadence)) return 7;
  return 30;
}

export type CronRunSummary = {
  dca: { processed: number; success: number; failed: number };
  alerts: { checked: number; triggered: number; orders: number };
};

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

    const [{ data: wallet }, { data: profile }] = await Promise.all([
      admin.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
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
    const available = Number(wallet?.toman_available ?? 0);

    if (available < totalDebit) {
      summary.failed += 1;
      await notifyUser(
        admin,
        userId,
        "خرید دوره‌ای انجام نشد",
        `موجودی کیف پول برای خرید ${amount.toLocaleString("fa-IR")} تومان (به‌علاوه کارمزد) کافی نیست.`,
        "/app/wallet"
      );
      const next = new Date(now);
      next.setDate(next.getDate() + cadenceDays(row.cadence));
      await admin
        .from("scheduled_purchases")
        .update({
          next_run_at: next.toISOString(),
          next_run: next.toLocaleDateString("fa-IR"),
        })
        .eq("id", row.id);
      continue;
    }

    const { fee, goldMg } = buyQuote(amount, price, plus, settings);
    const totalFee = fee + dcaFee;
    const totalCost = amount + dcaFee;
    if (goldMg <= 0) {
      summary.failed += 1;
      continue;
    }

    const txId = randomUUID();
    const tracking = trackingCode();
    const prevGold = Number(wallet?.gold_mg ?? 0);
    const prevAvg = Number(wallet?.avg_buy_price_toman ?? 0);
    const nextGold = prevGold + goldMg;
    const nextAvg =
      nextGold > 0
        ? Math.floor(
            (prevGold * prevAvg + goldMg * price) / nextGold
          )
        : price;

    await admin.from("transactions").insert({
      id: txId,
      user_id: userId,
      tracking_code: tracking,
      type: "خرید",
      gold_mg: goldMg,
      amount_toman: amount,
      fee_toman: totalFee,
      price_per_gram_toman: price,
      status: "تکمیل‌شده",
      payment_ref: `DCA-${row.id}`,
      note: `خرید دوره‌ای · ${row.cadence}`,
      timeline: [
        { label: "اجرای خودکار DCA", done: true },
        { label: "تخصیص طلا", done: true },
      ],
    });

    await admin
      .from("wallets")
      .update({
        gold_mg: nextGold,
        toman_available: available - totalCost,
        toman_pending: Number(wallet?.toman_pending ?? 0),
        avg_buy_price_toman: nextAvg,
      })
      .eq("user_id", userId);

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
      `${(goldMg / 1000).toFixed(3)} گرم طلا خریداری شد.`,
      `/app/transactions/${txId}`
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
    const [{ data: wallet }, { data: profile }] = await Promise.all([
      admin.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
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
    const { fee, goldMg } = buyQuote(buyAmount, price, plus, settings);
    const available = Number(wallet?.toman_available ?? 0);
    const orderId = randomUUID();

    if (available < buyAmount) {
      await admin.from("price_alert_orders").insert({
        id: orderId,
        user_id: userId,
        alert_id: alert.id,
        amount_toman: buyAmount,
        status: "FAILED",
        error_message: "موجودی کافی نیست",
      });
      await notifyUser(
        admin,
        userId,
        "سفارش خودکار انجام نشد",
        "موجودی کیف پول برای خرید خودکار پس از هشدار کافی نبود.",
        "/app/wallet"
      );
      continue;
    }

    const txId = randomUUID();
    const prevGold = Number(wallet?.gold_mg ?? 0);
    const prevAvg = Number(wallet?.avg_buy_price_toman ?? 0);
    const nextGold = prevGold + goldMg;
    const nextAvg =
      nextGold > 0
        ? Math.floor((prevGold * prevAvg + goldMg * price) / nextGold)
        : price;

    await admin.from("transactions").insert({
      id: txId,
      user_id: userId,
      tracking_code: trackingCode(),
      type: "خرید",
      gold_mg: goldMg,
      amount_toman: buyAmount,
      fee_toman: fee,
      price_per_gram_toman: price,
      status: "تکمیل‌شده",
      note: "خرید خودکار پس از هشدار قیمت",
      timeline: [{ label: "اجرای سفارش محدود", done: true }],
    });

    await admin
      .from("wallets")
      .update({
        gold_mg: nextGold,
        toman_available: available - buyAmount,
        toman_pending: Number(wallet?.toman_pending ?? 0),
        avg_buy_price_toman: nextAvg,
      })
      .eq("user_id", userId);

    await admin.from("price_alert_orders").insert({
      id: orderId,
      user_id: userId,
      alert_id: alert.id,
      amount_toman: buyAmount,
      status: "EXECUTED",
      transaction_id: txId,
      executed_at: new Date().toISOString(),
    });

    summary.orders += 1;
    await notifyUser(
      admin,
      userId,
      "خرید خودکار انجام شد",
      `${(goldMg / 1000).toFixed(3)} گرم طلا پس از هشدار قیمت خریداری شد.`,
      `/app/transactions/${txId}`
    );
  }

  return { alerts: summary };
}

export async function runRevenueCrons(): Promise<CronRunSummary> {
  const dca = await runDcaCron();
  const { alerts } = await runAlertsCron();
  return { dca, alerts };
}
