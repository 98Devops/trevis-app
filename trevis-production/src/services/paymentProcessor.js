/**
 * Payment Processor Service - Sprint 5.5 Phase 2
 * 
 * CRITICAL BUSINESS RULES ENFORCED:
 * 1. Coverage_End_Date is the primary billing truth (system of record)
 * 2. Early payments extend from existing coverage_end, NEVER discard prepaid days
 * 3. Prepaid days can NEVER be lost - 100% preservation guaranteed
 * 4. Only ACTIVE students are processed
 * 
 * EARLY PAYMENT DETECTION:
 * - If payment_date < existing coverage_end: EARLY PAYMENT
 * - Early payment starts coverage on (coverage_end + 1), not payment_date
 * - This preserves all prepaid days between payment_date and coverage_end
 * 
 * NORMAL PAYMENT:
 * - If payment_date >= existing coverage_end: NORMAL PAYMENT
 * - Normal payment starts coverage on payment_date
 * 
 * @module paymentProcessor
 */

import * as RentCycleCalculator from './rentCycleCalculator.js';

/**
 * Process payment and calculate billing cycle updates
 * 
 * This is the CORE function that implements early payment detection
 * and prepaid day preservation logic.
 * 
 * @param {object} payment - Payment record
 * @param {number} payment.amount - Payment amount
 * @param {string|Date} payment.payment_date - Payment date
 * @param {object} student - Student record with coverage and room info
 * @param {string|Date|null} student.coverage_end - Existing coverage end date (PRIMARY TRUTH)
 * @param {string|Date|null} student.billing_anchor_date - Existing billing anchor
 * @param {number} student.monthly_rent - Monthly rent amount
 * @param {string} student.status - Student status (must be 'ACTIVE')
 * 
 * @returns {{
 *   billingAnchorDate: Date,
 *   coverageStart: Date,
 *   coverageEnd: Date,
 *   nextDueDate: Date,
 *   dailyRate: number,
 *   coverageDays: number,
 *   isEarlyPayment: boolean,
 *   prepaidDaysPreserved: number
 * }} Updated billing information
 * 
 * @throws {Error} If student is not ACTIVE
 * @throws {Error} If payment amount or monthly rent is invalid
 * 
 * @example
 * // Normal payment (no existing coverage)
 * const result = processPayment(
 *   { amount: 110, payment_date: '2026-06-15' },
 *   { coverage_end: null, monthly_rent: 110, status: 'ACTIVE' }
 * );
 * // Returns: { coverageStart: 2026-06-15, coverageEnd: 2026-07-14, isEarlyPayment: false, ... }
 * 
 * @example
 * // Early payment (existing coverage until June 25)
 * const result = processPayment(
 *   { amount: 110, payment_date: '2026-06-15' },
 *   { coverage_end: '2026-06-25', monthly_rent: 110, status: 'ACTIVE' }
 * );
 * // Returns: { coverageStart: 2026-06-26, coverageEnd: 2026-07-25, isEarlyPayment: true, prepaidDaysPreserved: 10, ... }
 */
export function processPayment(payment, student) {
  const { amount, payment_date } = payment;
  const { coverage_end, billing_anchor_date, monthly_rent, status } = student;

  // CRITICAL: Only process ACTIVE students
  if (status !== 'ACTIVE') {
    throw new Error(`Cannot process payment for student with status: ${status}. Only ACTIVE students can receive payments.`);
  }

  // Validate inputs
  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be positive');
  }

  if (!monthly_rent || monthly_rent <= 0) {
    throw new Error('Monthly rent must be positive');
  }

  // Calculate coverage days for this payment
  const coverage = RentCycleCalculator.calculateCoverage(amount, monthly_rent);

  // CRITICAL: Determine coverage start date
  // This is where early payment detection and prepaid day preservation happens
  const paymentDate = new Date(payment_date);
  const existingCoverageEnd = coverage_end ? new Date(coverage_end) : null;

  let coverageStartDate;
  let isEarlyPayment = false;
  let prepaidDaysPreserved = 0;

  if (existingCoverageEnd && paymentDate <= existingCoverageEnd) {
    // ✅ EARLY PAYMENT DETECTED
    // Student is paying before their coverage ends - extend from existing coverage
    // NEVER reset coverage from payment_date - this would lose prepaid days
    
    coverageStartDate = new Date(existingCoverageEnd);
    coverageStartDate.setDate(coverageStartDate.getDate() + 1); // Start day after existing coverage ends
    isEarlyPayment = true;
    
    // Calculate prepaid days being preserved
    const timeDiff = existingCoverageEnd.getTime() - paymentDate.getTime();
    prepaidDaysPreserved = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
  } else {
    // ✅ NORMAL PAYMENT
    // No existing coverage OR payment is after coverage expired
    // Coverage starts from payment date
    
    coverageStartDate = paymentDate;
    isEarlyPayment = false;
    prepaidDaysPreserved = 0;
  }

  // Calculate coverage end date from the determined start date
  const coverageEndDate = new Date(coverageStartDate);
  coverageEndDate.setDate(coverageEndDate.getDate() + coverage.coverageDays - 1);

  // Update billing anchor date
  // For early payments, preserve existing anchor if it exists
  // For normal payments or first payment, set anchor to payment date
  let billingAnchorDate;
  if (isEarlyPayment && billing_anchor_date) {
    billingAnchorDate = new Date(billing_anchor_date);
  } else {
    billingAnchorDate = paymentDate;
  }
  
  const billingAnchorDay = billingAnchorDate.getDate();

  // Calculate next due date
  const nextDueDate = RentCycleCalculator.calculateNextDueDate(
    coverageEndDate,
    billingAnchorDay
  );

  return {
    billingAnchorDate,
    coverageStart: coverageStartDate,
    coverageEnd: coverageEndDate,
    nextDueDate,
    dailyRate: coverage.dailyRate,
    coverageDays: coverage.coverageDays,
    isEarlyPayment,
    prepaidDaysPreserved
  };
}

