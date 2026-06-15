/**
 * ============================================================================
 * ARCHIVED — DEAD CODE — DO NOT IMPORT (Stabilization TD-1, 2026-06-15)
 * ============================================================================
 *
 * This file is the ORIGINAL Sprint 5.5 coverage engine and is SUPERSEDED.
 * It was orphaned (zero imports anywhere in src/) at the time it was moved
 * here, and is kept only for historical reference. It contains the
 * WRONG-MATH version of coverage calculation:
 *
 *  - daysCovered = Math.floor(...)            (engine uses Math.round)
 *  - coverage_start = payment_date, always    (no early-payment / prepaid
 *                                               day preservation on renewal)
 *  - writes columns `date` / `method`         (real schema uses
 *                                               `payment_date` / `payment_method`)
 *  - status mapping `daysCovered > 7 => 'PAID'` (different thresholds than
 *                                               the authoritative classifier)
 *
 * The authoritative coverage engine is:
 *   rentCycleCalculator.js -> paymentProcessor.js -> statusClassifier.js
 *   -> coverageDatabaseService.js (the only service allowed to touch
 *      Supabase for coverage)
 *
 * Re-introducing this file reintroduces the exact prepaid-day-loss and
 * off-by-one-day bugs Phase 1/2 fixed, plus a second contradictory status
 * definition (TD-1, TD-9). Do not import. Do not resurrect.
 * ============================================================================
 */

/**
 * Coverage Service - Sprint 5.5 Flexible Rent Cycle Engine
 * Handles calculation of coverage periods for flexible billing
 */

import { supabase, isConfigured } from '../../lib/supabase';

/**
 * Calculate coverage period from payment
 * @param {number} roomRent - Monthly rent amount
 * @param {number} paymentAmount - Payment amount
 * @param {string} paymentDate - Payment date (ISO format)
 * @returns {object} Coverage calculation result
 */
export function calculateCoverage(roomRent, paymentAmount, paymentDate) {
  // Calculate daily rate (monthly rent / 30)
  const dailyRate = Math.round((roomRent / 30) * 100) / 100;
  
  // Calculate days covered (floor of payment / daily rate)
  const daysCovered = Math.floor(paymentAmount / dailyRate);
  
  // Coverage starts on payment date
  const coverageStart = new Date(paymentDate);
  
  // Coverage ends after daysCovered days (inclusive, so subtract 1 day)
  const coverageEnd = new Date(paymentDate);
  coverageEnd.setDate(coverageEnd.getDate() + daysCovered - 1);
  
  return {
    dailyRate,
    daysCovered,
    coverageStart: coverageStart.toISOString().split('T')[0],
    coverageEnd: coverageEnd.toISOString().split('T')[0]
  };
}

/**
 * Get student status based on coverage end date
 * @param {string} coverageEnd - Coverage end date (ISO format)
 * @returns {string} Status: PAID, EXPIRING_SOON, DUE_TODAY, OVERDUE, or VACANT
 */
export function getStudentStatus(coverageEnd) {
  if (!coverageEnd) return 'VACANT';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(coverageEnd);
  endDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 7) return 'PAID';
  if (daysDiff >= 1 && daysDiff <= 7) return 'EXPIRING_SOON';
  if (daysDiff === 0) return 'DUE_TODAY';
  return 'OVERDUE';
}

/**
 * Get days status label
 * @param {string} coverageEnd - Coverage end date (ISO format)
 * @returns {object} {daysCount, statusLabel}
 */
export function getDaysStatus(coverageEnd) {
  if (!coverageEnd) return { daysCount: null, statusLabel: null };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(coverageEnd);
  endDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysDiff >= 0) {
    return {
      daysCount: daysDiff,
      statusLabel: `${daysDiff} days remaining`
    };
  } else {
    const daysOverdue = Math.abs(daysDiff);
    return {
      daysCount: daysOverdue,
      statusLabel: `${daysOverdue} days overdue`
    };
  }
}

