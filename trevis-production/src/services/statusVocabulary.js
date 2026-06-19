/**
 * Status Vocabulary — the single source of truth for TREVIS status strings (TD-10).
 *
 * There are TWO separate vocabularies that were previously scattered as magic
 * strings and easily confused. This module names them once, with docs, so a
 * future engineer doesn't invent bugs guessing which set a value belongs to.
 *
 * 1) LIFECYCLE STATUS — the persisted `students.status` column. Describes the
 *    tenancy, NOT payment/coverage. Only ACTIVE students are counted in metrics.
 *
 * 2) COVERAGE STATUS — computed by classifyStudent() from coverage_end. Describes
 *    where an ACTIVE student sits in their paid-through window. Never stored.
 *
 * @module statusVocabulary
 */

/** Persisted tenancy status (`students.status`). */
export const LIFECYCLE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',         // live tenant — the only status included in coverage metrics
  VACATED: 'VACATED',       // checked out / removed (history kept)
  VACANT: 'VACANT',         // synthetic placeholder for an empty bed (not a real row)
  CHECKED_OUT: 'CHECKED_OUT', // legacy synonym for VACATED in some docs/data
});

/** Lifecycle statuses excluded from operational coverage metrics. */
export const NON_ACTIVE_STATUSES = Object.freeze([
  LIFECYCLE_STATUS.VACATED,
  LIFECYCLE_STATUS.VACANT,
  LIFECYCLE_STATUS.CHECKED_OUT,
]);

/** Computed coverage status (from classifyStudent). */
export const COVERAGE_STATUS = Object.freeze({
  CURRENT: 'CURRENT',             // > EXPIRING_THRESHOLD_DAYS remaining
  EXPIRING_SOON: 'EXPIRING_SOON', // 1..EXPIRING_THRESHOLD_DAYS remaining
  DUE_TODAY: 'DUE_TODAY',         // coverage_end is today
  OVERDUE: 'OVERDUE',             // coverage_end is in the past (or no coverage)
  EXCLUDED: 'EXCLUDED',           // non-ACTIVE student — not in metrics
});

/** Coverage statuses that need owner attention (Dashboard "Attention", reminders). */
export const ATTENTION_COVERAGE_STATUSES = Object.freeze([
  COVERAGE_STATUS.OVERDUE,
  COVERAGE_STATUS.DUE_TODAY,
  COVERAGE_STATUS.EXPIRING_SOON,
]);

/** Coverage statuses considered "covered" for room coverage-rate math. */
export const COVERED_STATUSES = Object.freeze([
  COVERAGE_STATUS.CURRENT,
  COVERAGE_STATUS.EXPIRING_SOON,
  COVERAGE_STATUS.DUE_TODAY,
]);

/** Days-remaining boundary between EXPIRING_SOON and CURRENT. */
export const EXPIRING_THRESHOLD_DAYS = 7;

/** Coverage status filter chips for the Finances page. */
export const FINANCE_STATUS_FILTERS = Object.freeze([
  'ALL',
  COVERAGE_STATUS.CURRENT,
  COVERAGE_STATUS.EXPIRING_SOON,
  COVERAGE_STATUS.DUE_TODAY,
  COVERAGE_STATUS.OVERDUE,
]);
