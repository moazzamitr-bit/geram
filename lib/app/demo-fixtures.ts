/** Ids and tracking codes that used to be hard-coded into the user panel. */
const DEMO_TX_IDS = new Set([
  "tx-buy-1",
  "tx-sell-1",
  "tx-buy-2",
  "tx-buy-silver-1",
  "tx-buy-copper-1",
]);

const DEMO_TX_CODES = new Set([
  "GRM-A1B2C3",
  "GRM-D4E5F6",
  "GRM-G7H8I9",
  "GRM-AG01",
  "GRM-CU01",
]);

const DEMO_GOAL_IDS = new Set(["goal-car"]);
const DEMO_NOTIFICATION_IDS = new Set(["n1", "n2"]);
const DEMO_BANK_IDS = new Set(["bank-1"]);
const DEMO_IBAN = "IR120170000000123456789001";

type FixtureState = {
  transactions?: { id: string; trackingCode?: string }[];
  goals?: { id: string; name?: string }[];
  notifications?: { id: string; title?: string }[];
  bankAccounts?: { id: string; iban?: string }[];
};

/** Drop the old sample rows, including copies still sitting in localStorage. */
export function stripDemoFixtures<T extends FixtureState>(state: T): T {
  return {
    ...state,
    transactions: (state.transactions ?? []).filter(
      (tx) =>
        !DEMO_TX_IDS.has(tx.id) &&
        !(tx.trackingCode && DEMO_TX_CODES.has(tx.trackingCode))
    ),
    goals: (state.goals ?? []).filter(
      (goal) => !DEMO_GOAL_IDS.has(goal.id) && goal.name !== "خرید خودرو"
    ),
    notifications: (state.notifications ?? []).filter(
      (note) =>
        !DEMO_NOTIFICATION_IDS.has(note.id) &&
        note.title !== "خرید با موفقیت انجام شد" &&
        note.title !== "ورود جدید"
    ),
    bankAccounts: (state.bankAccounts ?? []).filter(
      (account) => !DEMO_BANK_IDS.has(account.id) && account.iban !== DEMO_IBAN
    ),
  };
}