/**
 * Record payment with coverage calculation
 * @param {object} params - Payment parameters
 * @returns {Promise<{data, error}>}
 */
export async function recordPaymentWithCoverage({ 
  studentId, 
  roomRent, 
  amount, 
  paymentDate, 
  paymentMethod, 
  receiptNumber, 
  notes, 
  recordedBy 
}) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  // Calculate coverage
  const coverage = calculateCoverage(roomRent, amount, paymentDate);
  
  // Insert payment with coverage data
  const { data: paymentData, error: paymentError } = await supabase
    .from('payments')
    .insert({
      student_id: studentId,
      amount,
      date: paymentDate,
      method: paymentMethod,
      receipt_number: receiptNumber,
      notes,
      recorded_by: recordedBy,
      coverage_start_date: coverage.coverageStart,
      coverage_end_date: coverage.coverageEnd,
      days_covered: coverage.daysCovered
    })
    .select()
    .single();
  
  if (paymentError) return { data: null, error: paymentError };
  
  // Update student coverage
  const { error: studentError } = await supabase
    .from('students')
    .update({
      coverage_start: coverage.coverageStart,
      coverage_end: coverage.coverageEnd,
      daily_rate: coverage.dailyRate
    })
    .eq('id', studentId);
  
  if (studentError) {
    console.error('Error updating student coverage:', studentError);
  }
  
  return { data: paymentData, error: null };
}

/**
 * Get student coverage status
 * @param {string} studentId - Student ID
 * @returns {Promise<{data, error}>}
 */
export async function getStudentCoverageStatus(studentId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  const { data, error } = await supabase
    .from('students')
    .select('id, name, coverage_start, coverage_end, daily_rate, rooms(rent)')
    .eq('id', studentId)
    .single();
  
  if (error) return { data: null, error };
  
  const status = getStudentStatus(data.coverage_end);
  const daysStatus = getDaysStatus(data.coverage_end);
  
  return {
    data: {
      ...data,
      status,
      daysStatus: daysStatus.statusLabel,
      daysCount: daysStatus.daysCount
    },
    error: null
  };
}

/**
 * Get dashboard KPIs based on coverage
 * @returns {Promise<{data, error}>}
 */
export async function getDashboardKPIs() {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  const { data, error } = await supabase
    .rpc('get_dashboard_kpis');
  
  return { data: data?.[0] || null, error };
}

/**
 * Get all students with coverage status
 * @returns {Promise<{data, error}>}
 */
export async function getAllStudentsCoverageStatus() {
  if (!isConfigured) return { data: [], error: null };
  
  const { data, error } = await supabase
    .from('student_coverage_status')
    .select('*')
    .order('coverage_end', { ascending: true, nullsFirst: false });
  
  return { data: data || [], error };
}

/**
 * Calculate outstanding balance from coverage
 * @param {string} coverageEnd - Coverage end date
 * @param {number} dailyRate - Daily rate
 * @returns {number} Outstanding amount
 */
export function calculateOutstanding(coverageEnd, dailyRate) {
  if (!coverageEnd || !dailyRate) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(coverageEnd);
  endDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysDiff >= 0) return 0; // Not overdue
  
  const daysOverdue = Math.abs(daysDiff);
  return Math.round(daysOverdue * dailyRate * 100) / 100;
}

/**
 * Format coverage period for display
 * @param {string} coverageStart - Coverage start date
 * @param {string} coverageEnd - Coverage end date
 * @returns {string} Formatted period (e.g., "19 Jun → 18 Jul")
 */
export function formatCoveragePeriod(coverageStart, coverageEnd) {
  if (!coverageStart || !coverageEnd) return '—';
  
  const startDate = new Date(coverageStart);
  const endDate = new Date(coverageEnd);
  
  const startFormatted = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endFormatted = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  
  return `${startFormatted} → ${endFormatted}`;
}
