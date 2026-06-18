#!/usr/bin/env node
/**
 * R2 — FULL PORTFOLIO COVERAGE REPLAY
 *
 *   ACTIVE students → read payment ledger → replay through the JS engine
 *   (processPayment, the SAME function rebuildStudentCoverage uses) → rewrite
 *   coverage fields. Fixes historical drift left by the retired SQL engines
 *   (FLOOR / most-recent-only). Non-destructive: coverage is fully derived from
 *   the immutable payment ledger.
 *
 * USAGE:
 *   node scripts/replay_portfolio_coverage.mjs --dry-run   # report drift, write NOTHING (default)
 *   node scripts/replay_portfolio_coverage.mjs --apply     # rewrite coverage columns
 *
 * ENV (required): SUPABASE_URL, SUPABASE_SERVICE_KEY (or VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 *
 * SAFETY:
 *   • Defaults to --dry-run. --apply must be explicit.
 *   • Reuses the authoritative pure engine — no new/duplicate math (Rule 1, Rule 2).
 *   • Only writes the 4 derived coverage columns; never touches payments.
 *   • Take a DB backup first (DATABASE_CLEANSING_PLAN.md §0).
 */

import { createClient } from '@supabase/supabase-js';
import { processPayment } from '../src/services/paymentProcessor.js';

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
// --report: emit a structured Coverage Integrity Report (for nightly cron/CI).
// Read-only; never writes; exits non-zero if the portfolio is not HEALTHY.
const REPORT = process.argv.includes('--report');
const MODE = APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY (or VITE_ equivalents) in the environment.');
  process.exit(1);
}
const supabase = createClient(url, key);

// Timezone-safe: serialize by LOCAL calendar day to match the engine (which
// builds dates with setDate/getDate). toISOString() would shift dates a day in
// non-UTC zones — the bug that made R2 report different results in CI vs local.
import { toLocalISO } from '../src/services/dateUtil.js';
const fmt = (d) => toLocalISO(d);

