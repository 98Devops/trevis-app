/**
 * Dashboard Attention — TD-2 (Stabilization)
 *
 * Pure transformation that turns the raw `getAllStudentsCoverage()` result into the
 * "Attention Required" list shown on the Dashboard. It exists so the Dashboard's
 * status regions (the Attention table, the per-row badges, and the per-property
 * Alerts count) are derived from the SAME coverage engine that powers the KPI strip
 * — eliminating the old "two clocks" problem where the KPI strip said one thing
 * (coverage) and the Attention table said another (legacy month-based buildProps).
 *
 * No database access, no side effects — just classification + shaping, so it can be
 * unit-tested directly.
 *
 * @module dashboardAttention
 */

import { classifyStudent } from './statusClassifier.js';

// A student needs operator attention when their COVERAGE has expired, expires today,
// or expires within the next 7 days. This is the same vocabulary the KPI strip uses
// (CURRENT students are fine; EXCLUDED students are not ACTIVE and never appear).
export const ATTENTION_STATUSES = ['OVERDUE', 'DUE_TODAY', 'EXPIRING_SOON'];

/**
 * Build the Attention Required list from coverage records.
 *
 * @param {Array<object>} coverageStudents - result of getAllStudentsCoverage():
 *   each has { id, full_name, status, coverage_end, daily_rate, rooms: { rent_per_bed,
 *   room_number, properties: { name } } }
 * @returns {Array<{
 *   id: string, name: string, property: string, room: string, roomRent: number,
 *   coverageStatus: string, daysLabel: string, outstanding: number, source: 'coverage'
 * }>} attention rows (CURRENT/EXCLUDED students filtered out)
 */
export function buildAttentionList(coverageStudents) {
  if (!Array.isArray(coverageStudents)) return [];

  return coverageStudents
    .map((s) => {
      const c = classifyStudent(s);
      if (c.excludeFromMetrics || !ATTENTION_STATUSES.includes(c.status)) return null;

      const rent = Number(s.rooms?.rent_per_bed) || 0;
      // Coverage outstanding = days overdue × daily rate (NOT month cash owed).
      const outstanding = c.daysOverdue
        ? Math.round(c.daysOverdue * (Number(s.daily_rate) || 0) * 100) / 100
        : 0;

      return {
        id: s.id,
        name: s.full_name,
        property: s.rooms?.properties?.name || '—',
        room: s.rooms?.room_number || '—',
        roomRent: rent,
        coverageStatus: c.status,
        daysLabel: c.displayLabel,
        outstanding,
        source: 'coverage',
      };
    })
    .filter(Boolean);
}

/**
 * Count attention rows per property name (for the property-card "Alerts" badge).
 *
 * @param {Array<object>} attentionRows - output of buildAttentionList
 * @returns {Record<string, number>} property name → attention count
 */
export function countAttentionByProperty(attentionRows) {
  const map = {};
  for (const s of attentionRows) {
    map[s.property] = (map[s.property] || 0) + 1;
  }
  return map;
}
