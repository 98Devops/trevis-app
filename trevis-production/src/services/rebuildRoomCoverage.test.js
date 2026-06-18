/**
 * Tests for rebuildRoomCoverage (Phase 4C-A #5) — the rent-edit fan-out.
 * Verifies it rebuilds EVERY active student in a room and aggregates failures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB layer and the single-student rebuild.
vi.mock('../lib/supabase.js', () => ({
  supabase: { from: vi.fn() },
}));
vi.mock('./coverageDatabaseService.js', () => ({
  rebuildStudentCoverage: vi.fn(),
}));

const { supabase } = await import('../lib/supabase.js');
const { rebuildStudentCoverage } = await import('./coverageDatabaseService.js');
const { rebuildRoomCoverage } = await import('./coverageRepairService.js');

// Build a chain that resolves the .select().eq().eq() => { data, error }
function studentsResult(data, error = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    then: (resolve) => resolve({ data, error }),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rebuildRoomCoverage', () => {
  it('rebuilds every ACTIVE student in the room', async () => {
    supabase.from.mockReturnValue(
      studentsResult([{ id: 's1', full_name: 'A' }, { id: 's2', full_name: 'B' }])
    );
    rebuildStudentCoverage.mockResolvedValue({ coverage_end: '2026-08-01' });

    const r = await rebuildRoomCoverage('room-1');

    expect(rebuildStudentCoverage).toHaveBeenCalledTimes(2);
    expect(rebuildStudentCoverage).toHaveBeenCalledWith('s1');
    expect(rebuildStudentCoverage).toHaveBeenCalledWith('s2');
    expect(r).toEqual({ success: true, rebuilt: 2, failed: 0, errors: [] });
  });

  it('reports success with 0 rebuilt when the room has no active students', async () => {
    supabase.from.mockReturnValue(studentsResult([]));
    const r = await rebuildRoomCoverage('empty-room');
    expect(rebuildStudentCoverage).not.toHaveBeenCalled();
    expect(r).toEqual({ success: true, rebuilt: 0, failed: 0, errors: [] });
  });

  it('aggregates per-student failures without aborting the rest', async () => {
    supabase.from.mockReturnValue(
      studentsResult([{ id: 's1', full_name: 'A' }, { id: 's2', full_name: 'B' }])
    );
    rebuildStudentCoverage
      .mockResolvedValueOnce({ coverage_end: '2026-08-01' }) // s1 ok
      .mockRejectedValueOnce(new Error('boom'));             // s2 fails

    const r = await rebuildRoomCoverage('room-1');

    expect(r.success).toBe(false);
    expect(r.rebuilt).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.errors[0]).toContain('B: boom');
  });

  it('returns an error when the student query fails', async () => {
    supabase.from.mockReturnValue(studentsResult(null, { message: 'db down' }));
    const r = await rebuildRoomCoverage('room-1');
    expect(r.success).toBe(false);
    expect(r.errors).toEqual(['db down']);
  });

  it('guards against a missing roomId', async () => {
    const r = await rebuildRoomCoverage(null);
    expect(r.success).toBe(false);
    expect(rebuildStudentCoverage).not.toHaveBeenCalled();
  });
});
