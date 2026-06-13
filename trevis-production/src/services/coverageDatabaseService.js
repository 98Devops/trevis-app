/**
 * Coverage Database Service - Sprint 5.5 Phase 3
 * 
 * This is the ONLY service that talks to Supabase for coverage operations.
 * All other services are pure functions.
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

/**
 * Record payment and update student coverage
 * 
 * This function:
 * 1. Fetches current student state
 * 2. Calculates coverage using paymentProcessor (handles early payments)
 * 3. Inserts payment record with coverage data
 * 4. Updates student coverage fields
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
 * @returns {Promise<{payment: object, result: object}>} Payment record and coverage calculation
 * 
 * @throws {Error} If student not found
 * @throws {Error} If room rent not found
 * @throws {Error} If payment insert fails
 * @throws {Error} If student update fails
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
  // 1. Fetch student current state
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('coverage_end, status, rooms(rent_per_bed)')
    .eq('id', studentId)
    .single();

  if (sErr || !student) {
    throw new Error('Student not found');
  }

  const monthlyRent = student.rooms?.rent_per_bed;
  if (!monthlyRent) {
    throw new Error('Room rent not found');
  }

  // 2. Calculate coverage using paymentProcessor
  // This handles early payment detection and prepaid day preservation
  const paymentInput = {
    amount: parseFloat(amount),
    payment_date: paymentDate
  };

  const studentState = {
    coverage_end: student.coverage_end,
    monthly_rent: monthlyRent,
    status: student.status
  };

  const result = processPayment(paymentInput, studentState);

  // 3. Insert payment record
  const { data: payment, error: pErr } = await supabase
    .from('payments')
    .insert({
      student_id: studentId,
      amount: parseFloat(amount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      receipt_number: receiptNumber || null,
      month_year: paymentDate.substring(0, 7), // Extract YYYY-MM
      notes: notes || null,
      recorded_by: recordedBy,
      coverage_start_date: result.coverageStart,
      coverage_end_date: result.coverageEnd,
      days_covered: result.coverageDays
    })
    .select()
    .single();

  if (pErr) {
    throw new Error(`Payment insert failed: ${pErr.message}`);
  }

  // 4. Update student coverage
  const { error: uErr } = await supabase
    .from('students')
    .update({
      coverage_start: result.coverageStart,
      coverage_end: result.coverageEnd,
      daily_rate: result.dailyRate,
      next_due_date: result.nextDueDate
    })
    .eq('id', studentId);

  if (uErr) {
    throw new Error(`Student update failed: ${uErr.message}`);
  }

  return { payment, result };
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
