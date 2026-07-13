import { createContext, useContext, useMemo, type ReactNode } from "react";
// Engine modules (brief §3) — consumed without modification.
import { useCoverageStore } from "@/hooks/useCoverageStore.js";
import { classifyStudent } from "@/services/statusClassifier.js";
import { buildAttentionList, countAttentionByProperty, buildFinanceRecords } from "@/services/dashboardAttention.js";
import { isConfigured } from "@/lib/supabase";

/**
 * Single app-level coverage source — mirrors legacy's one shared store (Phase 4C-C).
 * Every coverage consumer (dashboard, finance, tenants, property detail, calendar,
 * settings) reads from THIS provider, so they all see the same classification and
 * can never disagree about a tenant's status — the legacy TD-2 invariant.
 */

type CoverageStatus = "CURRENT" | "EXPIRING_SOON" | "DUE_TODAY" | "OVERDUE" | "EXCLUDED";

type Classification = {
  status: string;
  excludeFromMetrics?: boolean;
  displayLabel?: string;
  daysRemaining?: number;
  daysOverdue?: number;
  coverageEnd?: string;
};

export type AttentionRow = {
  id: string;
  name: string;
  property: string;
  propertyColor: string | null;
  room: string;
  roomRent: number;
  dailyRate: number;
  coverageEnd: string | null;
  coverageStatus: string;
  daysLabel: string;
  daysRemaining: number | null;
  daysOverdue: number | null;
  outstanding: number;
  source: "coverage";
};

type CoverageStore = {
  students: unknown[] | null;
  coverageMap: Map<string, Classification>;
  loading: boolean;
  /** Non-null when the coverage fetch failed (after retries) — show a banner, not silent zeros. */
  error: string | null;
  refresh: () => void;
};

const CoverageCtx = createContext<CoverageStore | null>(null);

export function CoverageProvider({ children }: { children: ReactNode }) {
  const store = useCoverageStore(isConfigured) as unknown as CoverageStore;
  return <CoverageCtx.Provider value={store}>{children}</CoverageCtx.Provider>;
}

function useCoverageStoreCtx(): CoverageStore {
  const v = useContext(CoverageCtx);
  if (!v) {
    throw new Error("usePortfolioCoverage/usePortfolioAttention must be used within <CoverageProvider>");
  }
  return v;
}

/** The shared coverage map (id → classifyStudent result), as before. */
export function usePortfolioCoverage() {
  return useCoverageStoreCtx();
}

/**
 * Coverage-derived attention — the SINGLE source of truth for "who needs
 * follow-up", reusing the same engine services the legacy dashboard uses
 * (buildAttentionList / countAttentionByProperty). A tenant needs attention when
 * coverage is OVERDUE / DUE_TODAY / EXPIRING_SOON. Returns the list (sorted by
 * outstanding, desc), the per-property counts, the total count, the total
 * coverage outstanding, and the whole-portfolio status counts for the KPI strip.
 */
export function usePortfolioAttention() {
  const { students, loading } = useCoverageStoreCtx();

  return useMemo(() => {
    // Engine rows are untyped (.js) — treat as any[] at this single boundary.
    const list = (students ?? []) as unknown[] as Array<Record<string, unknown>>;
    const rows = buildAttentionList(list) as AttentionRow[];
    rows.sort((a, b) => b.outstanding - a.outstanding);

    const byProperty = countAttentionByProperty(rows) as Record<string, number>;
    const totalOutstanding = rows.reduce((a, r) => a + r.outstanding, 0);

    const statusCounts: Record<CoverageStatus, number> & { total: number } = {
      CURRENT: 0, EXPIRING_SOON: 0, DUE_TODAY: 0, OVERDUE: 0, EXCLUDED: 0, total: 0,
    };
    for (const s of list) {
      const c = classifyStudent(s as Parameters<typeof classifyStudent>[0]) as Classification;
      if (c.excludeFromMetrics) continue;
      statusCounts.total += 1;
      const st = c.status as CoverageStatus;
      if (statusCounts[st] !== undefined) statusCounts[st] += 1;
    }

    return {
      rows,
      byProperty,
      count: rows.length,
      totalOutstanding,
      statusCounts,
      ready: Array.isArray(students),
      loading,
    };
  }, [students, loading]);
}

/**
 * Every ACTIVE tenant as a coverage record (status / outstanding / days / coverage
 * end), via the same engine builder the legacy Finances page uses. The Finance
 * screen filters and sorts these itself, so its status chips and amounts can never
 * disagree with the dashboard.
 */
export function usePortfolioFinance() {
  const { students, loading } = useCoverageStoreCtx();
  return useMemo(() => {
    const list = (students ?? []) as unknown[] as Array<Record<string, unknown>>;
    const records = buildFinanceRecords(list) as AttentionRow[];
    return { records, ready: Array.isArray(students), loading };
  }, [students, loading]);
}
