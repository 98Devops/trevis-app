/**
 * Typed contract for the status classifier engine (implementation in
 * statusClassifier.js). Hand-written to match the JS exactly — the JS remains the
 * single source of truth; this file only makes the TS layer's reads compile-checked
 * instead of `as unknown as`. Keep in sync with statusClassifier.js if its outputs
 * ever change (covered by __tests__/statusClassifier.test.js).
 */

export type CoverageStatus =
  | "CURRENT"
  | "EXPIRING_SOON"
  | "DUE_TODAY"
  | "OVERDUE"
  | "EXCLUDED";

/** Minimal student shape the classifier reads (extra fields are ignored). */
export interface StudentCoverageInput {
  id?: string;
  status: string;
  coverage_end?: string | Date | null;
  daily_rate?: number | string | null;
  [key: string]: unknown;
}

export interface Classification {
  status: CoverageStatus;
  excludeFromMetrics: boolean;
  daysRemaining: number | null;
  daysOverdue: number | null;
  displayLabel: string;
}

export function classifyStudent(student: StudentCoverageInput): Classification;

export interface PortfolioClassification {
  total: number;
  current: number;
  expiringSoon: number;
  dueToday: number;
  overdue: number;
  details: Array<{ student: StudentCoverageInput; classification: Classification }>;
}

export function classifyPortfolio(students: StudentCoverageInput[]): PortfolioClassification;

export interface StatusBadgeConfig {
  label: string;
  color: string;
  bg: string;
}

export function getStatusBadgeConfig(status: string): StatusBadgeConfig;
