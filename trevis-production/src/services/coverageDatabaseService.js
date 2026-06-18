/**
 * Coverage Database Service - Sprint 5.5 Phase 3
 *
 * This is the ONLY service that talks to Supabase for coverage operations.
 * All other services are pure functions.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ DERIVED-CACHE CONTRACT (Phase 4C-A #4 — read before editing coverage code) │
 * │                                                                            │
 * │ TRUTH lives in: payments.{amount, payment_date} + rooms.rent_per_bed +     │
 * │   students.{room_id, status}.                                              │
 * │                                                                            │
 * │ students.{coverage_start, coverage_end, daily_rate, next_due_date} are     │
 * │   DERIVED CACHE — a pure function of the ledger via rebuildStudentCoverage()│
 * │   (the SOLE writer). Never hand-author these fields anywhere else.         │
 * │                                                                            │
 * │ Therefore EVERY mutation of a truth input MUST trigger a rebuild:          │
 * │   payment create/update/delete, room rent edit, transfer, room/status      │
 * │   change, vacate. See COVERAGE_MUTATION_MATRIX.md (all paths CLOSED).      │
 * │                                                                            │
 * │ Backstops: DB CHECK coverage_start <= coverage_end (R3); nightly drift     │
 * │   monitor (replay_portfolio_coverage.mjs --report); R2 as auditor.         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * RESPONSIBILITIES:
 * - Record payments with coverage calculation
 * - Fetch dashboard KPIs with status classification
 * - Retrieve student coverage data
 * - Calculate overdue amounts
 *
 * @module coverageDatabaseService
 */

import { supabase } from '../lib/supabase.js';
import { processPayment } from './paymentProcessor.js';
import { classifyPortfolio } from './statusClassifier.js';
import { toLocalISO } from './dateUtil.js';

/**
 * Record payment and update student coverage
 * 
 * This function:
 * 1. Inserts payment record
 * 2. Rebuilds student coverage from ALL payments (ensures consistency)
 * 
 * @param {object} params - Payment recording parameters
 * @param {string} params.studentId - Student ID
 * @param {number} params.amount - Payment amount
 * @param {string} params.paymentDate - Payment date (YYYY-MM-DD)
 * @param {string} params.paymentMethod - Payment method
 * @param {string} [params.receiptNumber] - Receipt number (optional)
 * @param {string} [params.notes] - Payment notes (optional)
 * @param {string} params.recordedBy - User ID who recorded payment
 * 
 * @returns {Promise<{payment: object, coverage: object}>} Payment record and final coverage state
 * 
 * @throws {Error} If student not found
 * @throws {Error} If payment insert fails
 */
export async function recordPaymentWithCoverage({
  studentId,
  amount,
  paymentDate,
  paymentMethod,
  receiptNumber,
  notes,
  recordedBy
}) {
  // TD-6: Duplicate-submit protection (defense-in-depth alongside the UI in-flight guard).
  // If an identical payment (same student, amount, date) was recorded in the last few
  // seconds, treat this as an accidental double-submit and return the existing row instead
  // of inserting a second one. Without this, a double click would create two payment rows
  // and the deterministic coverage rebuild would faithfully (and wrongly) sum both.
  const amountNum = parseFloat(amount);
  const dupWindowIso = new Date(Date.now() - 10000).toISOString(); // 10s window
  const { data: recentDup } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', studentId)
    .eq('amount', amountNum)
    .eq('payment_date', paymentDate)
    .gte('created_at', dupWindowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  if (recentDup && recentDup.length > 0) {
    console.warn('[TD-6] Duplicate payment suppressed (identical student/amount/date within 10s).');
    // Coverage already reflects the first insert; return it without re-inserting.
    return { payment: recentDup[0], coverage: null, rebuildError: null, duplicateSuppressed: true };
  }

  // 1. Insert payment record (without coverage calculation yet)
  const { data: payment, error: pErr } = await supabase
    .from('payments')
    .insert({
      student_id: studentId,
      amount: amountNum,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      receipt_number: receiptNumber || null,
      month_year: paymentDate.substring(0, 7), // Extract YYYY-MM
      notes: notes || null,
      recorded_by: recordedBy
      // coverage fields will be set by rebuildStudentCoverage
    })
    .select()
    .single();

  if (pErr) {
    throw new Error(`Payment insert failed: ${pErr.message}`);
  }

  // 2. Rebuild coverage from ALL payments (ensures consistency)
  // TD-5: The payment row already exists at this point. If the rebuild fails we must
  // NOT throw it away or bubble a raw exception that hides the fact the payment was
  // recorded. We surface `rebuildError` so the caller can warn the user that coverage
  // may be stale (and offer a repair) instead of reporting a clean success.
  let coverage = null;
  let rebuildError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      coverage = await rebuildStudentCoverage(studentId);
      rebuildError = null;
      break;
    } catch (err) {
      rebuildError = err;
      console.error(`[TD-5] Coverage rebuild failed after payment create (attempt ${attempt}/2):`, err);
    }
  }

  return { payment, coverage, rebuildError };
}

