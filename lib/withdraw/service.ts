import { randomBytes } from "crypto";
import { withdrawFee, isPlusActive, type PlanTier } from "@/lib/commerce/fees";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { line, postJournal, requireBalance } from "@/lib/core/ledger";
import { userFundsLockKey } from "@/lib/core/locks";
import { getKillSwitches } from "@/lib/core/mode";
import { getFinancialCore } from "@/lib/core/runtime";
import { ensureUserAccounts, newId } from "@/lib/core/store";
import { CoreError, PLATFORM_HOLDER } from "@/lib/core/types";
import { effectiveTradeLimits } from "@/lib/kyc/levels";
import { readVerification } from "@/lib/kyc/verification";
import { checkWithdrawal, validPayoutRef, WITHDRAW_NEXT, type WithdrawStatus } from "./rules";

export const REF_TYPE = "toman_withdrawal";

export type WithdrawRow = {
  id: string;
  user_id: string;
  card_id: string;
  iban: string;
  bank_name: string;
  pan_masked: string;
  amount_irr: string;
  fee_irr: string;
  status: WithdrawStatus;
  payout_ref: string | null;
  admin_note: string | null;
  tracking_code: string;
  created_at: string;
  updated_at: string;
};

const COLS = `id, user_id, card_id, iban, bank_name, pan_masked, amount_irr::text amount_irr, fee_irr::text fee_irr,
  status, payout_ref, admin_note, tracking_code, created_at::text created_at, updated_at::text updated_at`;

function ctx() {
  const core = getFinancialCore();
  const store = core.ledgerStore();
  if (!store.rawQuery) throw new CoreError("misconfigured", "Postgres ledger required", 500);
  return { core, store, q: store.rawQuery.bind(store) };
}

export function withdrawalsEnabled() {
  return getKillSwitches().WITHDRAWAL_ENABLED;
}

/** Verified cards that can receive a payout, for the picker. */
export async function listPayoutCards(userId: string) {
  const { q } = ctx();
  const { rows } = await q(
    `select id, pan_masked, bank_name, iban, iban_bank_name, iban_owners, iban_deposit_status, status
       from user_bank_cards where user_id = $1 and status = 'VERIFIED' order by created_at`,
    [userId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    panMasked: String(r.pan_masked),
    bankName: String(r.iban_bank_name ?? r.bank_name),
    iban: (r.iban as string | null) ?? null,
    owners: (r.iban_owners as string | null) ?? null,
  }));
}

export async function listUserWithdrawals(userId: string): Promise<WithdrawRow[]> {
  const { q } = ctx();
  const { rows } = await q(`select ${COLS} from toman_withdrawals where user_id = $1 order by created_at desc limit 30`, [userId]);
  return rows as unknown as WithdrawRow[];
}

export async function listAllWithdrawals(status?: string) {
  const { q } = ctx();
  const { rows } = await q(
    `select w.id, w.user_id, w.card_id, w.iban, w.bank_name, w.pan_masked, w.amount_irr::text amount_irr,
            w.fee_irr::text fee_irr, w.status, w.payout_ref, w.admin_note, w.tracking_code,
            w.created_at::text created_at, w.updated_at::text updated_at,
            p.phone, nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), '') full_name
       from toman_withdrawals w left join profiles p on p.id = w.user_id
      where ($1::text is null or w.status = $1)
      order by (w.status = 'PENDING') desc, w.created_at desc limit 200`,
    [status ?? null]
  );
  return rows as unknown as (WithdrawRow & { phone: string | null; full_name: string | null })[];
}

async function usedTodayToman(q: ReturnType<typeof ctx>["q"], userId: string) {
  const { rows } = await q(
    `select coalesce(sum(amount_irr), 0)::text s from toman_withdrawals
      where user_id = $1 and status in ('PENDING','PAID')
        and created_at >= (date_trunc('day', now() at time zone 'Asia/Tehran') at time zone 'Asia/Tehran')`,
    [userId]
  );
  return Number(BigInt(String(rows[0]?.s ?? "0")) / 10n);
}

export async function withdrawUsage(userId: string) {
  return usedTodayToman(ctx().q, userId);
}

async function userPlus(q: ReturnType<typeof ctx>["q"], userId: string) {
  const { rows } = await q("select plan_tier, plan_expires_at::text plan_expires_at from profiles where id = $1", [userId]);
  const p = rows[0];
  return p ? isPlusActive((p.plan_tier as PlanTier) ?? "free", (p.plan_expires_at as string | null) ?? null) : false;
}

