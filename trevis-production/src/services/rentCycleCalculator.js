/**
 * Rent Cycle Calculator Service - Sprint 5.5 Phase 2
 * 
 * CRITICAL BUSINESS RULES:
 * 1. Coverage_End_Date is the primary billing truth
 * 2. Daily rate = monthly rent / 30 (always)
 * 3. Coverage days = ROUND(payment amount / daily rate)
 * 4. NO calendar month assumptions
 * 
 * This service handles pure calculation logic without database operations.
 * For payment processing with early payment detection, use PaymentProcessor.
 * 
 * @module rentCycleCalculator
 */

/**
 * Calculate payment coverage details
 * 
 * @param {number} amount - Payment amount
 * @param {number} monthlyRent - Monthly rent amount
 * @returns {{
 *   dailyRate: number,
 *   coverageDays: number,
 *   isFullMonth: boolean,
 *   isPartial: boolean,
 *   isOverpayment: boolean
 * }} Coverage calculation result
 * 
 * @example
 * const coverage = calculateCoverage(110, 110);
 * // Returns: { dailyRate: 3.67, coverageDays: 30, isFullMonth: true, ... }
 */
export function calculateCoverage(amount, monthlyRent) {
  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be positive');
  }
  
  if (!monthlyRent || monthlyRent <= 0) {
    throw new Error('Monthly rent must be positive');
  }

  // CRITICAL: Daily rate calculation (monthly rent / 30)
  // Must match database calculation for consistency
  const dailyRate = Math.round((monthlyRent / 30) * 100) / 100;
  
  // CRITICAL: Proper rounding to avoid truncation
  // Use Math.round() not Math.floor() to match database logic
  const coverageDays = Math.round(amount / dailyRate);
  
  // Classify payment type
  const isFullMonth = Math.abs(coverageDays - 30) <= 1; // Within 1 day of full month
  const isPartial = coverageDays < 30;
  const isOverpayment = coverageDays > 30;
  
  return {
    dailyRate,
    coverageDays,
    isFullMonth,
    isPartial,
    isOverpayment
  };
}

/**
 * Calculate coverage period from payment
 * 
 * IMPORTANT: This calculates coverage from a given start date.
 * It does NOT handle early payment detection - use PaymentProcessor for that.
 * 
 * @param {Date|string} paymentDate - Payment date (Date object or ISO string)
 * @param {number} coverageDays - Number of days of coverage
 * @returns {{
 *   coverageStart: Date,
 *   coverageEnd: Date,
 *   coverageDays: number
 * }} Coverage period
 * 
 * @example
 * const period = calculateCoveragePeriod('2026-06-15', 30);
 * // Returns: { coverageStart: Date(2026-06-15), coverageEnd: Date(2026-07-14), coverageDays: 30 }
 */
export function calculateCoveragePeriod(paymentDate, coverageDays) {
  const coverageStart = new Date(paymentDate);
  
  if (isNaN(coverageStart.getTime())) {
    throw new Error('Invalid payment date');
  }
  
  if (!coverageDays || coverageDays < 1) {
    throw new Error('Coverage days must be at least 1');
  }
  
  // CRITICAL: Coverage end = start + days - 1 (inclusive)
  // Example: Payment on June 15 for 30 days = June 15 to July 14
  const coverageEnd = new Date(coverageStart);
  coverageEnd.setDate(coverageEnd.getDate() + coverageDays - 1);
  
  return {
    coverageStart,
    coverageEnd,
    coverageDays
  };
}

/**
 * Calculate next due date based on billing anchor
 * 
 * @param {Date|string} coverageEnd - End of current coverage
 * @param {number} billingAnchorDay - Day of month for billing (1-31)
 * @returns {Date} Next due date
 * 
 * @example
 * const nextDue = calculateNextDueDate('2026-07-14', 15);
 * // Returns: Date(2026-08-15) - next occurrence of 15th after coverage ends
 */
