/**
 * TD-5: Coverage Rebuild Failure Surfacing
 *
 * BUSINESS RISK REMOVED:
 *   Before TD-5, updatePayment/deletePayment ran the post-mutation coverage rebuild
 *   inside a try/catch that swallowed the error and still returned a clean success.
 *   A payment edit/delete could therefore succeed while coverage silently went stale,
 *   and the user was told everything was fine. recordPaymentWithCoverage was worse: a
 *   rebuild throw bubbled up as a raw exception AFTER the payment row was already
 *   inserted.
 *
 * CONTRACT NOW UNDER TEST:
 *   - On rebuild SUCCESS: the mutation returns rebuildError == null/undefined.
 *   - On rebuild FAILURE: the mutation still reports the row write succeeded
 *     (error == null) but returns a non-null `rebuildError` so the UI can warn the
 *     user that coverage may be stale. It never throws the rebuild error away, and
 *     never reports a clean success when coverage failed to rebuild.
 *   - The rebuild is retried once before giving up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase so the payment-row write/delete "succeeds" deterministically.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  isConfigured: true,
}));

// Mock the coverage DB service so we can force rebuildStudentCoverage to throw / succeed.
vi.mock('./coverageDatabaseService.js', () => ({
  rebuildStudentCoverage: vi.fn(),
}));

const { supabase } = await import('../lib/supabase');
const { rebuildStudentCoverage } = await import('./coverageDatabaseService.js');
const { updatePayment, deletePayment } = await import('./paymentService.js');

// Helper: a supabase .from() chain whose terminal call resolves to {error:null}.
function okWriteChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { student_id: 'stu-1' }, error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

describe('TD-5: coverage rebuild failure is surfaced, never silent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updatePayment', () => {
    it('returns rebuildError when the coverage rebuild fails (no silent success)', async () => {
      // fetch student_id chain, then the update chain — both succeed
      supabase.from.mockReturnValue(okWriteChain());
      // Rebuild fails on both the initial attempt and the retry
      rebuildStudentCoverage.mockRejectedValue(new Error('rebuild boom'));

      const res = await updatePayment('pay-1', { amount: 130 }, 'tester');

      expect(res.error).toBeNull();          // the row write itself succeeded
      expect(res.data).toBe(true);
      expect(res.rebuildError).toBeTruthy();  // failure is surfaced, not swallowed
      expect(res.rebuildError.message).toContain('rebuild boom');
      // retried once → called exactly twice
      expect(rebuildStudentCoverage).toHaveBeenCalledTimes(2);
    });

    it('returns no rebuildError when the coverage rebuild succeeds', async () => {
      supabase.from.mockReturnValue(okWriteChain());
      rebuildStudentCoverage.mockResolvedValue({ coverage_end: '2026-08-01' });

      const res = await updatePayment('pay-1', { amount: 130 }, 'tester');

      expect(res.error).toBeNull();
      expect(res.data).toBe(true);
      expect(res.rebuildError).toBeNull();
      expect(rebuildStudentCoverage).toHaveBeenCalledTimes(1); // no retry needed
    });

    it('succeeds on the retry if the first rebuild attempt fails transiently', async () => {
      supabase.from.mockReturnValue(okWriteChain());
      rebuildStudentCoverage
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ coverage_end: '2026-08-01' });

      const res = await updatePayment('pay-1', { amount: 130 }, 'tester');

      expect(res.error).toBeNull();
      expect(res.rebuildError).toBeNull();    // recovered on retry
      expect(rebuildStudentCoverage).toHaveBeenCalledTimes(2);
    });
  });

  describe('deletePayment', () => {
    it('returns rebuildError when the coverage rebuild fails (no silent success)', async () => {
      supabase.from.mockReturnValue(okWriteChain());
      rebuildStudentCoverage.mockRejectedValue(new Error('delete rebuild boom'));

      const res = await deletePayment('pay-1');

      expect(res.error).toBeNull();          // the delete itself succeeded
      expect(res.data).toBe(true);
      expect(res.rebuildError).toBeTruthy();
      expect(res.rebuildError.message).toContain('delete rebuild boom');
      expect(rebuildStudentCoverage).toHaveBeenCalledTimes(2);
    });

    it('returns no rebuildError when the coverage rebuild succeeds', async () => {
      supabase.from.mockReturnValue(okWriteChain());
      rebuildStudentCoverage.mockResolvedValue({ coverage_end: null });

      const res = await deletePayment('pay-1');

      expect(res.error).toBeNull();
      expect(res.data).toBe(true);
      expect(res.rebuildError).toBeNull();
    });
  });
});
