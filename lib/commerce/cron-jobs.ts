import { getFeatureFlags } from "@/lib/core/mode";
import { buyFromLedger } from "@/lib/commerce/ledger-buy";
import { runSavingsCron, type SavingsCronSummary } from "@/lib/savings/service";
import { expireGiftCards } from "@/lib/gift/service";
import { ledgerCoversToman, parseLedgerBalance } from "@/lib/ledger/display";
import { createServiceClient } from "@/lib/supabase/admin";
import { getLiveGold18Price } from "@/lib/market/price-provider";

export type CronRunSummary = {
  savings: SavingsCronSummary;
  gifts: { due: number; expired: number };
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

export async function runAlertsCron(): Promise<
  Pick<CronRunSummary, "alerts">
> {
  const summary = { checked: 0, triggered: 0, orders: 0 };
  if (!getFeatureFlags().ALERT_AUTOBUY_ENABLED) {
    return { alerts: summary };
  }
  const admin = createServiceClient();
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
    const funds = await readUserAvailableIrr(admin, userId);

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

    const bought = await buyFromLedger({
      userId,
      asset: "GOLD",
      amountToman: buyAmount,
      idempotencyKey: `alert:${alert.id}:${new Date().toISOString()}`,
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
  const savings = await runSavingsCron();
  const gifts = await expireGiftCards();
  const { alerts } = await runAlertsCron();
  return { savings, gifts, alerts };
}
