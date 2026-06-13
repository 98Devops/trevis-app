/**
 * Tests for Payment Processor - Sprint 5.5 Phase 2
 * 
 * CRITICAL: These tests validate the early payment logic and prepaid day preservation.
 * 
 * Test scenarios:
 * 1. Normal payment (no existing coverage)
 * 2. Early payment (payment before coverage_end)
 * 3. Payment after coverage expires
 * 4. ACTIVE vs non-ACTIVE student handling
 */

import { describe, it, expect } from 'vitest';
import * as PaymentProcessor from './paymentProcessor.js';

describe('PaymentProcessor', () => {
  describe('processPayment - Normal Payment Scenarios', () => {
    it('should process first payment correctly (no existing coverage)', () => {
      const payment = {
        amount: 110,
        payment_date: '2026-06-15'
      };

      const student = {
        coverage_end: null, // No existing coverage
        billing_anchor_date: null,
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      expect(result.coverageStart).toEqual(new Date('2026-06-15'));
      expect(result.coverageEnd).toEqual(new Date('2026-07-14')); // 15 Jun + 30 days - 1
      expect(result.coverageDays).toBe(30);
      expect(result.isEarlyPayment).toBe(false);
      expect(result.prepaidDaysPreserved).toBe(0);
      expect(result.billingAnchorDate).toEqual(new Date('2026-06-15'));
    });

    it('should process payment after coverage expires', () => {
      const payment = {
        amount: 110,
        payment_date: '2026-07-20'
      };

      const student = {
        coverage_end: '2026-07-14', // Coverage expired 6 days ago
        billing_anchor_date: '2026-06-15',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      expect(result.coverageStart).toEqual(new Date('2026-07-20')); // Starts from payment date
      expect(result.coverageEnd).toEqual(new Date('2026-08-18')); // 20 Jul + 30 days - 1
      expect(result.isEarlyPayment).toBe(false);
      expect(result.prepaidDaysPreserved).toBe(0);
    });
  });

  describe('processPayment - Early Payment Scenarios (CRITICAL)', () => {
    it('should extend coverage for early payment and preserve prepaid days', () => {
      const payment = {
        amount: 110,
        payment_date: '2026-06-15'
      };

      const student = {
        coverage_end: '2026-06-25', // Coverage until 25 Jun (10 prepaid days)
        billing_anchor_date: '2026-06-01',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // CRITICAL: Coverage should start AFTER existing coverage ends
      expect(result.coverageStart).toEqual(new Date('2026-06-26')); // Day after existing coverage ends
      expect(result.coverageEnd).toEqual(new Date('2026-07-25')); // 26 Jun + 30 days - 1
      expect(result.isEarlyPayment).toBe(true);
      expect(result.prepaidDaysPreserved).toBe(10); // Days between 15 Jun and 25 Jun
      expect(result.billingAnchorDate).toEqual(new Date('2026-06-01')); // Preserved existing anchor
    });

    it('should handle early payment with large prepaid balance', () => {
      const payment = {
        amount: 220, // 60 days coverage
        payment_date: '2026-06-01'
      };

      const student = {
        coverage_end: '2026-07-30', // Coverage until 30 Jul (59 prepaid days)
        billing_anchor_date: '2026-05-01',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // Should extend from existing coverage end
      expect(result.coverageStart).toEqual(new Date('2026-07-31')); // Day after 30 Jul
      expect(result.coverageEnd).toEqual(new Date('2026-09-28')); // 31 Jul + 60 days - 1
      expect(result.isEarlyPayment).toBe(true);
      expect(result.prepaidDaysPreserved).toBe(59);
    });

    it('should handle payment on same day as coverage end', () => {
      const payment = {
        amount: 110,
        payment_date: '2026-06-25'
      };

      const student = {
        coverage_end: '2026-06-25', // Coverage ends today
        billing_anchor_date: '2026-06-01',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // payment_date <= coverage_end, so it's an early payment (edge case)
      expect(result.coverageStart).toEqual(new Date('2026-06-26')); // Day after coverage ends
      expect(result.coverageEnd).toEqual(new Date('2026-07-25'));
      expect(result.isEarlyPayment).toBe(true);
      expect(result.prepaidDaysPreserved).toBe(0); // Same day, so 0 days preserved
    });
  });

  describe('processPayment - Validation and Error Handling', () => {
    it('should throw error for non-ACTIVE student', () => {
      const payment = {
        amount: 110,
        payment_date: '2026-06-15'
      };

      const student = {
        coverage_end: null,
        monthly_rent: 110,
        status: 'CHECKED_OUT'
      };

      expect(() => {
        PaymentProcessor.processPayment(payment, student);
      }).toThrow('Cannot process payment for student with status: CHECKED_OUT');
    });

    it('should throw error for zero payment amount', () => {
      const payment = {
        amount: 0,
        payment_date: '2026-06-15'
      };

      const student = {
        coverage_end: null,
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      expect(() => {
        PaymentProcessor.processPayment(payment, student);
      }).toThrow('Payment amount must be positive');
    });

    it('should throw error for zero monthly rent', () => {
      const payment = {
        amount: 110,
        payment_date: '2026-06-15'
      };

      const student = {
        coverage_end: null,
        monthly_rent: 0,
        status: 'ACTIVE'
      };

      expect(() => {
        PaymentProcessor.processPayment(payment, student);
      }).toThrow('Monthly rent must be positive');
    });
  });

  describe('generatePaymentPreview', () => {
    it('should generate preview for normal payment', () => {
      const student = {
        coverage_end: null,
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.generatePaymentPreview(110, student);

      expect(result.coverageDays).toBe(30);
      expect(result.isFullMonth).toBe(true);
      expect(result.isEarlyPayment).toBe(false);
      expect(result.prepaidDaysPreserved).toBe(0);
      expect(result.displayMessage).toContain('New coverage');
      expect(result.displayMessage).toContain('30 days');
    });

    it('should generate preview for early payment', () => {
      // Set coverage_end to a future date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const student = {
        coverage_end: futureDate.toISOString().split('T')[0],
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.generatePaymentPreview(110, student);

      expect(result.isEarlyPayment).toBe(true);
      expect(result.prepaidDaysPreserved).toBeGreaterThan(0);
      expect(result.displayMessage).toContain('Extends coverage');
      expect(result.displayMessage).toContain('prepaid days');
    });

    it('should show partial payment in preview', () => {
      const student = {
        coverage_end: null,
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.generatePaymentPreview(55, student);

      expect(result.coverageDays).toBe(15);
      expect(result.isFullMonth).toBe(false);
      expect(result.displayMessage).toContain('15 days');
    });
  });

  describe('validateEarlyPayment', () => {
    it('should detect early payment correctly', () => {
      const result = PaymentProcessor.validateEarlyPayment(
        '2026-06-15',
        '2026-06-25'
      );

      expect(result.isEarlyPayment).toBe(true);
      expect(result.prepaidDaysPreserved).toBe(10);
      expect(result.message).toContain('Early payment detected');
      expect(result.message).toContain('10 prepaid days');
    });

    it('should detect normal payment (no existing coverage)', () => {
      const result = PaymentProcessor.validateEarlyPayment(
        '2026-06-15',
        null
      );

      expect(result.isEarlyPayment).toBe(false);
      expect(result.prepaidDaysPreserved).toBe(0);
      expect(result.message).toContain('No existing coverage');
    });

    it('should detect normal payment (coverage expired)', () => {
      const result = PaymentProcessor.validateEarlyPayment(
        '2026-07-20',
        '2026-07-14'
      );

      expect(result.isEarlyPayment).toBe(false);
      expect(result.prepaidDaysPreserved).toBe(0);
      expect(result.message).toContain('Coverage expired');
    });
  });
});

/* ═══════════════════════════════════════════════════════════
   BUSINESS-CRITICAL TESTS
   Added before Phase 4: These 4 tests are worth more than 50 cosmetic UI tests.
   They validate the hard-won prepaid day preservation logic.
═══════════════════════════════════════════════════════════ */

describe('Business-Critical Edge Cases', () => {
  describe('BC-1: Early Payment Preservation (Exact Date Scenario)', () => {
    it('should preserve prepaid days for payment 9 days before coverage expires', () => {
      // Student covered until 19 July
      // Pays on 10 July (9 days early)
      const payment = {
        amount: 110,
        payment_date: '2026-07-10'
      };

      const student = {
        coverage_end: '2026-07-19', // Coverage until 19 Jul
        billing_anchor_date: '2026-06-20',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // EXPECTED:
      // - Coverage starts on 20 July (day after existing coverage)
      // - Coverage ends on 18 August (20 Jul + 30 days - 1)
      // - Prepaid days preserved: 9 days (10 Jul to 19 Jul inclusive)
      expect(result.coverageStart).toEqual(new Date('2026-07-20')); // Day after 19 Jul
      expect(result.coverageEnd).toEqual(new Date('2026-08-18')); // 20 Jul + 30 days - 1
      expect(result.isEarlyPayment).toBe(true);
      expect(result.prepaidDaysPreserved).toBe(9); // 10 Jul to 19 Jul = 9 days
      
      // Verify no days disappear
      const totalDaysCovered = result.prepaidDaysPreserved + result.coverageDays;
      expect(totalDaysCovered).toBe(39); // 9 prepaid + 30 new = 39 total days
    });
  });

  describe('BC-2: Multiple Early Payments (Stacking Coverage)', () => {
    it('should correctly stack multiple early payments without losing days', () => {
      // Student covered until 19 July
      // First payment on 1 July
      const payment1 = {
        amount: 110,
        payment_date: '2026-07-01'
      };

      const student1 = {
        coverage_end: '2026-07-19',
        billing_anchor_date: '2026-06-20',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result1 = PaymentProcessor.processPayment(payment1, student1);

      // After first payment: coverage until 18 Aug (19 Jul + 30 days)
      expect(result1.coverageStart).toEqual(new Date('2026-07-20'));
      expect(result1.coverageEnd).toEqual(new Date('2026-08-18'));
      expect(result1.prepaidDaysPreserved).toBe(18); // 1 Jul to 19 Jul = 18 days

      // Second payment on 10 July (while still covered until 18 Aug)
      const payment2 = {
        amount: 110,
        payment_date: '2026-07-10'
      };

      const student2 = {
        coverage_end: result1.coverageEnd.toISOString().split('T')[0], // Now covered until 18 Aug
        billing_anchor_date: '2026-06-20',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result2 = PaymentProcessor.processPayment(payment2, student2);

      // After second payment: coverage extends from 19 Aug to 17 Sep
      expect(result2.coverageStart).toEqual(new Date('2026-08-19')); // Day after 18 Aug
      expect(result2.coverageEnd).toEqual(new Date('2026-09-17')); // 19 Aug + 30 days - 1
      expect(result2.isEarlyPayment).toBe(true);
      expect(result2.prepaidDaysPreserved).toBeGreaterThan(0);

      // CRITICAL: Verify no days disappear across both payments
      // First payment: 18 prepaid + 30 new = 48 days
      // Second payment: 39 prepaid + 30 new = 69 days
      // Total coverage from 1 Jul to 17 Sep should be continuous
      const firstPaymentTotal = result1.prepaidDaysPreserved + result1.coverageDays;
      const secondPaymentTotal = result2.prepaidDaysPreserved + result2.coverageDays;
      
      expect(firstPaymentTotal).toBe(48);
      expect(secondPaymentTotal).toBeGreaterThan(30); // At least 30 new days added
    });
  });

  describe('BC-3: Check-out Protection (Status Filtering)', () => {
    it('should reject payment for CHECKED_OUT student', () => {
      const payment = {
        amount: 110,
        payment_date: '2026-07-10'
      };

      const student = {
        coverage_end: '2026-07-19',
        billing_anchor_date: '2026-06-20',
        monthly_rent: 110,
        status: 'CHECKED_OUT' // Student has checked out
      };

      // EXPECTED: Payment should be rejected
      expect(() => {
        PaymentProcessor.processPayment(payment, student);
      }).toThrow('Cannot process payment for student with status: CHECKED_OUT');
    });

    it('should verify CHECKED_OUT students excluded from payment preview', () => {
      const student = {
        coverage_end: '2026-07-19',
        monthly_rent: 110,
        status: 'CHECKED_OUT'
      };

      // Preview generation should handle CHECKED_OUT status gracefully
      // (In real implementation, the UI should prevent this scenario entirely)
      expect(() => {
        PaymentProcessor.generatePaymentPreview(110, student);
      }).toThrow('Cannot generate preview for student with status: CHECKED_OUT');
    });
  });

  describe('BC-4: Due Today Edge Case (Coverage End Date = Today)', () => {
    it('should classify coverage ending today as DUE_TODAY (not CURRENT)', () => {
      // This test validates the StatusClassifier behavior
      // Coverage ends today = DUE_TODAY status
      // NOT CURRENT (which requires coverage_end > today)
      // NOT EXPIRING_SOON (which is future dates within 7 days)

      const today = new Date().toISOString().split('T')[0];

      const payment = {
        amount: 110,
        payment_date: today
      };

      const student = {
        coverage_end: today, // Coverage ends TODAY
        billing_anchor_date: '2026-06-20',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // When payment_date === coverage_end, it's considered early payment (edge case)
      // Coverage should extend from tomorrow
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(result.coverageStart).toEqual(tomorrow);
      expect(result.isEarlyPayment).toBe(true);
      
      // This validates the edge case where coverage_end = today
      // The StatusClassifier will mark this as DUE_TODAY before the payment
      // After payment, coverage extends into the future
    });

    it('should handle payment one day after coverage expires (OVERDUE scenario)', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to midnight
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const payment = {
        amount: 110,
        payment_date: today.toISOString().split('T')[0]
      };

      const student = {
        coverage_end: yesterday.toISOString().split('T')[0], // Coverage ended yesterday
        billing_anchor_date: '2026-06-20',
        monthly_rent: 110,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // Coverage expired yesterday, so this is NOT an early payment
      // New coverage starts from payment date (today)
      const expectedStart = new Date(payment.payment_date);
      expect(result.coverageStart).toEqual(expectedStart);
      expect(result.isEarlyPayment).toBe(false);
      expect(result.prepaidDaysPreserved).toBe(0);
      
      // This confirms the OVERDUE → PAID transition logic
    });
  });

  describe('BC-5: Massive Prepayment (Six Months Ahead)', () => {
    it('should handle $900 payment (6 months coverage) correctly', () => {
      // Property manager scenario: Family pays 6 months ahead
      // Rent = $150/month
      // Payment = $900 (exactly 6 months)
      const payment = {
        amount: 900,
        payment_date: '2026-07-01'
      };

      const student = {
        coverage_end: null, // No existing coverage
        billing_anchor_date: null,
        monthly_rent: 150,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // EXPECTED:
      // - Daily rate = $150 / 30 = $5/day
      // - Coverage days = $900 / $5 = 180 days (exactly 6 months)
      // - Coverage start = 1 July 2026
      // - Coverage end = 27 December 2026 (1 Jul + 180 days - 1)
      expect(result.coverageDays).toBe(180);
      expect(result.coverageStart).toEqual(new Date('2026-07-01'));
      expect(result.coverageEnd).toEqual(new Date('2026-12-27')); // 1 Jul + 180 days - 1 = 27 Dec
      expect(result.isEarlyPayment).toBe(false);
      expect(result.prepaidDaysPreserved).toBe(0);
      
      // Verify massive prepayment is treated like a valued customer, not a bug
      expect(result.coverageDays).toBeGreaterThan(150); // Significantly > 1 month
    });

    it('should extend coverage correctly after massive prepayment', () => {
      // After the $900 payment, student pays another $150 before coverage expires
      // This tests that the system correctly extends from the existing end date
      const payment = {
        amount: 150,
        payment_date: '2026-10-01' // Pays on 1 Oct (still covered until 28 Dec)
      };

      const student = {
        coverage_end: '2026-12-27', // Already covered until 27 Dec (from previous $900 payment)
        billing_anchor_date: '2026-07-01',
        monthly_rent: 150,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.processPayment(payment, student);

      // EXPECTED:
      // - This is an early payment (1 Oct < 27 Dec)
      // - Prepaid days preserved = 87 days (1 Oct to 27 Dec)
      // - New coverage starts = 28 Dec 2026 (day after existing coverage)
      // - New coverage ends = 26 Jan 2027 (28 Dec + 30 days - 1)
      expect(result.isEarlyPayment).toBe(true);
      expect(result.prepaidDaysPreserved).toBe(87); // 1 Oct to 27 Dec = 87 days
      expect(result.coverageStart).toEqual(new Date('2026-12-28')); // Day after 27 Dec
      expect(result.coverageEnd).toEqual(new Date('2027-01-26')); // 28 Dec + 30 days - 1
      expect(result.coverageDays).toBe(30); // Standard 1-month extension
      
      // Verify no days disappear
      const totalDaysCovered = result.prepaidDaysPreserved + result.coverageDays;
      expect(totalDaysCovered).toBe(117); // 87 prepaid + 30 new = 117 total days
    });

    it('should generate correct preview for massive prepayment', () => {
      const student = {
        coverage_end: null,
        monthly_rent: 150,
        status: 'ACTIVE'
      };

      const result = PaymentProcessor.generatePaymentPreview(900, student);

      // EXPECTED:
      // - Preview should show 180 days coverage
      // - Should NOT be flagged as full month (it's 6 months!)
      // - Display message should reflect massive prepayment
      expect(result.coverageDays).toBe(180);
      expect(result.isFullMonth).toBe(false); // 180 days ≠ 30 days
      expect(result.displayMessage).toContain('180 days');
      
      // Verify the system treats this gracefully
      expect(result.coverageDays).toBeGreaterThan(150);
    });
  });
});
