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
import { withRetry } from '../lib/withRetry.js';
import { reportError } from '../lib/sentry.js';

export function useCoverageStore(enabled = true) {
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const cancelledRef = useRef(false);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    cancelledRef.current = false;
    setLoading(true);
    // Strict fetch + retry: a transient network blip self-heals; a real failure
    // sets `error` (surfaced as a banner) instead of rendering a dashboard of
    // silent zeros indistinguishable from data loss. Last good data is KEPT so
    // an already-loaded portfolio doesn't blank out on a failed refresh.
    withRetry(async () => ({ data: await CoverageDB.getAllStudentsCoverageStrict(), error: null }))
      .then((res) => {
        if (cancelledRef.current) return;
        if (res?.error) {
          setError(res.error.message || String(res.error));
          reportError(res.error instanceof Error ? res.error : new Error(String(res.error)), { where: 'useCoverageStore.fetch' });
        } else {
          setStudents(Array.isArray(res?.data) ? res.data : []);
          setError(null);
        }
      })
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

  return { students, coverageMap, loading, error, refresh };
}
