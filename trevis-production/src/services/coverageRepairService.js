/**
 * Coverage Repair Service - Phase 4B.3
 * 
 * One-time utility to repair students whose coverage was corrupted
 * by the old payment flow (before Phase 4B.3 fix).
 * 
 * @module coverageRepairService
 */

import { supabase } from '../lib/supabase.js';
import { rebuildStudentCoverage } from './coverageDatabaseService.js';
import { debug } from '../lib/debug.js';

/**
 * Repair a single student's coverage by rebuilding from payment history
 * 
 * @param {string} studentId - Student ID to repair
 * @returns {Promise<{success: boolean, coverage?: object, error?: string}>}
 */
export async function repairStudentCoverage(studentId) {
  try {
    const coverage = await rebuildStudentCoverage(studentId);
    return { 
      success: true, 
      coverage,
      message: `Coverage repaired: ${coverage.coverage_end || 'No coverage'}` 
    };
  } catch (error) {
    console.error('[CoverageRepair] Failed to repair student:', studentId, error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Repair ALL active students' coverage
 * 
 * This function loops through all ACTIVE students and rebuilds their coverage
 * from payment history. Use this as a one-time repair after deploying Phase 4B.3.
 * 
 * @returns {Promise<{success: boolean, repaired: number, failed: number, errors: Array}>}
 */
export async function repairAllStudentsCoverage() {
  debug('[CoverageRepair] Starting portfolio-wide coverage repair...');

  // Fetch all active students
  const { data: students, error: fetchErr } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('status', 'ACTIVE')
    .order('full_name', { ascending: true });

  if (fetchErr) {
    console.error('[CoverageRepair] Failed to fetch students:', fetchErr);
    return { 
      success: false, 
      repaired: 0, 
      failed: 0, 
      errors: [fetchErr.message] 
    };
  }

  if (!students || students.length === 0) {
    debug('[CoverageRepair] No active students found');
    return { 
      success: true, 
      repaired: 0, 
      failed: 0, 
      errors: [] 
    };
  }

  debug(`[CoverageRepair] Found ${students.length} active students to repair`);

  let repaired = 0;
  let failed = 0;
  const errors = [];

  // Rebuild coverage for each student
  for (const student of students) {
    try {
      const coverage = await rebuildStudentCoverage(student.id);
      repaired++;
      debug(`[CoverageRepair] ✓ ${student.full_name} - coverage_end: ${coverage.coverage_end || 'NULL'}`);
    } catch (error) {
      failed++;
      const errorMsg = `${student.full_name}: ${error.message}`;
      errors.push(errorMsg);
      console.error(`[CoverageRepair] ✗ ${errorMsg}`);
    }
  }

  const success = failed === 0;
  debug(`[CoverageRepair] Complete: ${repaired} repaired, ${failed} failed`);

  return { 
    success, 
    repaired, 
    failed, 
    errors 
  };
}

/**
 * Rebuild coverage for ALL ACTIVE students in a room (Phase 4C-A #5).
 *
 * Used when a room's rent_per_bed changes — that alters daily_rate (and therefore
 * day counts) for every ACTIVE occupant, so each must be replayed. The single
 * highest-blast-radius mutation in COVERAGE_MUTATION_MATRIX.md.
 *
 * @param {string} roomId
 * @returns {Promise<{success: boolean, rebuilt: number, failed: number, errors: Array<string>}>}
 */
export async function rebuildRoomCoverage(roomId) {
  if (!roomId) return { success: false, rebuilt: 0, failed: 0, errors: ['No roomId'] };

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('room_id', roomId)
    .eq('status', 'ACTIVE');

  if (error) {
    return { success: false, rebuilt: 0, failed: 0, errors: [error.message] };
  }
  if (!students || students.length === 0) {
    return { success: true, rebuilt: 0, failed: 0, errors: [] };
  }

  let rebuilt = 0, failed = 0;
  const errors = [];
  for (const s of students) {
    try {
      await rebuildStudentCoverage(s.id);
      rebuilt++;
    } catch (e) {
      failed++;
      errors.push(`${s.full_name}: ${e.message}`);
    }
  }
  return { success: failed === 0, rebuilt, failed, errors };
}

/**
 * Verify a student's coverage matches their payment history
 *
 * @param {string} studentId - Student ID to verify
 * @returns {Promise<{matches: boolean, current: object, expected: object, payments: Array}>}
 */
export async function verifyStudentCoverage(studentId) {
  try {
    // Get current coverage state
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, full_name, coverage_start, coverage_end, daily_rate, next_due_date, rooms(rent_per_bed)')
      .eq('id', studentId)
      .single();

    if (sErr || !student) {
      return { 
        matches: false, 
        error: 'Student not found' 
      };
    }

    // Get payment history
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('id, amount, payment_date, coverage_start_date, coverage_end_date, days_covered')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: true });

    if (pErr) {
      return { 
        matches: false, 
        error: 'Failed to load payments' 
      };
    }

    // Calculate what coverage SHOULD be based on payment history
    const { processPayment } = await import('./paymentProcessor.js');
    
    let currentCoverageEnd = null;
    let expectedCoverage = null;

    for (const payment of payments || []) {
      const paymentInput = {
        amount: parseFloat(payment.amount),
        payment_date: payment.payment_date
      };

      const studentState = {
        coverage_end: currentCoverageEnd,
        monthly_rent: student.rooms?.rent_per_bed,
        status: 'ACTIVE'
      };

      expectedCoverage = processPayment(paymentInput, studentState);
      currentCoverageEnd = expectedCoverage.coverageEnd;
    }

    const current = {
      coverage_start: student.coverage_start,
      coverage_end: student.coverage_end,
      daily_rate: student.daily_rate,
      next_due_date: student.next_due_date
    };

    const expected = expectedCoverage ? {
      coverage_start: expectedCoverage.coverageStart,
      coverage_end: expectedCoverage.coverageEnd,
      daily_rate: expectedCoverage.dailyRate,
      next_due_date: expectedCoverage.nextDueDate
    } : {
      coverage_start: null,
      coverage_end: null,
      daily_rate: null,
      next_due_date: null
    };

    const matches = 
      current.coverage_start === expected.coverage_start &&
      current.coverage_end === expected.coverage_end;

    return {
      matches,
      current,
      expected,
      payments: payments || [],
      student_name: student.full_name
    };

  } catch (error) {
    console.error('[CoverageRepair] Verification failed:', error);
    return { 
      matches: false, 
      error: error.message 
    };
  }
}
