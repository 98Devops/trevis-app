/**
 * Tests for toLocalISO — the timezone-safe coverage date formatter.
 *
 * The 2026-06-18 bug: the engine builds dates with new Date(y,m,d)/setDate
 * (LOCAL time), but they were serialized with toISOString() (UTC), shifting a
 * day in non-UTC zones. These tests assert toLocalISO reads the LOCAL calendar
 * day consistently. Run the suite under TZ=UTC and a non-UTC TZ — both must pass.
 */

import { describe, it, expect } from 'vitest';
import { toLocalISO } from './dateUtil.js';

describe('toLocalISO', () => {
  it('returns null for falsy / invalid input', () => {
    expect(toLocalISO(null)).toBeNull();
    expect(toLocalISO(undefined)).toBeNull();
    expect(toLocalISO('')).toBeNull();
    expect(toLocalISO(new Date('not a date'))).toBeNull();
  });

  it('formats a locally-constructed date by its LOCAL calendar day', () => {
    // This is the exact construction that broke: last-day-of-month via
    // new Date(year, monthIndex, 0). It is LOCAL midnight. toISOString() would
    // shift it to the prior day in UTC+ zones; toLocalISO must not.
    const lastDayOfMay2026 = new Date(2026, 5, 0); // 31 May 2026, local midnight
    expect(toLocalISO(lastDayOfMay2026)).toBe('2026-05-31');
  });

  it('formats a date built with setDate arithmetic (engine path)', () => {
    const d = new Date(2026, 4, 31); // 31 May 2026 local
    d.setDate(d.getDate() + 29);     // + 29 days
    // 31 May + 29 = 29 Jun 2026
    expect(toLocalISO(d)).toBe('2026-06-29');
  });

  it('round-trips a bare YYYY-MM-DD without shifting', () => {
    // A stored coverage date re-read and re-formatted must be stable.
    expect(toLocalISO(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toLocalISO(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('pads month and day to two digits', () => {
    expect(toLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalISO(new Date(2026, 8, 9))).toBe('2026-09-09');
  });
});