/**
 * Get dashboard KPIs with status classification
 * 
 * Returns portfolio metrics for dashboard display:
 * - Total active students
 * - Current students (>7 days coverage)
 * - Expiring soon (1-7 days coverage)
 * - Overdue students
 * - Total overdue amount calculated from daily_rate × days_overdue
 * 
 * @returns {Promise<{
 *   total_students: number,
 *   current_students: number,
 *   expiring_soon: number,
 *   overdue_students: number,
 *   total_overdue_amount: number
 * }|null>} Dashboard KPIs or null on error
 */
export async function getDashboardKPIs() {
  const { data, error } = await supabase
    .from('students')
    .select('id, status, coverage_end, coverage_start, daily_rate')
    .neq('status', 'VACATED');

  if (error || !data) {
    return null;
  }

  // Use statusClassifier to get portfolio metrics
  const portfolio = classifyPortfolio(data);

  // Calculate total overdue amount
  const totalOverdueAmount = data
    .filter(s => s.status === 'ACTIVE' && s.coverage_end)
    .reduce((sum, s) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const end = new Date(s.coverage_end);
      end.setHours(0, 0, 0, 0);
      
      const daysOverdue = Math.ceil((today - end) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue > 0 && s.daily_rate) {
        return sum + (daysOverdue * s.daily_rate);
      }
      
      return sum;
    }, 0);

  return {
    total_students: portfolio.total,
    current_students: portfolio.current,
    expiring_soon: portfolio.expiringSoon,
    overdue_students: portfolio.overdue,
    total_overdue_amount: Math.round(totalOverdueAmount * 100) / 100
  };
}

/**
 * Get single student coverage data
 * 
 * @param {string} studentId - Student ID
 * @returns {Promise<object|null>} Student coverage data or null if not found
 */