/** Reserves amount + fee (USER_AVAILABLE -> USER_RESERVED) and opens a PENDING request. */
export async function createWithdrawal(input: { userId: string; cardId: string; amountToman: number }): Promise<WithdrawRow> {
  if (!withdrawalsEnabled()) throw new CoreError("withdrawal_disabled", "برداشت تومانی موقتاً غیرفعال است.", 503);
  const { core, store, q } = ctx();
  const [settings, kyc] = await Promise.all([loadCommerceSettings(), readVerification(input.userId)]);
  const caps = effectiveTradeLimits(settings.limits, kyc.level);
  await core.bootstrap();
  await ensureUserAccounts(store, input.userId);

  return store.withTransaction(() =>
    store.withAdvisoryLock(userFundsLockKey(input.userId), async () => {
      const { rows: cards } = await q(
        `select id, status, iban, iban_deposit_status, pan_masked, coalesce(iban_bank_name, bank_name) bank_name
           from user_bank_cards where id = $1 and user_id = $2`,
        [input.cardId, input.userId]
      );
      const c = cards[0];
      const card = c
        ? { id: String(c.id), status: String(c.status), iban: (c.iban as string | null) ?? null, ibanDepositStatus: (c.iban_deposit_status as string | null) ?? null }
        : null;
      const fee = withdrawFee(await userPlus(q, input.userId), settings.fees);
      const check = checkWithdrawal({
        amountToman: input.amountToman,
        feeToman: fee,
        card,
        dailyCapToman: caps.dailyWithdrawToman,
        usedTodayToman: await usedTodayToman(q, input.userId),
      });
      if (!check.ok) throw new CoreError(check.code, check.message, check.status);
      await requireBalance(store, input.userId, "USER_AVAILABLE", "IRR", check.totalIrr, "موجودی تومانی شما برای این برداشت کافی نیست.");

      const id = newId();
      await postJournal(store, {
        id: newId("jnl"),
        createdAt: new Date().toISOString(),
        reason: "WITHDRAW_RESERVE",
        refType: REF_TYPE,
        refId: id,
        lines: [
          line("USER_AVAILABLE", input.userId, "IRR", check.totalIrr, 0n),
          line("USER_RESERVED", input.userId, "IRR", 0n, check.totalIrr),
        ],
      });
      const { rows } = await q(
        `insert into toman_withdrawals (id, user_id, card_id, iban, bank_name, pan_masked, amount_irr, fee_irr, tracking_code)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${COLS}`,
        [
          id,
          input.userId,
          card!.id,
          card!.iban,
          String(c!.bank_name),
          String(c!.pan_masked),
          check.amountIrr.toString(),
          check.feeIrr.toString(),
          `WDR-${randomBytes(3).toString("hex").toUpperCase()}`,
        ]
      );
      return rows[0] as unknown as WithdrawRow;
    })
  );
}

/**
 * pay:    reserve leaves the books — amount to PLATFORM_CLEARING (cash sent to
 *         the user's IBAN), fee to PLATFORM_FEE_REVENUE. Requires the bank ref.
 * reject / cancel: reserve returns to USER_AVAILABLE.
 */
export async function transitionWithdrawal(input: {
  id: string;
  action: keyof typeof WITHDRAW_NEXT;
  actorId: string;
  ownerId?: string;
  payoutRef?: string;
  note?: string;
}): Promise<WithdrawRow> {
  const { store, q } = ctx();
  const step = WITHDRAW_NEXT[input.action];
  const ref = input.action === "pay" ? validPayoutRef(input.payoutRef) : null;
  if (input.action === "pay" && !ref) {
    throw new CoreError("invalid_ref", "شماره پیگیری پایا/ساتنا را وارد کنید (۶ تا ۴۰ نویسه لاتین یا عدد).", 400);
  }
  if (input.action === "reject" && (input.note ?? "").trim().length < 4) {
    throw new CoreError("note_required", "دلیل رد را بنویسید.", 400);
  }
  return store.withTransaction(async () => {
    const { rows } = await q(`select ${COLS} from toman_withdrawals where id = $1 for update`, [input.id]);
    const row = rows[0] as unknown as WithdrawRow | undefined;
    if (!row || (input.ownerId && row.user_id !== input.ownerId)) throw new CoreError("not_found", "درخواست پیدا نشد.", 404);
    if (!step.from.includes(row.status)) {
      throw new CoreError("invalid_state", "این درخواست در وضعیت فعلی قابل این تغییر نیست.", 409);
    }
    return store.withAdvisoryLock(userFundsLockKey(row.user_id), async () => {
      const amount = BigInt(row.amount_irr);
      const fee = BigInt(row.fee_irr);
      const total = amount + fee;
      const lines =
        input.action === "pay"
          ? [
              line("USER_RESERVED", row.user_id, "IRR", total, 0n),
              line("PLATFORM_CLEARING", PLATFORM_HOLDER, "IRR", 0n, amount),
              ...(fee > 0n ? [line("PLATFORM_FEE_REVENUE", PLATFORM_HOLDER, "IRR", 0n, fee)] : []),
            ]
          : [
              line("USER_RESERVED", row.user_id, "IRR", total, 0n),
              line("USER_AVAILABLE", row.user_id, "IRR", 0n, total),
            ];
      await postJournal(store, {
        id: newId("jnl"),
        createdAt: new Date().toISOString(),
        reason: input.action === "pay" ? "WITHDRAW_PAID" : "WITHDRAW_RELEASE",
        refType: REF_TYPE,
        refId: row.id,
        lines,
      });
      const { rows: out } = await q(
        `update toman_withdrawals set status = $2, payout_ref = coalesce($3, payout_ref),
                admin_note = coalesce($4, admin_note), decided_by = $5, updated_at = now()
          where id = $1 returning ${COLS}`,
        [row.id, step.to, ref, input.note?.trim() || null, input.actorId]
      );
      return out[0] as unknown as WithdrawRow;
    });
  });
}
