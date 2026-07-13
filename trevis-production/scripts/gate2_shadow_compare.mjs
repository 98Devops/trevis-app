#!/usr/bin/env node
/**
 * GATE 2 — SHADOW COMPARE (HARD READ-ONLY)
 *
 * Point the NEW PropNest engine at a copy of TREVIS's database and prove it
 * reproduces what his live system already shows — WITHOUT writing a single byte.
 * This is the trust test before any migration: if the engine agrees on every
 * stored coverage value and the KPI rollup matches his dashboard, the new system
 * is doing the same thing his is.
 *
 * It does two comparisons:
 *   1. Per-student coverage agreement — replay each ACTIVE student's ledger
 *      through the SAME engine the app uses (processPayment) and compare the
 *      result to the coverage_* values ALREADY stored by Trevis's system.
 *   2. Portfolio KPI rollup — classify every student (classifyStudent) and total
 *      the status counts + coverage outstanding, i.e. the exact figures the
 *      dashboard shows, so you can eyeball them against his live dashboard.
 *
 * SAFETY: there is NO write path in this file. It only SELECTs. Use a read-only
 * key if you have one; even a normal key cannot mutate anything here.
 *
 * USAGE:
 *   TARGET_SUPABASE_URL=...  TARGET_SUPABASE_KEY=...  node scripts/gate2_shadow_compare.mjs
 *   # falls back to SUPABASE_URL / VITE_SUPABASE_URL and *_KEY / *_ANON_KEY
 *   node scripts/gate2_shadow_compare.mjs --verbose   # list every drifted student
 */

import { createClient } from '@supabase/supabase-js';
import { processPayment } from '../src/services/paymentProcessor.js';
import { classifyStudent } from '../src/services/statusClassifier.js';
import { coverageOutstanding } from '../src/services/dashboardAttention.js';
import { toLocalISO } from '../src/services/dateUtil.js';

const VERBOSE = process.argv.includes('--verbose');

const url = process.env.TARGET_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.TARGET_SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('ERROR: set TARGET_SUPABASE_URL and TARGET_SUPABASE_KEY (or SUPABASE_/VITE_ equivalents).');
  process.exit(1);
}
const supabase = createClient(url, key);
const fmt = (d) => toLocalISO(d);
const money = (n) => '$' + (Math.round(Number(n) * 100) / 100).toLocaleString();

/** Replay one student's ledger through the engine (mirrors rebuildStudentCoverage). */
function replayLedger(payments, monthlyRent, status) {
  let coverageEnd = null;
  let final = null;
  let chainStart = null;
  for (const p of payments) {
    final = processPayment(
      { amount: parseFloat(p.amount), payment_date: p.payment_date },
      { coverage_end: coverageEnd, monthly_rent: monthlyRent, status },
    );
    if (chainStart === null || !final.isEarlyPayment) chainStart = final.coverageStart;
    coverageEnd = final.coverageEnd;
  }
  if (!final) return { coverage_start: null, coverage_end: null, daily_rate: null, next_due_date: null };
  return {
    coverage_start: fmt(chainStart),
    coverage_end: fmt(final.coverageEnd),
    daily_rate: final.dailyRate,
    next_due_date: fmt(final.nextDueDate),
  };
}

async function main() {
  console.log(`\n=== GATE 2 SHADOW COMPARE — READ-ONLY — ${new Date().toISOString()} ===`);
  console.log(`Target: ${url}\n`);

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, status, coverage_start, coverage_end, daily_rate, next_due_date, rooms(rent_per_bed)')
    .neq('status', 'VACATED')
    .order('full_name', { ascending: true });

  if (error) { console.error('Failed to fetch students:', error.message); process.exit(1); }

  // ── 1. Per-student coverage agreement (ACTIVE only — the replay engine is ACTIVE-only) ──
  let checked = 0, agree = 0, drift = 0, skipped = 0, failed = 0;
  const driftRows = [];

  // ── 2. KPI rollup (what the dashboard shows), computed from STORED values ──
  const counts = { CURRENT: 0, EXPIRING_SOON: 0, DUE_TODAY: 0, OVERDUE: 0, EXCLUDED: 0 };
  let totalOutstanding = 0;

  for (const s of students) {
    // KPI rollup classifies every non-vacated student exactly like the app does.
    const c = classifyStudent(s);
    counts[c.status] = (counts[c.status] ?? 0) + 1;
    if (!c.excludeFromMetrics) totalOutstanding += coverageOutstanding(c, s.daily_rate);

    if (s.status !== 'ACTIVE') continue; // coverage replay is ACTIVE-only
    checked++;
    const rent = s.rooms?.rent_per_bed;
    if (!rent) { skipped++; continue; }

    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .eq('student_id', s.id)
      .order('payment_date', { ascending: true });
    if (pErr) { failed++; continue; }

    let expected;
    try { expected = replayLedger(payments || [], rent, s.status); }
    catch { failed++; continue; }

    const isDrift =
      s.coverage_start !== expected.coverage_start ||
      s.coverage_end !== expected.coverage_end ||
      s.next_due_date !== expected.next_due_date ||
      (s.daily_rate == null ? null : Number(s.daily_rate)) !== (expected.daily_rate ?? null);

    if (isDrift) {
      drift++;
      driftRows.push({ name: s.full_name, storedEnd: s.coverage_end, engineEnd: expected.coverage_end });
      if (VERBOSE) console.log(`  DRIFT ${s.full_name}: stored end=${s.coverage_end} → engine end=${expected.coverage_end}`);
    } else {
      agree++;
    }
  }

  const agreePct = checked > 0 ? Math.round((agree / Math.max(1, checked - skipped)) * 100) : 100;

  console.log(`1) COVERAGE AGREEMENT (engine vs. what Trevis already stored)`);
  console.log(`   ACTIVE checked:   ${checked}`);
  console.log(`   Agree:            ${agree}`);
  console.log(`   Drift:            ${drift}`);
  console.log(`   Skipped(no room): ${skipped}`);
  console.log(`   Failed:           ${failed}`);
  console.log(`   → Engine reproduces ${agreePct}% of stored coverage values.`);
  if (drift > 0 && !VERBOSE) console.log(`   (re-run with --verbose to list the ${drift} drifted student(s))`);

  console.log(`\n2) DASHBOARD KPI ROLLUP (compare against his live dashboard)`);
  console.log(`   Active tenants:   ${counts.CURRENT + counts.EXPIRING_SOON + counts.DUE_TODAY + counts.OVERDUE}`);
  console.log(`   Current:          ${counts.CURRENT}`);
  console.log(`   Expiring soon:    ${counts.EXPIRING_SOON}`);
  console.log(`   Due today:        ${counts.DUE_TODAY}`);
  console.log(`   Overdue:          ${counts.OVERDUE}`);
  console.log(`   Excluded:         ${counts.EXCLUDED}`);
  console.log(`   Coverage outstanding: ${money(totalOutstanding)}`);

  console.log(`\nVERDICT: ${drift === 0 && failed === 0
    ? 'MATCH ✅ — the new engine reproduces Trevis\'s stored coverage exactly.'
    : 'REVIEW ⚠️ — investigate drift before trusting the migration (see rows above).'}`);
  console.log(`(read-only: nothing was written)\n`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
