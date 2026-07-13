/**
 * Pure date guards for the UI layer (NOT the coverage engine).
 *
 * A future-dated payment silently pushes a tenant's coverage forward, so the
 * entry/edit sheets require an explicit confirm before accepting one, and the
 * Data Quality screen surfaces existing ones. Centralised here so there is a
 * single definition of "today" and "is future" — and so it can be unit-tested.
 */

/** Local calendar day as YYYY-MM-DD (never UTC — matches the engine's toLocalISO). */
export function localTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * True when an ISO date-only string is strictly after today (local). YYYY-MM-DD
 * compares lexicographically the same as chronologically, so a string compare is
 * exact and timezone-safe. Null/empty is treated as "not future".
 */
export function isFutureDate(
  value: string | null | undefined,
  today: string = localTodayISO(),
): boolean {
  if (!value) return false;
  return String(value).slice(0, 10) > today;
}