export function calculateNextDueDate(coverageEnd, billingAnchorDay) {
  const endDate = new Date(coverageEnd);
  
  if (isNaN(endDate.getTime())) {
    throw new Error('Invalid coverage end date');
  }
  
  if (!billingAnchorDay || billingAnchorDay < 1 || billingAnchorDay > 31) {
    throw new Error('Billing anchor day must be between 1 and 31');
  }
  
  // Start with the day after coverage ends
  let nextDue = new Date(endDate);
  nextDue.setDate(nextDue.getDate() + 1);
  
  // Get the current day of month
  const currentDay = nextDue.getDate();
  
  // If the billing anchor day is in the current month and hasn't passed yet
  if (currentDay <= billingAnchorDay) {
    // Try to set to the anchor day in the current month
    const testDate = new Date(nextDue);
    testDate.setDate(billingAnchorDay);
    
    // Check if this date exists in the current month
    if (testDate.getMonth() === nextDue.getMonth()) {
      nextDue = testDate;
    } else {
      // Anchor day doesn't exist in this month, use last day of month
      nextDue = new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0);
    }
  } else {
    // Anchor day has passed in current month, move to next month
    nextDue.setMonth(nextDue.getMonth() + 1);
    nextDue.setDate(1); // Start at first day of next month
    
    // Try to set to anchor day
    const testDate = new Date(nextDue);
    testDate.setDate(billingAnchorDay);
    
    // Check if this date exists in the next month
    if (testDate.getMonth() === nextDue.getMonth()) {
      nextDue = testDate;
    } else {
      // Anchor day doesn't exist in next month, use last day of that month
      nextDue = new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0);
    }
  }
  
  return nextDue;
}

/**
 * Calculate daily rate from monthly rent
 * 
 * @param {number} monthlyRent - Monthly rent amount
 * @returns {number} Daily rate (rounded to 2 decimal places)
 * 
 * @example
 * const dailyRate = calculateDailyRate(110);
 * // Returns: 3.67
 */
export function calculateDailyRate(monthlyRent) {
  if (!monthlyRent || monthlyRent <= 0) {
    throw new Error('Monthly rent must be positive');
  }
  
  // CRITICAL: Daily rate = monthly rent / 30 (not 31, not 28, always 30)
  return Math.round((monthlyRent / 30) * 100) / 100;
}

/**
 * Validate payment amount
 * 
 * @param {number} amount - Payment amount
 * @param {number} monthlyRent - Monthly rent for context
 * @returns {{ isValid: boolean, warning?: string }}
 * 
 * @example
 * const validation = validatePaymentAmount(500, 150);
 * // Returns: { isValid: true, warning: 'Payment exceeds 3 months rent...' }
 */
export function validatePaymentAmount(amount, monthlyRent) {
  if (amount <= 0) {
    return {
      isValid: false,
      warning: 'Payment amount must be positive'
    };
  }
  
  if (amount > monthlyRent * 3) {
    return {
      isValid: true,
      warning: 'Payment exceeds 3 months rent - please verify amount is correct'
    };
  }
  
  return { isValid: true };
}

/**
 * Format coverage period for display
 * 
 * @param {Date|string} coverageStart - Coverage start date
 * @param {Date|string} coverageEnd - Coverage end date
 * @returns {string} Formatted period (e.g., "15 Jun - 14 Jul 2026")
 * 
 * @example
 * const formatted = formatCoveragePeriod('2026-06-15', '2026-07-14');
 * // Returns: "15 Jun - 14 Jul 2026"
 */
export function formatCoveragePeriod(coverageStart, coverageEnd) {
  if (!coverageStart || !coverageEnd) {
    return 'No active coverage';
  }
  
  const start = new Date(coverageStart);
  const end = new Date(coverageEnd);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid dates';
  }
  
  const startFormatted = start.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short' 
  });
  
  const endFormatted = end.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
  
  return `${startFormatted} - ${endFormatted}`;
}
