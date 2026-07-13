/**
 * One-off: rewrite seed_payments.sql payment dates from a single 2026-05-01 to a
 * realistic distribution around DEMO "today" (2026-06-22), so that after the
 * coverage engine rebuilds, the portfolio shows a healthy mix of
 * CURRENT / EXPIRING_SOON / DUE_TODAY / OVERDUE instead of all-overdue.
 *
 * Full-month payment => ~30 days coverage => coverage_end = payment_date + 29.
 * today = 2026-06-22, EXPIRING threshold = 7 days.
 *   CURRENT       payment_date >= 2026-06-01
 *   EXPIRING_SOON payment_date in 2026-05-25..05-31
 *   DUE_TODAY     payment_date = 2026-05-24
 *   OVERDUE       payment_date <= 2026-05-23
 *
 * Run: node supabase/_distribute_payment_dates.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('./seed_payments.sql', import.meta.url);
let sql = readFileSync(FILE, 'utf8');

// Variety pools per status category (each yields the intended status for a
// full-month payment; partials shift slightly earlier — realistic noise).
const CURRENT  = ['2026-06-18','2026-06-12','2026-06-05','2026-06-15','2026-06-09','2026-06-20','2026-06-02','2026-06-14'];
const EXPIRING = ['2026-05-28','2026-05-26','2026-05-30','2026-05-31','2026-05-25'];
const DUE      = ['2026-05-24'];
const OVERDUE  = ['2026-05-15','2026-05-20','2026-05-10','2026-05-18','2026-05-22'];

// 20-slot cycle: 14 current, 3 expiring, 1 due-today, 2 overdue.
// ~137 payments -> ~96 current, ~20 expiring, ~7 due, ~14 overdue.
function categoryFor(i) {
  const s = i % 20;
  if (s < 14) return CURRENT;
  if (s < 17) return EXPIRING;
  if (s < 18) return DUE;
  return OVERDUE;
}

let n = 0;
const counts = { CURRENT: 0, EXPIRING: 0, DUE: 0, OVERDUE: 0 };
sql = sql.replace(/'2026-05-01'/g, () => {
  const pool = categoryFor(n);
  const date = pool[n % pool.length];
  if (pool === CURRENT) counts.CURRENT++;
  else if (pool === EXPIRING) counts.EXPIRING++;
  else if (pool === DUE) counts.DUE++;
  else counts.OVERDUE++;
  n++;
  return `'${date}'`;
});

// Also bump month_year so monthly-collection views read June, not May.
sql = sql.replace(/'2026-05'/g, '2026-06');

writeFileSync(FILE, sql);
console.log(`Rewrote ${n} payment dates.`);
console.log('Target spread (full-month payments):', counts);
console.log('Note: partial payments + no-payment students add extra OVERDUE — realistic.');