export async function getStudentCoverageData(studentId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, status, coverage_start, coverage_end, daily_rate, next_due_date, rooms(rent_per_bed)')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get all students with coverage data
 * 
 * Excludes VACATED students but includes all others (ACTIVE, CHECKED_OUT, etc.)
 * for comprehensive portfolio view
 * 
 * @returns {Promise<Array<object>>} Array of students with coverage data
 */
export async function getAllStudentsCoverage() {
  const { data, error } = await supabase
    .from('students')
    .select(`
      id, 
      full_name, 
      status, 
      coverage_start, 
      coverage_end, 
      daily_rate, 
      next_due_date, 
      rooms(
        rent_per_bed, 
        room_number, 
        properties(name, color_accent)
      )
    `)
    .neq('status', 'VACATED');

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Rebuild student coverage from payment history (Phase 4B.3)
 * 
 * This function ensures coverage fields are ALWAYS derived from payment history.
 * Called after DELETE, UPDATE, or CREATE payment operations.
 * 
 * Algorithm:
 * 1. Load ALL payments for student ordered by payment_date ASC
 * 2. Reset coverage state
 * 3. Replay every payment through processPayment()
 * 4. Calculate final coverage state
 * 5. Update student coverage fields atomically
 * 
 * @param {string} studentId - Student ID to rebuild coverage for
 * @returns {Promise<{coverage_start: string|null, coverage_end: string|null, daily_rate: number|null, next_due_date: string|null}>}
 * @throws {Error} If student not found
 * @throws {Error} If student update fails
 */
export async function rebuildStudentCoverage(studentId) {
  // 1. Fetch student and room rent
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, status, rooms(rent_per_bed)')
    .eq('id', studentId)
    .single();

  if (sErr || !student) {
    throw new Error('Student not found');
  }

  const monthlyRent = student.rooms?.rent_per_bed;
  if (!monthlyRent) {
    throw new Error('Room rent not found');
  }

  // 2. Load ALL payments ordered by payment_date ASC
  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('id, amount, payment_date')
    .eq('student_id', studentId)
    .order('payment_date', { ascending: true });

  if (pErr) {
    throw new Error(`Failed to load payments: ${pErr.message}`);
  }

  // 3. If no payments, reset coverage to NULL
  if (!payments || payments.length === 0) {
    const { error: uErr } = await supabase
      .from('students')
      .update({
        coverage_start: null,
        coverage_end: null,
        daily_rate: null,
        next_due_date: null
      })
      .eq('id', studentId);

    if (uErr) {
      throw new Error(`Student update failed: ${uErr.message}`);
    }

    return {
      coverage_start: null,
      coverage_end: null,
      daily_rate: null,
      next_due_date: null
    };
  }

  // 4. Replay all payments through processPayment()
  let currentCoverageEnd = null;
  let finalResult = null;
  // BUGFIX: the student's coverage_start is the start of the CURRENT CONTINUOUS
  // coverage chain, NOT the last payment's slice start (that produced the
  // start==end corruption on long-term tenants) and NOT the first payment ever.
  //
  // A payment that lands WITHIN existing coverage is an "early/stacked" payment
  // (isEarlyPayment=true) and continues the chain. A payment that lands AFTER
  // coverage has already lapsed comes back as a NORMAL payment — that marks a
  // GAP, so a new continuous chain begins there. We therefore (re)set the chain
  // start on every non-early payment.
  let chainCoverageStart = null;

  for (const payment of payments) {
    const paymentInput = {
      amount: parseFloat(payment.amount),
      payment_date: payment.payment_date
    };

    const studentState = {
      coverage_end: currentCoverageEnd,
      monthly_rent: monthlyRent,
      status: student.status
    };

    finalResult = processPayment(paymentInput, studentState);
    // New chain starts on the first payment OR after any coverage gap.
    if (chainCoverageStart === null || !finalResult.isEarlyPayment) {
      chainCoverageStart = finalResult.coverageStart;
    }
    currentCoverageEnd = finalResult.coverageEnd;

    // Update payment record with recalculated coverage metadata.
    // toLocalISO: store the engine's LOCAL calendar day. Passing raw Date objects
    // lets the client serialize them as UTC, shifting dates by a day in non-UTC
    // zones (the 2026-06-18 timezone bug).
    await supabase
      .from('payments')
      .update({
        coverage_start_date: toLocalISO(finalResult.coverageStart),
        coverage_end_date: toLocalISO(finalResult.coverageEnd),
        days_covered: finalResult.coverageDays
      })
      .eq('id', payment.id);
  }

  // 5. Update student coverage fields with final state.
  //    coverage_start = first slice's start (whole chain); coverage_end = final.
  //    All dates serialized via toLocalISO (timezone-safe — see above).
  const { error: uErr } = await supabase
    .from('students')
    .update({
      coverage_start: toLocalISO(chainCoverageStart),
      coverage_end: toLocalISO(finalResult.coverageEnd),
      daily_rate: finalResult.dailyRate,
      next_due_date: toLocalISO(finalResult.nextDueDate)
    })
    .eq('id', studentId);

  if (uErr) {
    throw new Error(`Student update failed: ${uErr.message}`);
  }

  return {
    coverage_start: chainCoverageStart,
    coverage_end: finalResult.coverageEnd,
    daily_rate: finalResult.dailyRate,
    next_due_date: finalResult.nextDueDate
  };
}
