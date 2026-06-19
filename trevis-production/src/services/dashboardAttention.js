/**
 * Coverage Views — TD-2 & TD-3 (Stabilization)
 *
 * Pure transformations that turn the raw `getAllStudentsCoverage()` result into the
 * row shapes used by the coverage-driven UI views:
 *   - Dashboard "Attention Required" table  → buildAttentionList   (TD-2)
 *   - Finances / Arrears page               → buildFinanceRecords  (TD-3)
 *
 * Both share ONE per-student mapper (toCoverageRow) and ONE outstanding formula
 * (coverageOutstanding = days_overdue × daily_rate), so the Dashboard, the Finances
 * page, and the KPI strip can never disagree about a student's status or the money
 * they owe (Rules 1 & 3 — coverage engine is the single source of truth, no
 * duplicate status systems). No database access, no side effects — unit-testable.
 *
 * (Filename kept as dashboardAttention.js to avoid import churn; scope is now both
 * coverage views.)
 *
 * @module dashboardAttention
 */

import { classifyStudent } from './statusClassifier.js';
import { ATTENTION_COVERAGE_STATUSES, FINANCE_STATUS_FILTERS as VOCAB_FINANCE_FILTERS } from './statusVocabulary.js';

// A student needs operator attention when their COVERAGE has expired, expires today,
// or expires within the next 7 days. Sourced from the single status vocabulary (TD-10).
export const ATTENTION_STATUSES = ATTENTION_COVERAGE_STATUSES;

/**
 * Coverage outstanding = days overdue × daily rate (NOT month cash owed).
 * SINGLE definition of "outstanding" reused by every coverage view (Dashboard
 * Attention, Finances) and parity-checked against getDashboardKPIs's
 * total_overdue_amount. Do not re-derive this anywhere else (Rule 1).
 *
 * @param {object} classification - result of classifyStudent(student)
 * @param {number|string|null} dailyRate - student.daily_rate
 * @returns {number} outstanding amount, rounded to cents (0 if not overdue)
 */
export function coverageOutstanding(classification, dailyRate) {
  if (!classification.daysOverdue) return 0;
  return Math.round(classification.daysOverdue * (Number(dailyRate) || 0) * 100) / 100;
}

/**
 * Map ONE coverage record into the shared UI row shape used by both the Dashboard
 * Attention table and the Finances page. Pure; classification is supplied so callers
 * can reuse it. Returns null for non-ACTIVE (EXCLUDED) students.
 *
 * @param {object} s - a getAllStudentsCoverage() record
 * @param {object} c - classifyStudent(s)
 */
function toCoverageRow(s, c) {
  if (c.excludeFromMetrics) return null;
  return {
    id: s.id,
    name: s.full_name,
    property: s.rooms?.properties?.name || '—',
    propertyColor: s.rooms?.properties?.color_accent || null,
    room: s.rooms?.room_number || '—',
    roomRent: Number(s.rooms?.rent_per_bed) || 0,
    dailyRate: Number(s.daily_rate) || 0,
    coverageEnd: s.coverage_end || null,
    coverageStatus: c.status,
    daysLabel: c.displayLabel,
    daysRemaining: c.daysRemaining,
    daysOverdue: c.daysOverdue,
    outstanding: coverageOutstanding(c, s.daily_rate),
    source: 'coverage',
  };
}

/**
 * Build the Attention Required list from coverage records.
 *
 * @param {Array<object>} coverageStudents - result of getAllStudentsCoverage()
 * @returns {Array<object>} attention rows (CURRENT/EXCLUDED students filtered out)
 */
export function buildAttentionList(coverageStudents) {
  if (!Array.isArray(coverageStudents)) return [];

  return coverageStudents
    .map((s) => {
      const c = classifyStudent(s);
      if (!ATTENTION_STATUSES.includes(c.status)) return null;
      return toCoverageRow(s, c);
    })
    .filter(Boolean);
}

/**
 * Build the full Finances record list from coverage records (TD-3).
 *
 * Unlike the Attention list, this returns EVERY ACTIVE student (including CURRENT)
 * so the Finances page can filter by coverage status itself. Status, outstanding,
 * and days all come from the SAME coverage engine the Dashboard uses — there is no
 * longer a separate month-based "balance = rent − paid" definition on this page.
 *
 * @param {Array<object>} coverageStudents - result of getAllStudentsCoverage()
 * @returns {Array<object>} one coverage row per ACTIVE student
 */
export function buildFinanceRecords(coverageStudents) {
  if (!Array.isArray(coverageStudents)) return [];
  return coverageStudents
    .map((s) => toCoverageRow(s, classifyStudent(s)))
    .filter(Boolean);
}

/** Coverage status filter chips for the Finances page (TD-3). */
export const FINANCE_STATUS_FILTERS = VOCAB_FINANCE_FILTERS;

/**
 * Filter finance records by coverage status. 'ALL' returns everything.
 * @param {Array<object>} records - output of buildFinanceRecords
 * @param {string} status - one of FINANCE_STATUS_FILTERS
 */
export function filterFinanceRecords(records, status) {
  if (!status || status === 'ALL') return records;
  return records.filter((r) => r.coverageStatus === status);
}

/**
 * Sort finance records by coverage_end ascending (soonest-to-expire first) — the
 * operationally useful order for collections. Null coverage_end (no payment) sorts
 * first as the most urgent. Stable for equal dates.
 * @param {Array<object>} records
 */
export function sortByCoverageEnd(records) {
  return [...records].sort((a, b) => {
    if (a.coverageEnd === b.coverageEnd) return 0;
    if (!a.coverageEnd) return -1;
    if (!b.coverageEnd) return 1;
    return a.coverageEnd < b.coverageEnd ? -1 : 1;
  });
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
