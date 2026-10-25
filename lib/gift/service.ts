import { randomInt } from "crypto";
import type { AssetCode } from "@/lib/core/assets";
import { line, postJournal, requireBalance } from "@/lib/core/ledger";
import { userFundsLockKey } from "@/lib/core/locks";
import { getFinancialCore } from "@/lib/core/runtime";
import { ensureUserAccounts, newId } from "@/lib/core/store";
import { CoreError } from "@/lib/core/types";

export const REF_TYPE = "gift_card";
export const GIFT_TTL_DAYS = 30;
export const GIFT_ASSETS = ["GOLD", "SILVER", "COPPER"] as const;
/** Per-asset bounds in µg. */
export const GIFT_LIMITS: Record<(typeof GIFT_ASSETS)[number], { minUg: bigint; maxUg: bigint }> = {
  GOLD: { minUg: 10_000n, maxUg: 50_000_000n }, // 0.01 g – 50 g
  SILVER: { minUg: 100_000n, maxUg: 5_000_000_000n }, // 0.1 g – 5 kg
  COPPER: { minUg: 1_000_000n, maxUg: 50_000_000_000n }, // 1 g – 50 kg
};
const FA: Record<string, string> = { GOLD: "طلا", SILVER: "نقره", COPPER: "مس" };

export type GiftStatus = "ACTIVE" | "REDEEMED" | "CANCELLED" | "EXPIRED";
export type GiftRow = {
  id: string;
  code: string;
  sender_id: string;
  recipient_id: string | null;
  asset: AssetCode;
  weight_ug: string;
  cost_removed_irr: string;
  message: string | null;
  status: GiftStatus;
  expires_at: string;
  settled_at: string | null;
  created_at: string;
};
const COLS = `id, code, sender_id, recipient_id, asset, weight_ug::text weight_ug, cost_removed_irr::text cost_removed_irr,
  message, status, expires_at, settled_at, created_at`;

// No 0/O/1/I/L: codes are read aloud and typed on phones.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newGiftCode() {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `GRM-${pick()}-${pick()}`; // 8 chars ≈ 40 bits
}
export function normalizeGiftCode(raw: string) {
  const s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^GRM/, "");
  return s.length === 8 ? `GRM-${s.slice(0, 4)}-${s.slice(4)}` : null;
}

function ctx() {
  const core = getFinancialCore();
  const store = core.ledgerStore();
  if (!store.rawQuery) throw new CoreError("misconfigured", "Postgres ledger required", 500);
  return { core, store, q: store.rawQuery.bind(store) };
}

async function notify(q: ReturnType<typeof ctx>["q"], userId: string, title: string, message: string) {
  await q(
    `insert into notifications (user_id, type, title, message, href, read) values ($1, 'SYSTEM', $2, $3, '/app/gift', false)`,
    [userId, title, message]
  );
}

function grams(ug: bigint | string) {
  return (Number(ug) / 1_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 4 });
}

export async function createGift(input: { userId: string; asset: unknown; weightUg: unknown; message?: unknown }) {
  const asset = String(input.asset) as (typeof GIFT_ASSETS)[number];
  if (!GIFT_ASSETS.includes(asset)) throw new CoreError("invalid_asset", "فلز انتخاب‌شده معتبر نیست.");
  let weight: bigint;
  try {
    weight = BigInt(String(input.weightUg));
  } catch {
    throw new CoreError("invalid_amount", "مقدار هدیه معتبر نیست.");
  }
  const lim = GIFT_LIMITS[asset];
  if (weight < lim.minUg) throw new CoreError("invalid_amount", `حداقل هدیه ${grams(lim.minUg)} گرم ${FA[asset]} است.`);
  if (weight > lim.maxUg) throw new CoreError("invalid_amount", `حداکثر هدیه ${grams(lim.maxUg)} گرم ${FA[asset]} است.`);
  const message = typeof input.message === "string" ? input.message.trim().slice(0, 140) || null : null;

  const { core, store, q } = ctx();
  await core.bootstrap();
  await ensureUserAccounts(store, input.userId);
  return store.withTransaction(() =>
    store.withAdvisoryLock(userFundsLockKey(input.userId), async () => {
      await requireBalance(
        store,
        input.userId,
        "USER_AVAILABLE",
        asset,
        weight,
        `موجودی ${FA[asset]} شما برای این هدیه کافی نیست.`
      );
      const id = newId();
      const cost = await core.takeUserCost(input.userId, asset, weight);
      await postJournal(store, {
        id: newId("jnl"),
        createdAt: new Date().toISOString(),
        reason: "GIFT_RESERVE",
        refType: REF_TYPE,
        refId: id,
        lines: [
          line("USER_AVAILABLE", input.userId, asset, weight, 0n),
          line("USER_RESERVED", input.userId, asset, 0n, weight),
        ],
      });
      const expires = new Date(Date.now() + GIFT_TTL_DAYS * 86_400_000).toISOString();
      for (let attempt = 0; ; attempt++) {
        try {
          const { rows } = await q(
            `insert into gift_cards (id, code, sender_id, asset, weight_ug, cost_removed_irr, message, expires_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${COLS}`,
            [id, newGiftCode(), input.userId, asset, weight.toString(), cost.toString(), message, expires]
          );
          return rows[0] as unknown as GiftRow;
        } catch (err) {
          if (attempt < 3 && /gift_cards_code_key/.test(String(err))) continue;
          throw err;
        }
      }
    })
  );
}

