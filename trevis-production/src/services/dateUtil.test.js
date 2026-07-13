/**
 * Tests for toLocalISO — the timezone-safe coverage date formatter.
 *
 * The 2026-06-18 bug: the engine builds dates with new Date(y,m,d)/setDate
 * (LOCAL time), but they were serialized with toISOString() (UTC), shifting a
 * day in non-UTC zones. These tests assert toLocalISO reads the LOCAL calendar
 * day consistently. Run the suite under TZ=UTC and a non-UTC TZ — both must pass.
 */

import { describe, it, expect } from 'vitest';
import { toLocalISO, parseLocalDate } from './dateUtil.js';

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

describe('parseLocalDate', () => {
  it('returns null for falsy / invalid input', () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate('not a date')).toBeNull();
  });

  it('parses a YYYY-MM-DD string to that exact LOCAL calendar day in ANY timezone', () => {
    // The bug this prevents: new Date('2026-06-30') is UTC midnight, which is the
    // PRIOR local day in a negative-offset zone. parseLocalDate rebuilds from the
    // components, so the local Y/M/D always equal the string — no offset drift.
    const d = parseLocalDate('2026-06-30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
    expect(d.getDate()).toBe(30);
    expect(d.getHours()).toBe(0);
  });

  it('is the exact inverse of toLocalISO (round-trip is stable)', () => {
    for (const iso of ['2026-01-01', '2026-06-30', '2026-12-31', '2025-02-28']) {
      expect(toLocalISO(parseLocalDate(iso))).toBe(iso);
    }
  });

  it('normalizes a Date to local midnight without shifting the day', () => {
    const noon = new Date(2026, 5, 30, 12, 34, 56);
    const d = parseLocalDate(noon);
    expect(toLocalISO(d)).toBe('2026-06-30');
    expect(d.getHours()).toBe(0);
  });

  it('tolerates a full timestamp string, keeping the date part', () => {
    expect(toLocalISO(parseLocalDate('2026-06-30T00:00:00'))).toBe('2026-06-30');
  });
});
