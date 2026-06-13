/**
 * Status Classifier Tests - Sprint 5.5 Phase 3
 */

import { describe, it, expect } from 'vitest';
import { classifyStudent, classifyPortfolio, getStatusBadgeConfig } from '../statusClassifier.js';

describe('StatusClassifier', () => {
  describe('classifyStudent - CURRENT status', () => {
    it('should classify student with 15 days remaining as CURRENT', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      
      const student = {
        status: 'ACTIVE',
        coverage_end: futureDate.toISOString().split('T')[0]
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('CURRENT');
      expect(result.excludeFromMetrics).toBe(false);
      expect(result.daysRemaining).toBe(15);
      expect(result.daysOverdue).toBe(0);
      expect(result.displayLabel).toBe('15 days remaining');
    });

    it('should classify student with exactly 8 days remaining as CURRENT', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 8);
      
      const student = {
        status: 'ACTIVE',
        coverage_end: futureDate.toISOString().split('T')[0]
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('CURRENT');
      expect(result.daysRemaining).toBe(8);
    });
  });

  describe('classifyStudent - EXPIRING_SOON status', () => {
    it('should classify student with 5 days remaining as EXPIRING_SOON', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      
      const student = {
        status: 'ACTIVE',
        coverage_end: futureDate.toISOString().split('T')[0]
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('EXPIRING_SOON');
      expect(result.excludeFromMetrics).toBe(false);
      expect(result.daysRemaining).toBe(5);
      expect(result.daysOverdue).toBe(0);
      expect(result.displayLabel).toBe('5 days remaining');
    });

    it('should classify student with 1 day remaining as EXPIRING_SOON', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const student = {
        status: 'ACTIVE',
        coverage_end: futureDate.toISOString().split('T')[0]
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('EXPIRING_SOON');
      expect(result.daysRemaining).toBe(1);
    });
  });

  describe('classifyStudent - DUE_TODAY status', () => {
    it('should classify student with coverage ending today as DUE_TODAY', () => {
      const today = new Date();
      
      const student = {
        status: 'ACTIVE',
        coverage_end: today.toISOString().split('T')[0]
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('DUE_TODAY');
      expect(result.excludeFromMetrics).toBe(false);
      expect(result.daysRemaining).toBe(0);
      expect(result.daysOverdue).toBe(0);
      expect(result.displayLabel).toBe('Due today');
    });
  });

  describe('classifyStudent - OVERDUE status', () => {
    it('should classify student with 10 days overdue as OVERDUE', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      
      const student = {
        status: 'ACTIVE',
        coverage_end: pastDate.toISOString().split('T')[0]
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('OVERDUE');
      expect(result.excludeFromMetrics).toBe(false);
      expect(result.daysRemaining).toBe(0);
      expect(result.daysOverdue).toBe(10);
      expect(result.displayLabel).toBe('10 days overdue');
    });

    it('should classify student with no coverage_end as OVERDUE', () => {
      const student = {
        status: 'ACTIVE',
        coverage_end: null
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('OVERDUE');
      expect(result.excludeFromMetrics).toBe(false);
      expect(result.daysRemaining).toBe(null);
      expect(result.daysOverdue).toBe(null);
      expect(result.displayLabel).toBe('No coverage recorded');
    });
  });

  describe('classifyStudent - EXCLUDED status (non-ACTIVE)', () => {
    it('should exclude CHECKED_OUT student from metrics', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      
      const student = {
        status: 'CHECKED_OUT',
        coverage_end: futureDate.toISOString().split('T')[0]
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('EXCLUDED');
      expect(result.excludeFromMetrics).toBe(true);
      expect(result.daysRemaining).toBe(null);
      expect(result.daysOverdue).toBe(null);
      expect(result.displayLabel).toBe('—');
    });

    it('should exclude VACATED student from metrics', () => {
      const student = {
        status: 'VACATED',
        coverage_end: '2026-06-15'
      };

      const result = classifyStudent(student);

      expect(result.status).toBe('EXCLUDED');
      expect(result.excludeFromMetrics).toBe(true);
    });
  });

  describe('classifyPortfolio - Portfolio aggregation', () => {
    it('should correctly aggregate mixed portfolio statuses', () => {
      const today = new Date();
      
      const students = [
        { id: 1, status: 'ACTIVE', coverage_end: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }, // CURRENT
        { id: 2, status: 'ACTIVE', coverage_end: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },  // EXPIRING_SOON
        { id: 3, status: 'ACTIVE', coverage_end: today.toISOString().split('T')[0] },                                                 // DUE_TODAY
        { id: 4, status: 'ACTIVE', coverage_end: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }, // OVERDUE
        { id: 5, status: 'CHECKED_OUT', coverage_end: new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] } // EXCLUDED
      ];

      const portfolio = classifyPortfolio(students);

      expect(portfolio.total).toBe(4); // Only ACTIVE students counted
      expect(portfolio.current).toBe(1);
      expect(portfolio.expiringSoon).toBe(1);
      expect(portfolio.dueToday).toBe(1);
      expect(portfolio.overdue).toBe(2); // Includes DUE_TODAY + OVERDUE
      expect(portfolio.details).toHaveLength(4); // CHECKED_OUT excluded
    });

    it('should handle all CURRENT portfolio', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);
      
      const students = [
        { id: 1, status: 'ACTIVE', coverage_end: futureDate.toISOString().split('T')[0] },
        { id: 2, status: 'ACTIVE', coverage_end: futureDate.toISOString().split('T')[0] },
        { id: 3, status: 'ACTIVE', coverage_end: futureDate.toISOString().split('T')[0] }
      ];

      const portfolio = classifyPortfolio(students);

      expect(portfolio.total).toBe(3);
      expect(portfolio.current).toBe(3);
      expect(portfolio.expiringSoon).toBe(0);
      expect(portfolio.overdue).toBe(0);
    });

    it('should exclude all non-ACTIVE students from portfolio', () => {
      const students = [
        { id: 1, status: 'CHECKED_OUT', coverage_end: '2026-07-01' },
        { id: 2, status: 'VACATED', coverage_end: '2026-07-01' }
      ];

      const portfolio = classifyPortfolio(students);

      expect(portfolio.total).toBe(0);
      expect(portfolio.current).toBe(0);
      expect(portfolio.details).toHaveLength(0);
    });

    it('should return portfolio details with student and classification', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      const students = [
        { id: 1, name: 'Test Student', status: 'ACTIVE', coverage_end: futureDate.toISOString().split('T')[0] }
      ];

      const portfolio = classifyPortfolio(students);

      expect(portfolio.details[0]).toHaveProperty('student');
      expect(portfolio.details[0]).toHaveProperty('classification');
      expect(portfolio.details[0].student.id).toBe(1);
      expect(portfolio.details[0].classification.status).toBe('CURRENT');
    });
  });

  describe('getStatusBadgeConfig - Badge configuration', () => {
    it('should return correct config for CURRENT status', () => {
      const config = getStatusBadgeConfig('CURRENT');

      expect(config.label).toBe('Current');
      expect(config.color).toBe('#22C55E');
      expect(config.bg).toBe('#22C55E20');
    });

    it('should return correct config for EXPIRING_SOON status', () => {
      const config = getStatusBadgeConfig('EXPIRING_SOON');

      expect(config.label).toBe('Expiring Soon');
      expect(config.color).toBe('#F59E0B');
    });

    it('should return correct config for OVERDUE status', () => {
      const config = getStatusBadgeConfig('OVERDUE');

      expect(config.label).toBe('Overdue');
      expect(config.color).toBe('#EF4444');
    });

    it('should return correct config for DUE_TODAY status', () => {
      const config = getStatusBadgeConfig('DUE_TODAY');

      expect(config.label).toBe('Due Today');
      expect(config.color).toBe('#F97316');
    });

    it('should return correct config for EXCLUDED status', () => {
      const config = getStatusBadgeConfig('EXCLUDED');

      expect(config.label).toBe('Inactive');
      expect(config.color).toBe('#6B7280');
    });

    it('should return default config for unknown status', () => {
      const config = getStatusBadgeConfig('UNKNOWN_STATUS');

      expect(config.label).toBe('UNKNOWN_STATUS');
      expect(config.color).toBe('#6B7280');
    });
  });
});
