import { getFinancialCore } from "@/lib/core/runtime";
import { CoreError } from "@/lib/core/types";

function q() {
  const store = getFinancialCore().ledgerStore();
  if (!store.rawQuery) throw new CoreError("misconfigured", "Postgres ledger required", 500);
  return store.rawQuery.bind(store);
}

export function normalizeReferralCode(code: string) {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** "علی ر." style name so inviters never see a friend's full name or phone. */
function maskName(first: string | null, last: string | null, phone: string | null) {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (f) return l ? `${f} ${l.slice(0, 1)}.` : f;
  if (phone && phone.length >= 7) return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
  return "کاربر گرم";
}

export async function referralOverview(userId: string) {
  const run = q();
  const me = (
    await run(
      `select p.referral_code, p.referred_by::text as referred_by, r.referral_code as referrer_code,
              exists (select 1 from core_trades t where t.user_id = p.id::text and t.status = 'SETTLED') as has_trades
         from profiles p left join profiles r on r.id = p.referred_by where p.id = $1::uuid`,
      [userId]
    )
  ).rows[0] as
    | { referral_code: string | null; referred_by: string | null; referrer_code: string | null; has_trades: boolean }
    | undefined;
  const friends = (
    await run(
      `select f.first_name, f.last_name, f.phone, f.created_at, f.kyc_status = 'VERIFIED' as verified,
              coalesce(sum(rr.reward_irr), 0)::text as earned_irr, count(rr.trade_id)::int as trades
         from profiles f left join referral_rewards rr on rr.referee_id = f.id and rr.referrer_id = $1::uuid
        where f.referred_by = $1::uuid
        group by f.id order by f.created_at desc limit 200`,
      [userId]
    )
  ).rows as Array<Record<string, unknown>>;
  const rewards = (
    await run(
      `select rr.trade_id, rr.asset, rr.side, rr.fee_irr::text, rr.reward_irr::text, rr.created_at,
              f.first_name, f.last_name, f.phone
         from referral_rewards rr join profiles f on f.id = rr.referee_id
        where rr.referrer_id = $1::uuid order by rr.created_at desc limit 50`,
      [userId]
    )
  ).rows as Array<Record<string, unknown>>;
  const totalIrr = friends.reduce((s, f) => s + BigInt(String(f.earned_irr)), 0n);
  return {
    code: me?.referral_code ?? null,
    referredByCode: me?.referrer_code ?? null,
    canApply: !me?.referred_by && !me?.has_trades,
    stats: {
      invited: friends.length,
      verified: friends.filter((f) => f.verified).length,
      trading: friends.filter((f) => Number(f.trades) > 0).length,
      totalRewardIrr: totalIrr.toString(),
    },
    friends: friends.map((f) => ({
      name: maskName(f.first_name as string, f.last_name as string, f.phone as string),
      joinedAt: f.created_at,
      verified: Boolean(f.verified),
      trades: Number(f.trades),
      earnedIrr: String(f.earned_irr),
    })),
    rewards: rewards.map((r) => ({
      tradeId: r.trade_id,
      asset: r.asset,
      side: r.side,
      feeIrr: r.fee_irr,
      rewardIrr: r.reward_irr,
      createdAt: r.created_at,
      friend: maskName(r.first_name as string, r.last_name as string, r.phone as string),
    })),
  };
}

/** Attach the inviter once, before the user's first trade. */
export async function applyReferralCode(userId: string, rawCode: string) {
  const code = normalizeReferralCode(rawCode);
  if (!/^[A-Z0-9]{4,16}$/.test(code)) throw new CoreError("invalid_code", "کد دعوت معتبر نیست.", 400);
  const run = q();
  const me = (
    await run(
      `select referral_code, referred_by::text as referred_by,
              exists (select 1 from core_trades t where t.user_id = $1 and t.status = 'SETTLED') as has_trades
         from profiles where id = $1::uuid`,
      [userId]
    )
  ).rows[0] as { referral_code: string | null; referred_by: string | null; has_trades: boolean } | undefined;
  if (!me) throw new CoreError("not_found", "پروفایل پیدا نشد.", 404);
  if (me.referred_by) throw new CoreError("already_referred", "کد دعوت قبلاً برای حساب شما ثبت شده است.", 409);
  if (me.has_trades)
    throw new CoreError("too_late", "کد دعوت فقط پیش از اولین معامله قابل ثبت است.", 409);
  const inviter = (
    await run(`select id::text as id, referred_by::text as referred_by from profiles where referral_code = $1`, [code])
  ).rows[0] as { id: string; referred_by: string | null } | undefined;
  if (!inviter) throw new CoreError("invalid_code", "کدی با این مشخصات پیدا نشد.", 404);
  if (inviter.id === userId || inviter.referred_by === userId)
    throw new CoreError("invalid_code", "این کد برای حساب شما قابل استفاده نیست.", 400);
  const res = await run(
    `update profiles set referred_by = $2::uuid where id = $1::uuid and referred_by is null returning id`,
    [userId, inviter.id]
  );
  if (!res.rows.length) throw new CoreError("already_referred", "کد دعوت قبلاً ثبت شده است.", 409);
  return { inviterId: inviter.id };
}

export async function adminReferralOverview() {
  const run = q();
  const totals = (
    await run(
      `select (select count(*) from profiles where referred_by is not null)::int as referred,
              count(*)::int as rewards, coalesce(sum(reward_irr), 0)::text as reward_irr,
              coalesce(sum(fee_irr), 0)::text as fee_irr
         from referral_rewards`
    )
  ).rows[0] as { referred: number; rewards: number; reward_irr: string; fee_irr: string };
  const top = (
    await run(
      `select p.id::text as id, p.first_name, p.last_name, p.phone, p.referral_code,
              (select count(*) from profiles f where f.referred_by = p.id)::int as invited,
              coalesce((select sum(reward_irr) from referral_rewards r where r.referrer_id = p.id), 0)::text as reward_irr
         from profiles p
        where exists (select 1 from profiles f where f.referred_by = p.id)
        order by 7 desc, 6 desc limit 50`
    )
  ).rows as Array<Record<string, string | number | null>>;
  const recent = (
    await run(
      `select r.trade_id, r.asset, r.side, r.fee_irr::text, r.reward_irr::text, r.share_bps, r.created_at,
              a.phone as referrer_phone, b.phone as referee_phone
         from referral_rewards r join profiles a on a.id = r.referrer_id join profiles b on b.id = r.referee_id
        order by r.created_at desc limit 100`
    )
  ).rows as Array<Record<string, string | number | null>>;
  return { totals, top, recent };
}
