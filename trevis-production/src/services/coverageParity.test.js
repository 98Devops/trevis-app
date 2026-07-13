/**
 * Coverage parity tests (production-hardening audit, Bucket 3).
 *
 * Pins the agreements between engine surfaces that MUST never diverge:
 *  1. generatePaymentPreview vs processPayment — same classification for the
 *     same inputs, especially the day-coverage-ends edge case (they used to
 *     disagree: preview said "normal", processing said "early").
 *  2. buildCoverageBreakdown (the profile drawer's ledger replay) vs a direct
 *     processPayment chain (what rebuildStudentCoverage/the nightly auditor
 *     replay) — the same ledger must produce the same final coverage end.
 *  3. classifyStudent's no-coverage_end contract (OVERDUE with null days) —
 *     intentional; pinned so a refactor can't silently change it.
 */
import { describe, it, expect } from 'vitest';
import { processPayment, generatePaymentPreview } from './paymentProcessor.js';
import { buildCoverageBreakdown } from './coverageBreakdown.js';
import { classifyStudent } from './statusClassifier.js';
import { toLocalISO, parseLocalDate } from './dateUtil.js';

describe('Preview ↔ processing agreement', () => {
  it('payment on the exact day coverage ends: BOTH treat it as early', () => {
    const today = toLocalISO(new Date());
    const student = { coverage_end: today, billing_anchor_date: null, monthly_rent: 110, status: 'ACTIVE' };

    const preview = generatePaymentPreview(110, student);
    const processed = processPayment({ amount: 110, payment_date: today }, student);

    expect(preview.isEarlyPayment).toBe(true);
    expect(processed.isEarlyPayment).toBe(true);
    // Both must extend from the day AFTER existing coverage, not from today.
    const dayAfter = parseLocalDate(today);
    dayAfter.setDate(dayAfter.getDate() + 1);
    expect(processed.coverageStart).toEqual(dayAfter);
    expect(toLocalISO(preview.coverageStart)).toBe(toLocalISO(dayAfter));
  });

  it('expired coverage: BOTH treat a payment today as a normal (non-early) payment', () => {
    const yesterday = parseLocalDate(new Date());
    yesterday.setDate(yesterday.getDate() - 1);
    const student = {
      coverage_end: toLocalISO(yesterday),
      billing_anchor_date: null,
      monthly_rent: 110,
      status: 'ACTIVE',
    };

    const preview = generatePaymentPreview(110, student);
    const processed = processPayment({ amount: 110, payment_date: toLocalISO(new Date()) }, student);

    expect(preview.isEarlyPayment).toBe(false);
    expect(processed.isEarlyPayment).toBe(false);
  });
});

describe('Breakdown ↔ engine-chain parity (auditor invariant)', () => {
  // The same replay loop the rebuild/auditor use: feed each payment the
  // previous coverage_end.
  function replayChain(payments, monthlyRent) {
    let coverageEnd = null;
    let final = null;
    for (const p of payments) {
      final = processPayment(
        { amount: p.amount, payment_date: p.payment_date },
        { coverage_end: coverageEnd, monthly_rent: monthlyRent, status: 'ACTIVE' },
      );
      coverageEnd = final.coverageEnd;
    }
    return final ? toLocalISO(final.coverageEnd) : null;
  }

  const LEDGERS = [
    // Ella's real shape: gapped chains (expired, expired, current)
    [
      { amount: 130, payment_date: '2026-03-09' },
      { amount: 130, payment_date: '2026-05-11' },
      { amount: 130, payment_date: '2026-06-10' },
    ],
    // Kuda's real shape: gap + back-to-back early payments (incl. future-dated)
    [
      { amount: 130, payment_date: '2025-10-13' },
      { amount: 130, payment_date: '2026-05-01' },
      { amount: 130, payment_date: '2026-06-02' },
      { amount: 130, payment_date: '2026-07-02' },
    ],
    // Stacked prepayments + partial amount
    [
      { amount: 110, payment_date: '2026-07-01' },
      { amount: 110, payment_date: '2026-07-10' },
      { amount: 55,  payment_date: '2026-07-12' },
    ],
  ];

  it.each(LEDGERS.map((l, i) => [i + 1, l]))('ledger #%s: breakdown end === chain end', (_i, ledger) => {
    const rent = 130;
    const breakdown = buildCoverageBreakdown(ledger, rent);
    expect(breakdown.coverageEnd).toBe(replayChain(ledger, rent));
  });
});

describe('classifyStudent no-coverage contract (pinned)', () => {
  it('ACTIVE student with no coverage_end classifies OVERDUE with null daysOverdue', () => {
    const c = classifyStudent({ id: 'x', status: 'ACTIVE', coverage_end: null, daily_rate: null });
    expect(c.status).toBe('OVERDUE');
    expect(c.daysOverdue ?? null).toBeNull();
  });
});
