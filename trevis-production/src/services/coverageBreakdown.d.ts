/**
 * Typed contract for the coverage-breakdown engine (implementation in
 * coverageBreakdown.js). Display-only replay of the ledger through processPayment;
 * always agrees with rebuildStudentCoverage by construction. Date strings are local
 * ISO (yyyy-mm-dd); labels are null only when the underlying date is missing.
 */

export interface CoverageStep {
  amount: number;
  date: string | null;
  dateLabel: string | null;
  days: number;
  start: string | null;
  end: string | null;
  endLabel: string | null;
  isEarly: boolean;
  prepaidDaysPreserved: number;
  line: string;
}

export interface CoverageChain {
  steps: CoverageStep[];
  start: string | null;
  end: string | null;
  days: number;
  startLabel: string | null;
  endLabel: string | null;
  isCurrent: boolean;
}

export interface CoverageBreakdownResult {
  steps: CoverageStep[];
  chains: CoverageChain[];
  totalDays: number;
  coverageEnd: string | null;
  coverageEndLabel: string | null;
  firstStart: string | null;
}

export function buildCoverageBreakdown(
  payments: Array<{ amount: number | string; payment_date: string | Date }>,
  monthlyRent: number,
): CoverageBreakdownResult;
