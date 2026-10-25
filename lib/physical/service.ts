import { randomBytes } from "crypto";
import type { AssetCode } from "@/lib/core/assets";
import { line, postJournal, requireBalance } from "@/lib/core/ledger";
import { userFundsLockKey } from "@/lib/core/locks";
import { BPS_DENOM, mulDivCeil } from "@/lib/core/money";
import { getFinancialCore } from "@/lib/core/runtime";
import { ensureUserAccounts, newId } from "@/lib/core/store";
import { CoreError, PLATFORM_HOLDER } from "@/lib/core/types";
import type { PhysicalSettings } from "./settings";

export type PhysicalStatus = "PENDING" | "APPROVED" | "DELIVERED" | "REJECTED" | "CANCELLED";

export type PhysicalRow = {
  id: string;
  user_id: string;
  product_id: string;
  product_title: string;
  asset: AssetCode;
  quantity: number;
  weight_ug: string;
  fee_ug: string;
  cost_removed_irr: string;
  branch_id: string;
  branch_name: string;
  pickup_date: string;
  pickup_slot: string;
  status: PhysicalStatus;
  tracking_code: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export const REF_TYPE = "physical_withdrawal";

function ctx() {
  const core = getFinancialCore();
  const store = core.ledgerStore();
  if (!store.rawQuery) throw new CoreError("misconfigured", "Postgres ledger required", 500);
  const q = store.rawQuery.bind(store);
  return { core, store, q };
}

/** Fee in micrograms, rounded up so the platform never undercharges. */
export function physicalFeeUg(weightUg: bigint, feePercent: number): bigint {
  const bps = BigInt(Math.round(feePercent * 10_000));
  if (bps <= 0n) return 0n;
  return mulDivCeil(weightUg, bps, BPS_DENOM);
}

function tomorrowIso(leadDays: number) {
  const d = new Date(Date.now() + leadDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function listActiveProducts() {
  const { q } = ctx();
  const { rows } = await q(
    "select id, asset, kind, title, weight_ug::text as weight_ug, active, sort from physical_products order by sort, created_at"
  );
  return rows as { id: string; asset: AssetCode; kind: string; title: string; weight_ug: string; active: boolean; sort: number }[];
}

export async function listUserRequests(userId: string): Promise<PhysicalRow[]> {
  const { q } = ctx();
  const { rows } = await q(
    `select *, weight_ug::text weight_ug, fee_ug::text fee_ug, cost_removed_irr::text cost_removed_irr,
            pickup_date::text pickup_date
       from physical_withdrawals where user_id = $1 order by created_at desc limit 200`,
    [userId]
  );
  return rows as unknown as PhysicalRow[];
}

export async function listAllRequests(status?: string): Promise<(PhysicalRow & { phone: string | null; full_name: string | null })[]> {
  const { q } = ctx();
  const { rows } = await q(
    `select w.*, w.weight_ug::text weight_ug, w.fee_ug::text fee_ug, w.cost_removed_irr::text cost_removed_irr,
            w.pickup_date::text pickup_date, p.phone,
            nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), '') full_name
       from physical_withdrawals w left join profiles p on p.id = w.user_id
      where ($1::text is null or w.status = $1)
      order by case w.status when 'PENDING' then 0 when 'APPROVED' then 1 else 2 end, w.created_at desc
      limit 300`,
    [status ?? null]
  );
  return rows as unknown as (PhysicalRow & { phone: string | null; full_name: string | null })[];
}

export async function createPhysicalRequest(input: {
  userId: string;
  productId: string;
  quantity: number;
  branchId: string;
  pickupDate: string;
  pickupSlot: string;
  settings: PhysicalSettings;
}): Promise<PhysicalRow> {
  const { core, store, q } = ctx();
  const qty = Math.floor(input.quantity);
  if (!Number.isFinite(qty) || qty < 1 || qty > 100) {
    throw new CoreError("invalid_quantity", "تعداد باید بین ۱ تا ۱۰۰ باشد.", 400);
  }
  const branch = input.settings.branches.find((b) => b.id === input.branchId);
  if (!branch) throw new CoreError("invalid_branch", "شعبه تحویل را انتخاب کنید.", 400);
  if (!input.settings.slots.includes(input.pickupSlot)) {
    throw new CoreError("invalid_slot", "بازه زمانی تحویل را انتخاب کنید.", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate) || input.pickupDate < tomorrowIso(input.settings.minLeadDays)) {
    throw new CoreError("invalid_date", "تاریخ مراجعه باید از روزهای آینده باشد.", 400);
  }

  await core.bootstrap();
  await ensureUserAccounts(store, input.userId);

  return store.withTransaction(() =>
    store.withAdvisoryLock(userFundsLockKey(input.userId), async () => {
      const { rows: prods } = await q(
        "select id, asset, title, weight_ug::text weight_ug, active from physical_products where id = $1",
        [input.productId]
      );
      const product = prods[0] as { id: string; asset: AssetCode; title: string; weight_ug: string; active: boolean } | undefined;
      if (!product || !product.active) throw new CoreError("invalid_product", "این محصول در دسترس نیست.", 400);

      const weightUg = BigInt(product.weight_ug) * BigInt(qty);
      const feeUg = physicalFeeUg(weightUg, input.settings.feePercent);
      const total = weightUg + feeUg;
      await requireBalance(
        store,
        input.userId,
        "USER_AVAILABLE",
        product.asset,
        total,
        "موجودی فلز شما برای این برداشت (به‌همراه کارمزد) کافی نیست."
      );

      const id = newId();
      const tracking = `PHY-${randomBytes(3).toString("hex").toUpperCase()}`;
      const costRemoved = await core.takeUserCost(input.userId, product.asset, total);
      await postJournal(store, {
        id: newId("jnl"),
        createdAt: new Date().toISOString(),
        reason: "PHYSICAL_RESERVE",
        refType: REF_TYPE,
        refId: id,
        lines: [
          line("USER_AVAILABLE", input.userId, product.asset, total, 0n),
          line("USER_RESERVED", input.userId, product.asset, 0n, total),
        ],
      });
      const { rows } = await q(
        `insert into physical_withdrawals
           (id, user_id, product_id, product_title, asset, quantity, weight_ug, fee_ug, cost_removed_irr,
            branch_id, branch_name, pickup_date, pickup_slot, tracking_code)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         returning *, weight_ug::text weight_ug, fee_ug::text fee_ug, cost_removed_irr::text cost_removed_irr,
                   pickup_date::text pickup_date`,
        [
          id,
          input.userId,
          product.id,
          product.title,
          product.asset,
          qty,
          weightUg.toString(),
          feeUg.toString(),
          costRemoved.toString(),
          branch.id,
          branch.name,
          input.pickupDate,
          input.pickupSlot,
          tracking,
        ]
      );
      return rows[0] as unknown as PhysicalRow;
    })
  );
}

const NEXT: Record<"approve" | "deliver" | "reject" | "cancel", { from: PhysicalStatus[]; to: PhysicalStatus }> = {
  approve: { from: ["PENDING"], to: "APPROVED" },
  deliver: { from: ["APPROVED"], to: "DELIVERED" },
  reject: { from: ["PENDING", "APPROVED"], to: "REJECTED" },
  cancel: { from: ["PENDING"], to: "CANCELLED" },
};

/**
 * approve: appointment confirmed, metal stays reserved.
 * deliver: reserve leaves the books — weight to PLATFORM_CLEARING (metal physically
 *          handed out of the vault), fee to PLATFORM_AVAILABLE (platform's metal).
 * reject/cancel: reserve returns to USER_AVAILABLE with its cost basis.
 */
export async function transitionPhysical(input: {
  id: string;
  action: keyof typeof NEXT;
  actorId: string;
  /** Set for user cancel: the row must belong to this user. */
  ownerId?: string;
  note?: string;
}): Promise<PhysicalRow> {
  const { core, store, q } = ctx();
  const step = NEXT[input.action];
  return store.withTransaction(async () => {
    const { rows } = await q(
      `select *, weight_ug::text weight_ug, fee_ug::text fee_ug, cost_removed_irr::text cost_removed_irr
         from physical_withdrawals where id = $1 for update`,
      [input.id]
    );
    const row = rows[0] as unknown as PhysicalRow | undefined;
    if (!row || (input.ownerId && row.user_id !== input.ownerId)) {
      throw new CoreError("not_found", "درخواست پیدا نشد.", 404);
    }
    if (!step.from.includes(row.status)) {
      throw new CoreError("invalid_state", "این درخواست در وضعیت فعلی قابل این تغییر نیست.", 409);
    }
    return store.withAdvisoryLock(userFundsLockKey(row.user_id), async () => {
      const weight = BigInt(row.weight_ug);
      const fee = BigInt(row.fee_ug);
      const total = weight + fee;
      if (input.action === "deliver") {
        const lines = [
          line("USER_RESERVED", row.user_id, row.asset, total, 0n),
          line("PLATFORM_CLEARING", PLATFORM_HOLDER, row.asset, 0n, weight),
        ];
        if (fee > 0n) lines.push(line("PLATFORM_AVAILABLE", PLATFORM_HOLDER, row.asset, 0n, fee));
        await postJournal(store, {
          id: newId("jnl"),
          createdAt: new Date().toISOString(),
          reason: "PHYSICAL_DELIVER",
          refType: REF_TYPE,
          refId: row.id,
          lines,
        });
      } else if (input.action === "reject" || input.action === "cancel") {
        await postJournal(store, {
          id: newId("jnl"),
          createdAt: new Date().toISOString(),
          reason: "PHYSICAL_RELEASE",
          refType: REF_TYPE,
          refId: row.id,
          lines: [
            line("USER_RESERVED", row.user_id, row.asset, total, 0n),
            line("USER_AVAILABLE", row.user_id, row.asset, 0n, total),
          ],
        });
        await core.giveUserCost(row.user_id, row.asset, total, BigInt(row.cost_removed_irr));
      }
      const { rows: out } = await q(
        `update physical_withdrawals set status = $2, admin_note = coalesce($3, admin_note),
                decided_by = $4, updated_at = now()
          where id = $1
          returning *, weight_ug::text weight_ug, fee_ug::text fee_ug, cost_removed_irr::text cost_removed_irr,
                    pickup_date::text pickup_date`,
        [row.id, step.to, input.note?.trim() || null, input.actorId]
      );
      return out[0] as unknown as PhysicalRow;
    });
  });
}

export async function upsertProduct(input: {
  id?: string;
  asset: AssetCode;
  kind: "COIN" | "BAR";
  title: string;
  weightUg: bigint;
  active: boolean;
  sort: number;
}) {
  const { q } = ctx();
  if (input.id) {
    await q(
      "update physical_products set asset=$2, kind=$3, title=$4, weight_ug=$5, active=$6, sort=$7 where id=$1",
      [input.id, input.asset, input.kind, input.title, input.weightUg.toString(), input.active, input.sort]
    );
  } else {
    await q(
      "insert into physical_products (asset, kind, title, weight_ug, active, sort) values ($1,$2,$3,$4,$5,$6)",
      [input.asset, input.kind, input.title, input.weightUg.toString(), input.active, input.sort]
    );
  }
}
