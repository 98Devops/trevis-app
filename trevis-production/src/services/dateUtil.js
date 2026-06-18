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
