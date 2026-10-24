/**
 * One advisory lock per user id.
 *
 * Buy settlement and an admin debit of the same user both take this key
 * (`pg_advisory_xact_lock(hashtext(key))` on Postgres) before they read
 * USER_AVAILABLE and post a journal. Different keys let both succeed and
 * spend the same rial.
 */
export function userFundsLockKey(userId: string) {
  return `user:${userId.trim()}`;
}
