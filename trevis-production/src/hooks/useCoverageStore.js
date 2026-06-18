/**
 * useCoverageStore — single app-level coverage source (Phase 4C-C).
 *
 * Replaces the two parallel fetch paths (dashboard's getAllStudentsCoverage +
 * PropertyDetail's per-student N+1 loop) with ONE fetch shared everywhere.
 * Resolves TD-7 (N+1 cold fetch), TD-9 (duplicate dashboard query), and PERF-3
 * (PropertyDetail re-fetching what the dashboard already loaded). Invalidation
 * is a single refresh of the one store (vs the scattered `new Map()` resets).
 *
 * Exposes:
 *   students      — raw getAllStudentsCoverage() rows (dashboard/attention use these)
 *   coverageMap   — Map<studentId, classifyStudent(row)>  (PropertyDetail/room rows)
 *   loading       — true during the initial/refresh fetch
 *   refresh()     — re-fetch after a mutation (replaces cache invalidation)
 *
 * @module useCoverageStore
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as CoverageDB from '../services/coverageDatabaseService.js';
import { classifyStudent } from '../services/statusClassifier.js';

export function useCoverageStore(enabled = true) {
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const cancelledRef = useRef(false);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    cancelledRef.current = false;
    setLoading(true);
    CoverageDB.getAllStudentsCoverage()
      .then((data) => {
        if (!cancelledRef.current) setStudents(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelledRef.current) setStudents([]); })
      .finally(() => { if (!cancelledRef.current) setLoading(false); });
    return () => { cancelledRef.current = true; };
  }, [enabled, nonce]);

  // Derive the studentId → classification map once per fetch (the shape the
  // property/room views already consume). Only ACTIVE students classify to a
  // real status; others are EXCLUDED (and naturally skipped by the room rows).
  const coverageMap = useMemo(() => {
    const m = new Map();
    (students || []).forEach((s) => {
      m.set(s.id, classifyStudent(s));
    });
    return m;
  }, [students]);

  return { students, coverageMap, loading, refresh };
}
