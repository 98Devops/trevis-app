import { Panel } from "./panel";
import { usePortfolioAttention } from "./coverage-context";
import { cn } from "@/lib/utils";

/**
 * Coverage status counts across the active portfolio — the metrics the legacy
 * dashboard led with (Total / Current / Expiring soon / Due today / Overdue),
 * read from the same coverage engine as every other screen.
 */
export function CoverageStrip() {
  const { statusCounts, loading } = usePortfolioAttention();

  const tiles: Array<{ label: string; value: number; tone: string; sub: string }> = [
    { label: "Active tenants", value: statusCounts.total,        tone: "text-foreground",                  sub: "with coverage" },
    { label: "Current",        value: statusCounts.CURRENT,      tone: "text-emerald-600 dark:text-emerald-400", sub: "7+ days left" },
    { label: "Expiring soon",  value: statusCounts.EXPIRING_SOON, tone: "text-amber-600 dark:text-amber-400",    sub: "1–7 days left" },
    { label: "Due today",      value: statusCounts.DUE_TODAY,    tone: "text-orange-600 dark:text-orange-400",  sub: "expires today" },
    { label: "Overdue",        value: statusCounts.OVERDUE,      tone: "text-rose-600 dark:text-rose-400",      sub: "coverage expired" },
  ];

  return (
    <Panel>
      <div className="grid grid-cols-2 divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {tiles.map((t) => (
          <div key={t.label} className="px-5 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className={cn("mt-1 text-2xl font-bold tabular-nums", t.tone)}>
              {loading ? "—" : t.value}
            </div>
            <div className="text-[11px] text-muted-foreground">{t.sub}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
