/**
 * Tests for Rent Cycle Calculator - Sprint 5.5 Phase 2
 * 
 * These tests validate the core calculation logic:
 * - Daily rate calculation
 * - Coverage days calculation  
 * - Coverage period calculation
 * - Next due date calculation
 */

import { describe, it, expect } from 'vitest';
import * as RentCycleCalculator from './rentCycleCalculator.js';

describe('RentCycleCalculator', () => {
  describe('calculateCoverage', () => {
    it('should calculate correct coverage for full month payment', () => {
      const result = RentCycleCalculator.calculateCoverage(110, 110);
      
      expect(result.dailyRate).toBe(3.67);
      expect(result.coverageDays).toBe(30); // CRITICAL: Must be 30, not 29
      expect(result.isFullMonth).toBe(true);
      expect(result.isPartial).toBe(false);
      expect(result.isOverpayment).toBe(false);
    });

    it('should calculate correct coverage for partial payment', () => {
      const result = RentCycleCalculator.calculateCoverage(55, 110);
      
      expect(result.dailyRate).toBe(3.67);
      expect(result.coverageDays).toBe(15); // Half payment = half month
      expect(result.isFullMonth).toBe(false);
      expect(result.isPartial).toBe(true);
      expect(result.isOverpayment).toBe(false);
    });

    it('should calculate correct coverage for overpayment', () => {
      const result = RentCycleCalculator.calculateCoverage(220, 110);
      
      expect(result.dailyRate).toBe(3.67);
      expect(result.coverageDays).toBe(60); // Double payment = double month
      expect(result.isFullMonth).toBe(false);
      expect(result.isPartial).toBe(false);
      expect(result.isOverpayment).toBe(true);
    });

    it('should throw error for zero payment amount', () => {
      expect(() => {
        RentCycleCalculator.calculateCoverage(0, 110);
      }).toThrow('Payment amount must be positive');
    });

    it('should throw error for zero monthly rent', () => {
      expect(() => {
        RentCycleCalculator.calculateCoverage(110, 0);
      }).toThrow('Monthly rent must be positive');
    });
  });

  describe('calculateCoveragePeriod', () => {
    it('should calculate correct coverage period for 30 days', () => {
      const result = RentCycleCalculator.calculateCoveragePeriod('2026-06-15', 30);
      
      expect(result.coverageStart).toEqual(new Date('2026-06-15'));
      expect(result.coverageEnd).toEqual(new Date('2026-07-14')); // 15 Jun + 30 days - 1 = 14 Jul
      expect(result.coverageDays).toBe(30);
    });

    it('should calculate correct coverage period for 15 days', () => {
      const result = RentCycleCalculator.calculateCoveragePeriod('2026-06-15', 15);
      
      expect(result.coverageStart).toEqual(new Date('2026-06-15'));
      expect(result.coverageEnd).toEqual(new Date('2026-06-29')); // 15 Jun + 15 days - 1 = 29 Jun
      expect(result.coverageDays).toBe(15);
    });

    it('should handle Date objects as input', () => {
      const result = RentCycleCalculator.calculateCoveragePeriod(new Date('2026-06-15'), 30);
      
      expect(result.coverageStart).toEqual(new Date('2026-06-15'));
      expect(result.coverageEnd).toEqual(new Date('2026-07-14'));
    });

    it('should throw error for invalid date', () => {
      expect(() => {
        RentCycleCalculator.calculateCoveragePeriod('invalid-date', 30);
      }).toThrow('Invalid payment date');
    });

    it('should throw error for zero coverage days', () => {
      expect(() => {
        RentCycleCalculator.calculateCoveragePeriod('2026-06-15', 0);
      }).toThrow('Coverage days must be at least 1');
    });
  });

  describe('calculateNextDueDate', () => {
    it('should calculate next due date after coverage ends', () => {
      const result = RentCycleCalculator.calculateNextDueDate('2026-07-14', 15);
      
      // Coverage ends 14 Jul, day after is 15 Jul, anchor is 15th, so next due is 15 Jul (same month)
      expect(result).toEqual(new Date('2026-07-15'));
    });

    it('should move to next month if anchor day already passed', () => {
      const result = RentCycleCalculator.calculateNextDueDate('2026-07-20', 15);
      
      // Coverage ends 20 Jul, anchor is 15th (already passed), so next due is 15 Aug
      expect(result).toEqual(new Date('2026-08-15'));
    });

    it('should handle end of month scenarios', () => {
      const result = RentCycleCalculator.calculateNextDueDate('2026-01-31', 31);
      
      // Coverage ends 31 Jan, anchor is 31st, so next due is 28 Feb (Feb has no 31st)
      expect(result.getDate()).toBe(28);
      expect(result.getMonth()).toBe(1); // February (0-indexed)
    });

    it('should throw error for invalid date', () => {
      expect(() => {
        RentCycleCalculator.calculateNextDueDate('invalid-date', 15);
      }).toThrow('Invalid coverage end date');
    });

    it('should throw error for invalid anchor day', () => {
      expect(() => {
        RentCycleCalculator.calculateNextDueDate('2026-07-14', 0);
      }).toThrow('Billing anchor day must be between 1 and 31');
    });
  });

  describe('calculateDailyRate', () => {
    it('should calculate correct daily rate', () => {
      expect(RentCycleCalculator.calculateDailyRate(110)).toBe(3.67);
      expect(RentCycleCalculator.calculateDailyRate(150)).toBe(5.00);
      expect(RentCycleCalculator.calculateDailyRate(260)).toBe(8.67);
    });

    it('should throw error for zero rent', () => {
      expect(() => {
        RentCycleCalculator.calculateDailyRate(0);
      }).toThrow('Monthly rent must be positive');
    });
  });

  describe('validatePaymentAmount', () => {
    it('should validate normal payment amounts', () => {
      const result = RentCycleCalculator.validatePaymentAmount(110, 110);
      
      expect(result.isValid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should warn for excessive payments', () => {
      const result = RentCycleCalculator.validatePaymentAmount(500, 110);
      
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('exceeds 3 months rent');
    });

    it('should reject zero payments', () => {
      const result = RentCycleCalculator.validatePaymentAmount(0, 110);
      
      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('must be positive');
    });
  });

  describe('formatCoveragePeriod', () => {
    it('should format coverage period correctly', () => {
      const result = RentCycleCalculator.formatCoveragePeriod('2026-06-15', '2026-07-14');
      
      expect(result).toBe('15 Jun - 14 Jul 2026');
    });

    it('should handle missing dates', () => {
      const result = RentCycleCalculator.formatCoveragePeriod(null, null);
      
      expect(result).toBe('No active coverage');
    });

    it('should handle invalid dates', () => {
      const result = RentCycleCalculator.formatCoveragePeriod('invalid', 'invalid');
      
      expect(result).toBe('Invalid dates');
    });
  });
});