/** Looks a code up for the redeem screen without revealing the sender's identity beyond a first name. */
export async function previewGift(rawCode: string) {
  const code = normalizeGiftCode(rawCode);
  if (!code) throw new CoreError("invalid_code", "کد هدیه معتبر نیست.", 400);
  const { q } = ctx();
  const { rows } = await q(
    `select g.asset, g.weight_ug::text weight_ug, g.message, g.status, g.expires_at, p.first_name
       from gift_cards g join profiles p on p.id = g.sender_id where g.code = $1`,
    [code]
  );
  const row = rows[0] as Record<string, string> | undefined;
  if (!row) throw new CoreError("not_found", "کارت هدیه‌ای با این کد پیدا نشد.", 404);
  return {
    code,
    asset: row.asset,
    weightUg: row.weight_ug,
    message: row.message,
    status: (row.status === "ACTIVE" && new Date(row.expires_at) <= new Date() ? "EXPIRED" : row.status) as GiftStatus,
    expiresAt: row.expires_at,
    senderName: row.first_name || "یکی از کاربران گرم",
  };
}

type Settle = "redeem" | "cancel" | "expire";

async function settle(kind: Settle, where: { code?: string; id?: string }, actor: { userId?: string }) {
  const { core, store, q } = ctx();
  return store.withTransaction(async () => {
    const { rows } = await q(
      `select ${COLS} from gift_cards where ${where.code ? "code" : "id"} = $1 for update`,
      [where.code ?? where.id]
    );
    const g = rows[0] as unknown as GiftRow | undefined;
    if (!g) throw new CoreError("not_found", "کارت هدیه‌ای با این کد پیدا نشد.", 404);
    if (kind === "cancel" && g.sender_id !== actor.userId) throw new CoreError("not_found", "کارت هدیه پیدا نشد.", 404);
    if (g.status !== "ACTIVE") {
      const why: Record<string, string> = {
        REDEEMED: "این کارت هدیه قبلاً دریافت شده است.",
        CANCELLED: "این کارت هدیه توسط فرستنده لغو شده است.",
        EXPIRED: "مهلت این کارت هدیه تمام شده است.",
      };
      throw new CoreError("gift_unavailable", why[g.status], 409);
    }
    const expired = new Date(g.expires_at) <= new Date();
    if (kind === "redeem") {
      if (expired) throw new CoreError("gift_unavailable", "مهلت این کارت هدیه تمام شده است.", 409);
      if (g.sender_id === actor.userId) throw new CoreError("own_gift", "نمی‌توانید هدیه‌ی خودتان را دریافت کنید.", 400);
    }
    if (kind === "expire" && !expired) return g;

    const weight = BigInt(g.weight_ug);
    const to = kind === "redeem" ? actor.userId! : g.sender_id;
    if (kind === "redeem") await ensureUserAccounts(store, to);
    const lockA = userFundsLockKey(g.sender_id);
    return store.withAdvisoryLock(lockA, async () => {
      await postJournal(store, {
        id: newId("jnl"),
        createdAt: new Date().toISOString(),
        reason: kind === "redeem" ? "GIFT_REDEEM" : "GIFT_RELEASE",
        refType: REF_TYPE,
        refId: g.id,
        lines: [
          line("USER_RESERVED", g.sender_id, g.asset, weight, 0n),
          line("USER_AVAILABLE", to, g.asset, 0n, weight),
        ],
      });
      // Cost basis travels with the metal (sender's purchase cost).
      await core.giveUserCost(to, g.asset, weight, BigInt(g.cost_removed_irr));
      const status: GiftStatus = kind === "redeem" ? "REDEEMED" : kind === "cancel" ? "CANCELLED" : "EXPIRED";
      const { rows: out } = await q(
        `update gift_cards set status = $2, recipient_id = $3, settled_at = now() where id = $1 returning ${COLS}`,
        [g.id, status, kind === "redeem" ? to : null]
      );
      const amount = `${grams(weight)} گرم ${FA[g.asset]}`;
      if (kind === "redeem") {
        await notify(q, g.sender_id, "هدیه‌ی شما دریافت شد", `کارت هدیه ${g.code} (${amount}) توسط گیرنده دریافت شد.`);
        await notify(q, to, "هدیه به کیف پول شما اضافه شد", `${amount} از کارت هدیه ${g.code} به دارایی شما اضافه شد.`);
      } else if (kind === "expire") {
        await notify(q, g.sender_id, "مهلت کارت هدیه تمام شد", `کارت هدیه ${g.code} دریافت نشد و ${amount} به دارایی شما برگشت.`);
      }
      return out[0] as unknown as GiftRow;
    });
  });
}

