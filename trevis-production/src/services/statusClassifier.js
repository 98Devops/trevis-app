/**
 * Status Classifier Service - Sprint 5.5 Phase 3
 * 
 * CRITICAL BUSINESS RULES:
 * 1. Only ACTIVE students appear in operational metrics
 * 2. CHECKED_OUT students are excluded from status calculations
 * 3. Status derives from coverage_end, NOT calendar months
 * 
 * STATUS DEFINITIONS:
 * - CURRENT: coverage_end > today + 7 days
 * - EXPIRING_SOON: coverage_end between today + 1 and today + 7 days
 * - DUE_TODAY: coverage_end = today
 * - OVERDUE: coverage_end < today
 * - EXCLUDED: status !== 'ACTIVE' (CHECKED_OUT, VACATED, etc.)
 * 
 * @module statusClassifier
 */

import { calculateCoverage } from './rentCycleCalculator.js';
import { LIFECYCLE_STATUS, COVERAGE_STATUS, EXPIRING_THRESHOLD_DAYS } from './statusVocabulary.js';

/**
 * Classify a single student's coverage status
 * 
 * Pure function - no side effects, no database calls
 * 
 * @param {object} student - Student record with coverage data
 * @param {string} student.status - Student status (ACTIVE, CHECKED_OUT, etc.)
 * @param {string|Date|null} student.coverage_end - Coverage end date
 * @returns {{
 *   status: string,
 *   excludeFromMetrics: boolean,
 *   daysRemaining: number|null,
 *   daysOverdue: number|null,
 *   displayLabel: string
 * }} Classification result
 * 
 * @example
 * // Active student with 15 days coverage
 * classifyStudent({ status: 'ACTIVE', coverage_end: '2026-06-30' })
 * // Returns: { status: 'CURRENT', daysRemaining: 15, displayLabel: '15 days remaining' }
 * 
 * @example
 * // Checked out student (excluded from metrics)
 * classifyStudent({ status: 'CHECKED_OUT', coverage_end: '2026-06-30' })
 * // Returns: { status: 'EXCLUDED', excludeFromMetrics: true, displayLabel: '—' }
 */
export function classifyStudent(student) {
  // CRITICAL: Exclude non-ACTIVE students from operational metrics
  if (student.status !== LIFECYCLE_STATUS.ACTIVE) {
    return {
      status: COVERAGE_STATUS.EXCLUDED,
      excludeFromMetrics: true,
      daysRemaining: null,
      daysOverdue: null,
      displayLabel: '—'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Handle missing coverage_end (no payment recorded)
  if (!student.coverage_end) {
    return {
      status: COVERAGE_STATUS.OVERDUE,
      excludeFromMetrics: false,
      daysRemaining: null,
      daysOverdue: null,
      displayLabel: 'No coverage recorded'
    };
  }

  const end = new Date(student.coverage_end);
  end.setHours(0, 0, 0, 0);

  // Calculate difference in days (positive = future, negative = past)
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  // CURRENT: More than EXPIRING_THRESHOLD_DAYS remaining
  if (diff > EXPIRING_THRESHOLD_DAYS) {
    return {
      status: COVERAGE_STATUS.CURRENT,
      excludeFromMetrics: false,
      daysRemaining: diff,
      daysOverdue: 0,
      displayLabel: `${diff} days remaining`
    };
  }

  // EXPIRING_SOON: 1..EXPIRING_THRESHOLD_DAYS remaining
  if (diff >= 1) {
    return {
      status: COVERAGE_STATUS.EXPIRING_SOON,
      excludeFromMetrics: false,
      daysRemaining: diff,
      daysOverdue: 0,
      displayLabel: `${diff} days remaining`
    };
  }

  // DUE_TODAY: Coverage ends today
  if (diff === 0) {
    return {
      status: COVERAGE_STATUS.DUE_TODAY,
      excludeFromMetrics: false,
      daysRemaining: 0,
      daysOverdue: 0,
      displayLabel: 'Due today'
    };
  }

  // OVERDUE: Coverage has expired
  return {
    status: COVERAGE_STATUS.OVERDUE,
    excludeFromMetrics: false,
    daysRemaining: 0,
    daysOverdue: Math.abs(diff),
    displayLabel: `${Math.abs(diff)} days overdue`
  };
}

/**
 * Classify a portfolio of students and aggregate metrics
 * 
 * Pure function - no side effects, no database calls
 * Automatically filters to ACTIVE students only
 * 
 * @param {Array<object>} students - Array of student records
 * @returns {{
 *   total: number,
 *   current: number,
 *   expiringSoon: number,
 *   dueToday: number,
 *   overdue: number,
 *   details: Array<{student: object, classification: object}>
 * }} Portfolio classification
 * 
 * @example
 * const students = [
 *   { id: 1, status: 'ACTIVE', coverage_end: '2026-07-01' },
 *   { id: 2, status: 'ACTIVE', coverage_end: '2026-06-18' },
 *   { id: 3, status: 'CHECKED_OUT', coverage_end: '2026-06-20' }
 * ];
 * const portfolio = classifyPortfolio(students);
 * // Returns: { total: 2, current: 1, expiringSoon: 1, overdue: 0 }
 * // Note: CHECKED_OUT student excluded from total
 */
export function classifyPortfolio(students) {
  // Filter to ACTIVE students only (business rule enforcement)
  const active = students.filter(s => s.status === 'ACTIVE');

  // Classify each active student
  const results = active.map(s => ({ 
    student: s, 
    classification: classifyStudent(s) 
  }));

  return {
    total: active.length,
    current: results.filter(r => r.classification.status === 'CURRENT').length,
    expiringSoon: results.filter(r => r.classification.status === 'EXPIRING_SOON').length,
    dueToday: results.filter(r => r.classification.status === 'DUE_TODAY').length,
    overdue: results.filter(r => ['OVERDUE', 'DUE_TODAY'].includes(r.classification.status)).length,
    details: results
  };
}

/**
 * Get UI badge configuration for a status
 * 
 * Returns color and label for rendering status badges
 * 
 * @param {string} status - Status code (CURRENT, EXPIRING_SOON, etc.)
 * @returns {{
 *   label: string,
 *   color: string,
 *   bg: string
 * }} Badge configuration
 * 
 * @example
 * const badge = getStatusBadgeConfig('CURRENT');
 * // Returns: { label: 'Current', color: '#22C55E', bg: '#22C55E20' }
 */
export function getStatusBadgeConfig(status) {
  return {
    CURRENT:       { label: 'Current',       color: '#22C55E', bg: '#22C55E20' },
    EXPIRING_SOON: { label: 'Expiring Soon', color: '#F59E0B', bg: '#F59E0B20' },
    DUE_TODAY:     { label: 'Due Today',     color: '#F97316', bg: '#F9731620' },
    OVERDUE:       { label: 'Overdue',       color: '#EF4444', bg: '#EF444420' },
    EXCLUDED:      { label: 'Inactive',      color: '#6B7280', bg: '#22222220' },
  }[status] || { label: status, color: '#6B7280', bg: '#22222220' };
}
