/**
 * Tests for coverageBreakdown — the display-only per-payment stack explainer.
 *
 * Asserts it agrees with the authoritative engine and correctly explains the
 * real-world Onenhlanha Nyathi case (the card that prompted this feature).
 */

import { describe, it, expect } from 'vitest';
import { buildCoverageBreakdown } from './coverageBreakdown.js';

describe('buildCoverageBreakdown', () => {
  it('returns empty for no payments', () => {
    const r = buildCoverageBreakdown([], 110);
    expect(r.steps).toEqual([]);
    expect(r.coverageEnd).toBeNull();
    expect(r.totalDays).toBe(0);
  });

  it('single full-month payment: 30 days, normal (not early)', () => {
    const r = buildCoverageBreakdown(
      [{ amount: 110, payment_date: '2026-05-25' }],
      110
    );
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].days).toBe(30);
    expect(r.steps[0].isEarly).toBe(false);
    expect(r.steps[0].start).toBe('2026-05-25');
    expect(r.steps[0].end).toBe('2026-06-23'); // 25 May + 30 - 1
    expect(r.coverageEnd).toBe('2026-06-23');
    expect(r.totalDays).toBe(30);
  });

  it('Onenhlanha Nyathi: $110 (25 May) then early $114 (02 Jun) STACKS to 24 Jul', () => {
    // rent $110/bed, daily rate 3.67
    // P1 $110 -> 30d -> 25 May..23 Jun (normal)
    // P2 $114 on 02 Jun <= 23 Jun -> EARLY -> stacks 24 Jun..24 Jul (31d)
    const r = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-05-25' },
        { amount: 114, payment_date: '2026-06-02' },
      ],
      110
    );

    expect(r.steps).toHaveLength(2);

    // Step 1 — normal
    expect(r.steps[0].days).toBe(30);
    expect(r.steps[0].isEarly).toBe(false);
    expect(r.steps[0].end).toBe('2026-06-23');

    // Step 2 — early, stacked
    expect(r.steps[1].days).toBe(31); // round(114 / 3.67) = round(31.06) = 31
    expect(r.steps[1].isEarly).toBe(true);
    expect(r.steps[1].start).toBe('2026-06-24'); // day after first coverage end
    expect(r.steps[1].end).toBe('2026-07-24');

    // Final
    expect(r.coverageEnd).toBe('2026-07-24');
    expect(r.totalDays).toBe(61); // 30 + 31

    // REGRESSION GUARD (coverage_start bug): the chain start is the FIRST
    // payment's slice start, NEVER the last payment's. A long-term tenant whose
    // last payment is a tiny early/stacked slice must NOT get start==end.
    expect(r.firstStart).toBe('2026-05-25'); // first payment, not 2026-06-24
    expect(r.firstStart).not.toBe(r.coverageEnd);

    // 24 Jul - 16 Jun = 38 days remaining (the number on the card)
    const today = new Date('2026-06-16');
    const end = new Date(r.coverageEnd);
    const daysRemaining = Math.round((end - today) / (1000 * 60 * 60 * 24));
    expect(daysRemaining).toBe(38);
  });

  it('sorts unordered ledger ascending before replay (stack order is stable)', () => {
    const ascending = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-05-25' },
        { amount: 114, payment_date: '2026-06-02' },
      ],
      110
    );
    const descending = buildCoverageBreakdown(
      [
        { amount: 114, payment_date: '2026-06-02' },
        { amount: 110, payment_date: '2026-05-25' },
      ],
      110
    );
    expect(descending.coverageEnd).toBe(ascending.coverageEnd);
    expect(descending.totalDays).toBe(ascending.totalDays);
    expect(descending.steps[0].date).toBe('2026-05-25'); // re-sorted oldest first
  });

  it('skips zero/invalid amounts without throwing', () => {
    const r = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-05-25' },
        { amount: 0, payment_date: '2026-06-02' },
        { amount: null, payment_date: '2026-06-10' },
      ],
      110
    );
    expect(r.steps).toHaveLength(1);
    expect(r.coverageEnd).toBe('2026-06-23');
  });

  it('resets chain start (firstStart) after a coverage GAP', () => {
    // Pay 1 month in Jan (covers ~Jan 1..30), then disappear, then pay again in
    // Jun (coverage long lapsed). The Jun payment is a NORMAL (non-early)
    // payment, so it begins a NEW continuous chain — firstStart must be Jun,
    // NOT Jan, and NOT the last slice.
    const r = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-01-01' }, // chain 1: 01 Jan..30 Jan
        { amount: 110, payment_date: '2026-06-01' }, // gap! new chain: 01 Jun..
      ],
      110
    );
    expect(r.steps).toHaveLength(2);
    expect(r.steps[1].isEarly).toBe(false); // gap -> normal payment
    expect(r.firstStart).toBe('2026-06-01'); // chain reset, not 2026-01-01
    expect(r.coverageEnd).toBe('2026-06-30');
  });

  it('does NOT reset chain start when payments are continuous (early/stacked)', () => {
    const r = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-05-25' },
        { amount: 114, payment_date: '2026-06-02' }, // early, within coverage
      ],
      110
    );
    expect(r.steps[1].isEarly).toBe(true);
    expect(r.firstStart).toBe('2026-05-25'); // unbroken chain keeps original start
  });

  it('groups steps into chains: gap splits into previous + current', () => {
    const r = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-01-01' }, // chain 1
        { amount: 110, payment_date: '2026-06-01' }, // gap -> chain 2 (current)
      ],
      110
    );
    expect(r.chains).toHaveLength(2);
    expect(r.chains[0].isCurrent).toBe(false);
    expect(r.chains[0].start).toBe('2026-01-01');
    expect(r.chains[1].isCurrent).toBe(true);
    expect(r.chains[1].start).toBe('2026-06-01');
    expect(r.chains[1].end).toBe('2026-06-30');
  });

  it('continuous (early/stacked) payments stay ONE current chain', () => {
    const r = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-05-25' },
        { amount: 114, payment_date: '2026-06-02' }, // early -> same chain
      ],
      110
    );
    expect(r.chains).toHaveLength(1);
    expect(r.chains[0].isCurrent).toBe(true);
    expect(r.chains[0].steps).toHaveLength(2);
    expect(r.chains[0].start).toBe('2026-05-25');
    expect(r.chains[0].end).toBe('2026-07-24');
    expect(r.chains[0].days).toBe(61);
  });

  it('includes the year in labels when the ledger spans multiple years', () => {
    // Real Onenhlanha-style: payments in 2025 AND 2026 -> labels must show year.
    const r = buildCoverageBreakdown(
      [
        { amount: 106, payment_date: '2025-07-30' },
        { amount: 110, payment_date: '2026-05-25' },
      ],
      110
    );
    expect(r.steps[0].dateLabel).toContain('2025');
    expect(r.steps[1].dateLabel).toContain('2026');
    expect(r.coverageEndLabel).toContain('20'); // has a year
  });

  it('omits the year for a single-year ledger (compact labels)', () => {
    const r = buildCoverageBreakdown(
      [{ amount: 110, payment_date: '2026-05-25' }],
      110
    );
    expect(r.steps[0].dateLabel).toBe('25 May');
  });

  it('produces a ready-to-render line string per step', () => {
    const r = buildCoverageBreakdown(
      [
        { amount: 110, payment_date: '2026-05-25' },
        { amount: 114, payment_date: '2026-06-02' },
      ],
      110
    );
    expect(r.steps[0].line).toContain('$110');
    expect(r.steps[0].line).toContain('30d');
    expect(r.steps[1].line).toContain('+31d');
    expect(r.steps[1].line).toContain('early, stacked');
  });
});
