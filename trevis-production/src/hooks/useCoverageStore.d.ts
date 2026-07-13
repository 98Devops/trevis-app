/**
 * Typed contract for the single app-level coverage store (implementation in
 * useCoverageStore.js). One fetch shared by every coverage consumer.
 */

import type { Classification } from "../services/statusClassifier";

/** A getAllStudentsCoverage() row (extra fields tolerated via the index signature). */
export interface CoverageStoreRow {
  id: string;
  full_name?: string;
  status: string;
  coverage_start?: string | null;
  coverage_end?: string | null;
  daily_rate?: number | null;
  next_due_date?: string | null;
  rooms?: {
    rent_per_bed?: number;
    room_number?: string;
    properties?: { name?: string; color_accent?: string } | null;
  } | null;
  [key: string]: unknown;
}

export interface CoverageStore {
  students: CoverageStoreRow[] | null;
  coverageMap: Map<string, Classification>;
  loading: boolean;
  refresh: () => void;
}

export function useCoverageStore(enabled?: boolean): CoverageStore;
