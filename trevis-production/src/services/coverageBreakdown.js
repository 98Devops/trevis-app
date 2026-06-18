/**
 * Coverage Breakdown Service
 *
 * DISPLAY-ONLY. Produces a human-readable, per-payment explanation of how a
 * student's coverage_end was reached — so a card showing "38 days remaining"
 * is self-evident from the payment ledger.
 *
 * CRITICAL: This adds NO new billing math. It replays the ledger through the
 * SAME authoritative engine the writer uses (`processPayment`), and simply
 * captures each payment's contribution instead of only the final state. It
 * therefore always agrees with rebuildStudentCoverage() / R2 by construction.
 *
 * @module coverageBreakdown
 */

import { processPayment } from './paymentProcessor.js';
import { toLocalISO } from './dateUtil.js';

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

// Like fmtDate but always includes the year — used when a ledger spans multiple
// calendar years, so '30 Jul' (2025) can't be mistaken for '30 Jul' (2026).
const fmtDateYear = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

/**
 * Replay a student's payment ledger and return the per-payment coverage stack.
 *
 * @param {Array<{amount:number|string, payment_date:string|Date}>} payments
 *        The full payment ledger (any order — sorted ASC internally).
 * @param {number} monthlyRent - Monthly rent (per bed) for this student.
 * @returns {{
 *   steps: Array<{
 *     amount: number,
 *     date: string,            // ISO yyyy-mm-dd
 *     dateLabel: string,       // "25 May"
 *     days: number,            // days this payment bought
 *     start: string,           // ISO coverage start for this payment
 *     end: string,             // ISO coverage end after this payment
 *     endLabel: string,        // "23 Jun"
 *     isEarly: boolean,        // stacked on top of existing coverage
 *     prepaidDaysPreserved: number,
 *     line: string,            // ready-to-render summary line
 *   }>,
 *   totalDays: number,         // sum of days across all payments
 *   coverageEnd: string|null,  // final coverage end (ISO)
 *   coverageEndLabel: string|null,
 *   firstStart: string|null,   // first coverage start (ISO)
 * }}
 */
export function buildCoverageBreakdown(payments, monthlyRent) {
  const safe = Array.isArray(payments) ? payments : [];
  // Sort ASC by payment_date — same order the writer replays in.
  const ordered = [...safe]
    .filter((p) => p && p.payment_date != null && p.amount != null)
    .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

  // Pass 1: replay and collect raw per-payment data (no labels yet).
  const raw = [];
  let coverageEnd = null;
  // chainStart = start of the CURRENT continuous coverage chain (resets after a
  // gap), matching rebuildStudentCoverage() / R2. Exposed as `firstStart`.
  let chainStart = null;
  let totalDays = 0;

  for (const p of ordered) {
    const amount = parseFloat(p.amount);
    if (!amount || amount <= 0 || !monthlyRent || monthlyRent <= 0) continue;

    let result;
    try {
      result = processPayment(
        { amount, payment_date: p.payment_date },
        { coverage_end: coverageEnd, monthly_rent: monthlyRent, status: 'ACTIVE' }
      );
    } catch {
      // Non-ACTIVE or invalid — skip from the breakdown (matches writer skipping).
      continue;
    }

    const startISO = toISO(result.coverageStart);
    const endISO = toISO(result.coverageEnd);
    if (chainStart === null || !result.isEarlyPayment) chainStart = startISO;
    coverageEnd = result.coverageEnd;
    totalDays += result.coverageDays;

    raw.push({
      amount,
      paymentDate: p.payment_date,
      date: toISO(p.payment_date),
      days: result.coverageDays,
      start: startISO,
      end: endISO,
      isEarly: result.isEarlyPayment,
      prepaidDaysPreserved: result.prepaidDaysPreserved,
    });
  }

  // Detect a multi-year span so labels disambiguate '30 Jul' (2025) from (2026).
  const years = new Set();
  raw.forEach((s) => {
    if (s.date) years.add(s.date.slice(0, 4));
    if (s.end) years.add(s.end.slice(0, 4));
  });
  const label = years.size > 1 ? fmtDateYear : fmtDate;

  // Pass 2: build display labels with the chosen formatter.
  const steps = raw.map((s) => {
    const sign = s.isEarly ? '+' : '';
    const tag = s.isEarly
      ? ` (early, stacked${s.prepaidDaysPreserved ? `, preserved ${s.prepaidDaysPreserved}d` : ''})`
      : '';
    return {
      amount: s.amount,
      date: s.date,
      dateLabel: label(s.paymentDate),
      days: s.days,
      start: s.start,
      end: s.end,
      endLabel: label(s.end),
      isEarly: s.isEarly,
      prepaidDaysPreserved: s.prepaidDaysPreserved,
      line: `$${s.amount} (${label(s.paymentDate)}): ${sign}${s.days}d → ${label(s.end)}${tag}`,
    };
  });

  // Group steps into coverage CHAINS. A new chain starts on the first step and
  // on every non-early payment (a normal payment after coverage had lapsed = a
  // gap). The LAST chain is the current one; earlier chains are expired.
  const chains = [];
  steps.forEach((step) => {
    if (chains.length === 0 || !step.isEarly) {
      chains.push({ steps: [], start: step.start, end: step.end, days: 0 });
    }
    const c = chains[chains.length - 1];
    c.steps.push(step);
    c.end = step.end;        // chain end = last step's end
    c.days += step.days;
  });
  chains.forEach((c, i) => {
    c.startLabel = label(c.start);
    c.endLabel = label(c.end);
    c.isCurrent = i === chains.length - 1;
  });

  return {
    steps,
    chains,
    totalDays,
    coverageEnd: coverageEnd ? toISO(coverageEnd) : null,
    coverageEndLabel: coverageEnd ? label(coverageEnd) : null,
    firstStart: chainStart, // start of current continuous chain
  };
}

// Timezone-safe: serialize by LOCAL calendar day (the engine builds dates in
// local time). Using toISOString() here shifts dates by a day in non-UTC zones.
function toISO(d) {
  return toLocalISO(d);
}
