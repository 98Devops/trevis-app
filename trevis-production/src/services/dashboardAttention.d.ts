/**
 * Typed contract for the coverage-views engine (implementation in
 * dashboardAttention.js). Declares every export so the .js consumers that import
 * from it keep resolving. The single coverage-row shape (CoverageRow) is the one
 * the Dashboard Attention table and the Finances page both consume.
 */

import type { Classification } from "./statusClassifier";

/** The one row shape shared by every coverage view (Dashboard / Finances). */
export interface CoverageRow {
  id: string;
  name: string;
  property: string;
  propertyColor: string | null;
  room: string;
  roomRent: number;
  dailyRate: number;
  coverageEnd: string | null;
  /** A CoverageStatus value, kept as string for friction-free downstream compares. */
  coverageStatus: string;
  daysLabel: string;
  daysRemaining: number | null;
  daysOverdue: number | null;
  outstanding: number;
  source: "coverage";
}

export const ATTENTION_STATUSES: string[];

export function coverageOutstanding(
  classification: Classification,
  dailyRate: number | string | null,
): number;

export function buildAttentionList(coverageStudents: unknown[]): CoverageRow[];
export function buildFinanceRecords(coverageStudents: unknown[]): CoverageRow[];

export const FINANCE_STATUS_FILTERS: string[];

export function filterFinanceRecords(records: CoverageRow[], status: string): CoverageRow[];
export function sortByCoverageEnd(records: CoverageRow[]): CoverageRow[];
export function countAttentionByProperty(attentionRows: CoverageRow[]): Record<string, number>;
