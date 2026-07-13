import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Panel } from "./panel";
import { CoverageStatusBadge } from "./coverage";
import { usePortfolioAttention } from "./coverage-context";
import { useNav } from "@/lib/propnest-nav";
import { money } from "./fmt";

/**
 * Dashboard "Needs attention" — coverage-derived (legacy TD-2): a tenant appears
 * when their coverage is OVERDUE / DUE_TODAY / EXPIRING_SOON, sorted by coverage
 * outstanding (days overdue × daily rate). Same engine the Finance & Tenants
 * screens read, so the count here can never disagree with them.
 */
export function PropNestAttention() {
  const { rows, count, loading } = usePortfolioAttention();
  const { openTenant } = useNav();
  const top = rows.slice(0, 8);

  return (
    <Panel className="md:col-span-2">
      <header className="flex items-baseline justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Needs attention</h3>
          <p className="text-xs text-muted-foreground">
            Coverage overdue, due today, or expiring within 7 days.
            {loading && <span className="ml-1 italic">· loading…</span>}
          </p>
        </div>
        {count > 0 && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            {count}
          </span>
        )}
      </header>
      <div>
        <Table>
          <TableCaption className="sr-only">
            Tenants requiring attention, sorted by coverage outstanding.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-5">Tenant</TableHead>
              <TableHead>Property / Room</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pe-5 text-right tabular-nums">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {count === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                  Nothing outstanding. Coverage is up to date. 🎉
                </TableCell>
              </TableRow>
            ) : top.map((row) => (
              <TableRow className="h-12" key={row.id}>
                <TableCell className="max-w-40 truncate ps-5 font-medium">
                  <button type="button" onClick={() => openTenant(row.id)} className="text-left hover:underline">
                    {row.name}
                  </button>
                  {row.daysLabel && (
                    <span className="ml-2 text-xs text-muted-foreground">{row.daysLabel}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="font-medium" style={{ color: row.propertyColor ?? undefined }}>{row.property}</span>
                  <span className="text-muted-foreground/70"> · {row.room}</span>
                </TableCell>
                <TableCell>
                  <CoverageStatusBadge coverage={{ status: row.coverageStatus }} />
                </TableCell>
                <TableCell className="pe-5 text-right tabular-nums font-semibold">
                  {row.outstanding > 0 ? money(row.outstanding) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {count > top.length && (
          <div className="border-t px-5 py-2 text-center text-xs text-muted-foreground">
            +{count - top.length} more · see Finance for the full ledger
          </div>
        )}
      </div>
    </Panel>
  );
}
