/**
 * Date utilities — TIMEZONE-SAFE coverage date handling.
 *
 * THE BUG THIS PREVENTS (found 2026-06-18 by the UTC CI monitor):
 * The rent-cycle engine builds dates with setDate/getDate/new Date(y,m,d) — all
 * LOCAL-time operations. Serializing those with `.toISOString()` reads them in
 * UTC, so a date sitting near midnight shifts by a day depending on the runner's
 * timezone (UTC+2 locally vs UTC in CI) — making coverage values timezone-
 * dependent. The same ledger produced different `next_due_date`/`coverage_start`
 * in CI vs on a dev machine.
 *
 * FIX: always serialize by LOCAL calendar components, matching how the engine
 * constructs the dates. A coverage date is a calendar day, not an instant — it
 * must never be reinterpreted through a UTC offset.
 *
 * @module dateUtil
 */

/**
 * Format a Date (or date-like) as 'YYYY-MM-DD' using its LOCAL calendar day.
 * Timezone-agnostic for the engine's local-built dates. Returns null for falsy
 * / invalid input.
 *
 * @param {Date|string|null} d
 * @returns {string|null}
 */
export function toLocalISO(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a stored coverage date ('YYYY-MM-DD' or a Date) into a Date at LOCAL
 * midnight — the symmetric inverse of toLocalISO and the safe way to READ a
 * coverage day back for comparison.
 *
 * WHY: `new Date('2026-06-30')` parses as UTC midnight, then a later
 * `setHours(0,0,0,0)` only zeroes the time on whatever LOCAL day that instant
 * already landed on. In a negative-offset timezone that instant is the PREVIOUS
 * local day, so the comparison is off by one. A coverage date is a calendar day,
 * not an instant — split the components and rebuild it in local time so it is
 * timezone-independent (matches how the engine constructs its dates).
 *
 * @param {Date|string|null} value
 * @returns {Date|null} local-midnight Date, or null for falsy/invalid input
 */
export function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