/** Replay one student's ledger through the engine. Returns the final coverage state. */
function replayLedger(payments, monthlyRent, status) {
  let coverageEnd = null;
  let final = null;
  // coverage_start = start of the CURRENT CONTINUOUS chain. Resets after a gap
  // (a non-early/normal payment that lands after coverage lapsed). Matches
  // rebuildStudentCoverage().
  let chainStart = null;
  for (const p of payments) {
    final = processPayment(
      { amount: parseFloat(p.amount), payment_date: p.payment_date },
      { coverage_end: coverageEnd, monthly_rent: monthlyRent, status }
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
  console.log(`\n=== R2 PORTFOLIO REPLAY — ${MODE} — ${new Date().toISOString()} ===\n`);

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, status, coverage_start, coverage_end, daily_rate, next_due_date, rooms(rent_per_bed)')
    .eq('status', 'ACTIVE')
    .order('full_name', { ascending: true });

  if (error) { console.error('Failed to fetch students:', error.message); process.exit(1); }

  let checked = 0, drifted = 0, written = 0, skipped = 0, failed = 0;
  let corruptRanges = 0; // stored coverage_start >= coverage_end (the exact bug signature)
  const driftRows = [];

  for (const s of students) {
    checked++;
    const rent = s.rooms?.rent_per_bed;
    if (!rent) { skipped++; console.warn(`SKIP  ${s.full_name}: no room rent (orphaned — see DATABASE_CLEANSING_PLAN §7)`); continue; }

    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .eq('student_id', s.id)
      .order('payment_date', { ascending: true });
    if (pErr) { failed++; console.error(`FAIL  ${s.full_name}: ${pErr.message}`); continue; }

    let expected;
    try { expected = replayLedger(payments || [], rent, s.status); }
    catch (e) { failed++; console.error(`FAIL  ${s.full_name}: ${e.message}`); continue; }

    const stored = {
      coverage_start: s.coverage_start, coverage_end: s.coverage_end,
      daily_rate: s.daily_rate == null ? null : Number(s.daily_rate),
      next_due_date: s.next_due_date,
    };
    // Corrupt range = the coverage_start bug signature (start collapsed onto/past end).
    if (stored.coverage_start && stored.coverage_end && stored.coverage_start >= stored.coverage_end) {
      corruptRanges++;
    }
    const isDrift =
      stored.coverage_start !== expected.coverage_start ||
      stored.coverage_end   !== expected.coverage_end   ||
      stored.next_due_date  !== expected.next_due_date  ||
      (stored.daily_rate ?? null) !== (expected.daily_rate ?? null);

    if (isDrift) {
      drifted++;
      driftRows.push({ name: s.full_name, stored: stored.coverage_end, expected: expected.coverage_end,
        endEarlier: !!(stored.coverage_end && expected.coverage_end && expected.coverage_end < stored.coverage_end),
        endLater:   !!(stored.coverage_end && expected.coverage_end && expected.coverage_end > stored.coverage_end),
        endOnly:    stored.coverage_end === expected.coverage_end });
      if (VERBOSE) {
        // Read-only diagnostic: show EVERY field that differs, and whether
        // coverage_end moves earlier (UNSAFE) / later (safe) / equal.
        const diffs = [];
        if (stored.coverage_start !== expected.coverage_start) diffs.push(`start ${stored.coverage_start}->${expected.coverage_start}`);
        if (stored.coverage_end   !== expected.coverage_end)   diffs.push(`end ${stored.coverage_end}->${expected.coverage_end}`);
        if (stored.next_due_date  !== expected.next_due_date)  diffs.push(`next_due ${stored.next_due_date}->${expected.next_due_date}`);
        if ((stored.daily_rate ?? null) !== (expected.daily_rate ?? null)) diffs.push(`rate ${stored.daily_rate}->${expected.daily_rate}`);
        let dir = 'end=';
        if (stored.coverage_end && expected.coverage_end) {
          dir = expected.coverage_end < stored.coverage_end ? '⚠️EARLIER'
              : expected.coverage_end > stored.coverage_end ? 'later'
              : 'end-equal';
        }
        console.log(`DRIFT ${s.full_name} [${dir}]: ${diffs.join(' | ')}`);
      } else {
        console.log(`DRIFT ${s.full_name}: stored end=${stored.coverage_end} -> correct end=${expected.coverage_end}` +
                    (stored.daily_rate !== expected.daily_rate ? ` | rate ${stored.daily_rate}->${expected.daily_rate}` : ''));
      }

      if (APPLY && !REPORT) {
        const { error: uErr } = await supabase.from('students').update(expected).eq('id', s.id);
        if (uErr) { failed++; console.error(`  WRITE FAIL ${s.full_name}: ${uErr.message}`); }
        else { written++; }
      }
    }
  }

  const endEarlier = driftRows.filter(r => r.endEarlier).length;
  const endLater   = driftRows.filter(r => r.endLater).length;
  const endEqual   = driftRows.filter(r => r.endOnly).length;

  // ── Health report mode (4C-A #3): structured, scheduler-friendly output. ──
  if (REPORT) {
    const healthy = drifted === 0 && corruptRanges === 0 && endEarlier === 0 && failed === 0;
    console.log(`\nCoverage Integrity Report`);
    console.log(`-------------------------`);
    console.log(`Students checked:    ${checked}`);
    console.log(`Drifted:             ${drifted}`);
    console.log(`Corrupt ranges:      ${corruptRanges}   (coverage_start >= coverage_end)`);
    console.log(`Coverage reductions: ${endEarlier}   (coverage_end would move earlier)`);
    console.log(`Skipped (no room):   ${skipped}`);
    console.log(`Failed:              ${failed}`);
    console.log(`Last audit:          ${new Date().toISOString()}`);
    console.log(``);
    console.log(`STATUS: ${healthy ? 'HEALTHY ✅' : 'NEEDS ATTENTION ⚠️'}`);
    if (!healthy) {
      if (drifted > 0)       console.log(`  → ${drifted} student(s) drifted from the ledger. Run --dry-run --verbose to inspect, then --apply.`);
      if (corruptRanges > 0) console.log(`  → ${corruptRanges} corrupt coverage range(s). See supabase/AUDIT_coverage_start_bug.sql.`);
      if (endEarlier > 0)    console.log(`  → ${endEarlier} would lose coverage days — investigate before applying.`);
      if (failed > 0)        console.log(`  → ${failed} student(s) failed to evaluate.`);
    }
    // Non-zero exit on any problem so cron/CI can alarm.
    process.exit(healthy ? 0 : 1);
  }

  console.log(`\n=== SUMMARY (${MODE}) ===`);
  console.log(`Checked: ${checked} | Drifted: ${drifted} | ${APPLY ? 'Written' : 'Would write'}: ${APPLY ? written : drifted} | Skipped(no room): ${skipped} | Failed: ${failed}`);
  console.log(`coverage_end direction → later: ${endLater} | equal (other-field drift): ${endEqual} | ⚠️ EARLIER: ${endEarlier} | corrupt ranges: ${corruptRanges}`);
  if (endEarlier > 0) console.log(`\n🛑 STOP: ${endEarlier} student(s) would have coverage_end moved EARLIER. This violates the safety invariant. Do NOT --apply until investigated.`);
  if (!APPLY && drifted > 0) console.log(`\nRe-run with --apply to correct the ${drifted} drifted student(s). Back up first.`);
  if (drifted === 0) console.log(`\n✅ All ACTIVE students already match the JS engine. No drift.`);
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
