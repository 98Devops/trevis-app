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
