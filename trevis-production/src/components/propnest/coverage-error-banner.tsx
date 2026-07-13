import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioCoverage } from "./coverage-context";

/**
 * Shown (on every screen) when the shared coverage fetch failed after retries.
 * Without this, a failed fetch used to render a dashboard of silent zeros —
 * indistinguishable from data loss. Offers a one-click retry.
 */
export function CoverageErrorBanner() {
  const { error, loading, refresh } = usePortfolioCoverage();
  if (!error || loading) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
      <AlertTriangleIcon className="size-4 shrink-0" />
      <span className="flex-1">
        Couldn&apos;t load portfolio data — the numbers below may be incomplete. ({error})
      </span>
      <Button size="sm" variant="outline" onClick={refresh}>
        <RefreshCwIcon className="size-3.5" /> Retry
      </Button>
    </div>
  );
}