/**
 * Generate payment preview for UI display
 * 
 * Shows user what coverage they will get from a payment BEFORE recording it.
 * Includes early payment detection and prepaid day preservation info.
 * 
 * @param {number} amount - Payment amount
 * @param {object} student - Student record with coverage and room info
 * @param {string|Date|null} student.coverage_end - Existing coverage end date
 * @param {number} student.monthly_rent - Monthly rent amount
 * @param {string} student.status - Student status
 * 
 * @returns {{
 *   coverageDays: number,
 *   coverageStart: Date,
 *   coverageEnd: Date,
 *   isFullMonth: boolean,
 *   dailyRate: number,
 *   isEarlyPayment: boolean,
 *   prepaidDaysPreserved: number,
 *   displayMessage: string
 * }} Payment preview data
 * 
 * @example
 * const preview = generatePaymentPreview(110, {
 *   coverage_end: '2026-06-25',
 *   monthly_rent: 110,
 *   status: 'ACTIVE'
 * });
 * // Returns: {
 * //   coverageDays: 30,
 * //   isEarlyPayment: true,
 * //   prepaidDaysPreserved: 10,
 * //   displayMessage: "Extends coverage from 25 Jun to 25 Jul (preserves 10 prepaid days)"
 * // }
 */
export function generatePaymentPreview(amount, student) {
  const { coverage_end, monthly_rent, status } = student;

  // CRITICAL: Only generate preview for ACTIVE students
  if (status !== 'ACTIVE') {
    throw new Error(`Cannot generate preview for student with status: ${status}. Only ACTIVE students can receive payments.`);
  }

  // Calculate coverage
  const coverage = RentCycleCalculator.calculateCoverage(amount, monthly_rent);
  
  // Use current date as payment date for preview
  const paymentDate = new Date();
  const existingCoverageEnd = coverage_end ? new Date(coverage_end) : null;

  let coverageStart;
  let isEarlyPayment = false;
  let prepaidDaysPreserved = 0;
  let displayMessage;

  if (existingCoverageEnd && paymentDate <= existingCoverageEnd) {
    // Early payment preview
    coverageStart = new Date(existingCoverageEnd);
    coverageStart.setDate(coverageStart.getDate() + 1);
    isEarlyPayment = true;
    
    const timeDiff = existingCoverageEnd.getTime() - paymentDate.getTime();
    prepaidDaysPreserved = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
  } else {
    // Normal payment preview
    coverageStart = paymentDate;
    isEarlyPayment = false;
  }

  const coverageEnd = new Date(coverageStart);
  coverageEnd.setDate(coverageEnd.getDate() + coverage.coverageDays - 1);

  // Generate display message
  if (isEarlyPayment) {
    const existingEndFormatted = existingCoverageEnd.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short' 
    });
    const newEndFormatted = coverageEnd.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short' 
    });
    
    displayMessage = `Extends coverage from ${existingEndFormatted} to ${newEndFormatted} (preserves ${prepaidDaysPreserved} prepaid days)`;
  } else {
    const startFormatted = coverageStart.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short' 
    });
    const endFormatted = coverageEnd.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short' 
    });
    
    displayMessage = `New coverage: ${startFormatted} to ${endFormatted} (${coverage.coverageDays} days)`;
  }

  return {
    coverageDays: coverage.coverageDays,
    coverageStart,
    coverageEnd,
    isFullMonth: coverage.isFullMonth,
    dailyRate: coverage.dailyRate,
    isEarlyPayment,
    prepaidDaysPreserved,
    displayMessage
  };
}

/**
 * Validate early payment scenario
 * 
 * Helper function to check if a payment would be an early payment
 * and how many prepaid days would be preserved.
 * 
 * @param {string|Date} paymentDate - Payment date
 * @param {string|Date|null} existingCoverageEnd - Existing coverage end date
 * @returns {{
 *   isEarlyPayment: boolean,
 *   prepaidDaysPreserved: number,
 *   message: string
 * }} Early payment validation result
 */
export function validateEarlyPayment(paymentDate, existingCoverageEnd) {
  if (!existingCoverageEnd) {
    return {
      isEarlyPayment: false,
      prepaidDaysPreserved: 0,
      message: 'No existing coverage - normal payment'
    };
  }

  const payment = new Date(paymentDate);
  const coverageEnd = new Date(existingCoverageEnd);

  if (payment <= coverageEnd) {
    const timeDiff = coverageEnd.getTime() - payment.getTime();
    const daysPreserved = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    return {
      isEarlyPayment: true,
      prepaidDaysPreserved: daysPreserved,
      message: `Early payment detected. Will preserve ${daysPreserved} prepaid days.`
    };
  }

  return {
    isEarlyPayment: false,
    prepaidDaysPreserved: 0,
    message: 'Coverage expired - normal payment'
  };
}
