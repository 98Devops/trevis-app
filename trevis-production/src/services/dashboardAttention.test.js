/**
 * TD-2: Dashboard Unification — Attention list is coverage-derived
 *
 * BUSINESS RISK REMOVED:
 *   The Dashboard had TWO clocks. The KPI strip read the coverage engine
 *   (classifyPortfolio), but the "Attention Required" table, the per-row badges,
 *   and the per-property "Alerts" count read the LEGACY month-based status from
 *   buildProps (paid >= rent ? PAID : paid > 0 ? PARTIAL : OVERDUE). A student who
 *   prepaid 90 days but paid $0 THIS calendar month showed "Current" in the KPI
 *   strip yet appeared as OVERDUE in the Attention table with a full month's
 *   "balance" — two contradictory definitions of overdue on one screen.
 *
 *   buildAttentionList is the single, coverage-engine-driven source for that table.
 *   These tests pin the classification, exclusion, and outstanding-amount math so the
 *   Attention list can never silently diverge from the KPI strip again.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildAttentionList, countAttentionByProperty, ATTENTION_STATUSES } from './dashboardAttention.js';

// classifyStudent compares coverage_end against "today", so we pin the clock.
const TODAY = new Date('2026-06-15T12:00:00Z');

function student(overrides) {
  return {
    id: 'stu',
    full_name: 'Test Student',
    status: 'ACTIVE',
    coverage_end: null,
    daily_rate: 5,
    rooms: { rent_per_bed: 150, room_number: 'Room 1', properties: { name: 'King Fisher' } },
    ...overrides,
  };
}

// coverage_end N days from today (negative = expired)
function endInDays(n) {
  const d = new Date(TODAY);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

describe('dashboardAttention.buildAttentionList', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(TODAY); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns [] for non-array input (loading / fetch-failed)', () => {
    expect(buildAttentionList(null)).toEqual([]);
    expect(buildAttentionList(undefined)).toEqual([]);
  });

  it('INCLUDES overdue, due-today, and expiring-soon students', () => {
    const list = buildAttentionList([
      student({ id: 'overdue', coverage_end: endInDays(-3) }),
      student({ id: 'today', coverage_end: endInDays(0) }),
      student({ id: 'soon', coverage_end: endInDays(5) }),
    ]);
    expect(list.map(s => s.id).sort()).toEqual(['overdue', 'soon', 'today']);
    const byId = Object.fromEntries(list.map(s => [s.id, s.coverageStatus]));
    expect(byId.overdue).toBe('OVERDUE');
    expect(byId.today).toBe('DUE_TODAY');
    expect(byId.soon).toBe('EXPIRING_SOON');
  });

  it('EXCLUDES CURRENT students (the prepaid case that caused the two-clocks bug)', () => {
    // Prepaid 90 days: classifier says CURRENT, so they must NOT be in Attention,
    // even though month-based buildProps would have flagged them OVERDUE for $0 this month.
    const list = buildAttentionList([student({ id: 'prepaid', coverage_end: endInDays(85) })]);
    expect(list).toEqual([]);
  });

  it('EXCLUDES non-ACTIVE students (CHECKED_OUT / VACATED never need attention)', () => {
    const list = buildAttentionList([
      student({ id: 'checked-out', status: 'CHECKED_OUT', coverage_end: endInDays(-10) }),
    ]);
    expect(list).toEqual([]);
  });

  it('computes outstanding = daysOverdue × daily_rate (coverage, not month cash)', () => {
    const list = buildAttentionList([
      student({ id: 'o', coverage_end: endInDays(-4), daily_rate: 5 }),
    ]);
    expect(list[0].outstanding).toBe(20); // 4 days × $5
  });

  it('outstanding is 0 for expiring-soon (not yet overdue)', () => {
    const list = buildAttentionList([student({ id: 's', coverage_end: endInDays(3) })]);
    expect(list[0].outstanding).toBe(0);
  });

  it('treats missing coverage_end on an ACTIVE student as OVERDUE with 0 outstanding', () => {
    const list = buildAttentionList([student({ id: 'new', coverage_end: null })]);
    expect(list).toHaveLength(1);
    expect(list[0].coverageStatus).toBe('OVERDUE');
    expect(list[0].outstanding).toBe(0); // no daysOverdue without a coverage_end
  });

  it('maps room / property / rent fields for display', () => {
    const list = buildAttentionList([student({ coverage_end: endInDays(-1) })]);
    expect(list[0]).toMatchObject({
      name: 'Test Student',
      property: 'King Fisher',
      room: 'Room 1',
      roomRent: 150,
      source: 'coverage',
    });
  });
});

describe('dashboardAttention.countAttentionByProperty', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(TODAY); });
  afterEach(() => { vi.useRealTimers(); });

  it('counts attention rows per property name', () => {
    const list = buildAttentionList([
      student({ id: 'a', coverage_end: endInDays(-1), rooms: { rent_per_bed: 150, room_number: 'R1', properties: { name: 'King Fisher' } } }),
      student({ id: 'b', coverage_end: endInDays(2),  rooms: { rent_per_bed: 150, room_number: 'R2', properties: { name: 'King Fisher' } } }),
      student({ id: 'c', coverage_end: endInDays(-5), rooms: { rent_per_bed: 120, room_number: 'R3', properties: { name: 'The Chase' } } }),
      student({ id: 'd', coverage_end: endInDays(40), rooms: { rent_per_bed: 120, room_number: 'R4', properties: { name: 'The Chase' } } }), // CURRENT, excluded
    ]);
    expect(countAttentionByProperty(list)).toEqual({ 'King Fisher': 2, 'The Chase': 1 });
  });

  it('ATTENTION_STATUSES is the agreed vocabulary (guards against drift)', () => {
    expect(ATTENTION_STATUSES).toEqual(['OVERDUE', 'DUE_TODAY', 'EXPIRING_SOON']);
  });
});