export async function redeemGift(userId: string, rawCode: string) {
  const code = normalizeGiftCode(rawCode);
  if (!code) throw new CoreError("invalid_code", "کد هدیه معتبر نیست.", 400);
  return settle("redeem", { code }, { userId });
}

export async function cancelGift(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new CoreError("not_found", "کارت هدیه پیدا نشد.", 404);
  return settle("cancel", { id }, { userId });
}

export async function expireGiftCards(now = new Date()) {
  const { q } = ctx();
  const { rows } = await q(
    `select id from gift_cards where status = 'ACTIVE' and expires_at <= $1 order by expires_at limit 200`,
    [now.toISOString()]
  );
  let expired = 0;
  for (const r of rows as Array<{ id: string }>) {
    try {
      const g = await settle("expire", { id: r.id }, {});
      if (g.status === "EXPIRED") expired += 1;
    } catch (err) {
      if (!(err instanceof CoreError && err.code === "gift_unavailable")) console.error("gift expire", r.id, err);
    }
  }
  return { due: rows.length, expired };
}

export async function listUserGifts(userId: string) {
  const { q } = ctx();
  const { rows } = await q(
    `select ${COLS} from gift_cards where sender_id = $1 or recipient_id = $1 order by created_at desc limit 50`,
    [userId]
  );
  return (rows as unknown as GiftRow[]).map((g) => ({
    ...g,
    status: (g.status === "ACTIVE" && new Date(g.expires_at) <= new Date() ? "EXPIRED" : g.status) as GiftStatus,
    direction: g.sender_id === userId ? ("SENT" as const) : ("RECEIVED" as const),
    // Codes of received/settled cards are not needed client-side.
    code: g.sender_id === userId ? g.code : `GRM-••••-${g.code.slice(-4)}`,
  }));
}

export async function adminGiftOverview() {
  const { q } = ctx();
  const [{ rows: totals }, { rows: recent }] = await Promise.all([
    q(`select status, asset, count(*)::int n, sum(weight_ug)::text ug from gift_cards group by status, asset order by status, asset`),
    q(
      `select g.id, g.code, g.asset, g.weight_ug::text weight_ug, g.status, g.created_at, g.expires_at, g.settled_at,
              s.phone sender_phone, s.first_name sender_first, s.last_name sender_last, s.id sender_id,
              r.phone recipient_phone, r.first_name recipient_first, r.last_name recipient_last, r.id recipient_id
         from gift_cards g join profiles s on s.id = g.sender_id left join profiles r on r.id = g.recipient_id
        order by g.created_at desc limit 200`
    ),
  ]);
  return { totals: totals as Array<Record<string, string | number>>, recent: recent as Array<Record<string, string | null>> };
}
