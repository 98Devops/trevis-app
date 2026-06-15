/**
 * TD-6: Duplicate Payment Protection (service-layer idempotency)
 *
 * BUSINESS RISK REMOVED:
 *   The PaymentModal Confirm button had no in-flight guard, so a fast double-click fired
 *   recordPaymentWithCoverage twice and created two payment rows. The deterministic
 *   coverage rebuild then faithfully summed BOTH payments, inflating the student's
 *   coverage. This test covers the service-layer defense-in-depth: an identical payment
 *   (same student/amount/date) recorded within a short window is treated as an accidental
 *   double-submit and suppressed, so coverage is never inflated even if the UI guard is
 *   bypassed (race condition / programmatic re-call).
 *
 * (The UI in-flight guards on create/edit/delete are exercised manually per the stage doc;
 *  edit is additionally protected by InlineEditField's built-in isSaving re-entrancy guard.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  isConfigured: true,
}));

// Keep the rebuild a no-op success so we isolate the dedup behavior.
vi.mock('./paymentProcessor.js', () => ({ processPayment: vi.fn() }));
vi.mock('./statusClassifier.js', () => ({ classifyPortfolio: vi.fn() }));

const { supabase } = await import('../lib/supabase');
const { recordPaymentWithCoverage } = await import('./coverageDatabaseService.js');

const PARAMS = {
  studentId: 'stu-1',
  amount: 130,
  paymentDate: '2026-06-15',
  paymentMethod: 'Cash',
  receiptNumber: null,
  notes: null,
  recordedBy: 'user-1',
};

describe('TD-6: duplicate payment protection in recordPaymentWithCoverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suppresses an identical payment recorded within the dedup window (no second insert)', async () => {
    const existing = { id: 'pay-existing', student_id: 'stu-1', amount: 130, payment_date: '2026-06-15' };

    // The dedup lookup chain returns a recent identical payment.
    const dupLookupChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [existing], error: null }),
    };
    const insertSpy = vi.fn();

    supabase.from.mockImplementation(() => ({
      ...dupLookupChain,
      insert: insertSpy, // should never be called
    }));

    const result = await recordPaymentWithCoverage(PARAMS);

    expect(result.duplicateSuppressed).toBe(true);
    expect(result.payment).toEqual(existing);
    expect(insertSpy).not.toHaveBeenCalled(); // critical: no duplicate row created
  });

  it('inserts normally when no recent duplicate exists', async () => {
    const inserted = { id: 'pay-new', student_id: 'stu-1', amount: 130, payment_date: '2026-06-15' };

    // First .from() call = dedup lookup (returns empty); second = insert chain.
    const dupLookupChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
    };

    let call = 0;
    supabase.from.mockImplementation(() => {
      call += 1;
      return call === 1 ? dupLookupChain : insertChain;
    });

    const result = await recordPaymentWithCoverage(PARAMS);

    expect(result.duplicateSuppressed).toBeUndefined();
    expect(result.payment).toEqual(inserted);
    expect(insertChain.insert).toHaveBeenCalledTimes(1);
  });
});
