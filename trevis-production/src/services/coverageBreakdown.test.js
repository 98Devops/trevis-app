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
