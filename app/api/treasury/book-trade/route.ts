import { NextResponse } from "next/server";
import { z } from "zod";
import {
  bookCustomerBuy,
  bookCustomerSell,
} from "@/lib/treasury/service";
import { isTreasuryAsset } from "@/lib/treasury/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  side: z.enum(["CUSTOMER_BUY", "CUSTOMER_SELL"]),
  asset: z.string().default("GOLD"),
  weightMg: z.number().int().positive(),
  midPriceTomanPerGram: z.number().positive(),
  customerPriceTomanPerGram: z.number().positive().optional(),
  feeRevenueToman: z.number().int().nonnegative(),
  customerNetToman: z.number().int().nonnegative().optional(),
  transactionId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

/**
 * Internal bookkeeping hook after a customer trade is persisted.
 * Does not change customer balances — only treasury events / P&L.
 */
export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "service_role_required" },
      { status: 503 }
    );
  }

  try {
    const body = schema.parse(await request.json());
    if (!isTreasuryAsset(body.asset)) {
      return NextResponse.json({ ok: false, error: "invalid_asset" }, { status: 400 });
    }

    if (body.side === "CUSTOMER_BUY") {
      const result = await bookCustomerBuy({
        asset: body.asset,
        weightMg: body.weightMg,
        midPriceTomanPerGram: body.midPriceTomanPerGram,
        customerPriceTomanPerGram: body.customerPriceTomanPerGram,
        feeRevenueToman: body.feeRevenueToman,
        transactionId: body.transactionId,
        userId: body.userId,
        allowShortInventory: true,
      });
      return NextResponse.json({ ok: true, result });
    }

    const result = await bookCustomerSell({
      asset: body.asset,
      weightMg: body.weightMg,
      midPriceTomanPerGram: body.midPriceTomanPerGram,
      customerPriceTomanPerGram: body.customerPriceTomanPerGram,
      feeRevenueToman: body.feeRevenueToman,
      customerNetToman: body.customerNetToman ?? 0,
      transactionId: body.transactionId,
      userId: body.userId,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "book_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
