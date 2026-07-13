import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchIcon } from "lucide-react";
import { Panel } from "./panel";
import { StatCard } from "./stat-card";
import { DeltaPill } from "./delta-pill";
import { CoverageStatusBadge, coverageSubLabel } from "./coverage";
import { money } from "./fmt";
import { usePortfolio, usePortfolioCoverage, usePortfolioAttention } from "./use-portfolio";
import { useNav } from "@/lib/propnest-nav";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "OVERDUE" | "EXPIRING_SOON" | "DUE_TODAY" | "CURRENT";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL",            label: "All" },
  { key: "OVERDUE",        label: "Overdue" },
  { key: "DUE_TODAY",      label: "Due today" },
  { key: "EXPIRING_SOON",  label: "Expiring soon" },
  { key: "CURRENT",        label: "Current" },
];

export function Tenants() {
  const { allTenants, totals } = usePortfolio();
  const { coverageMap, loading } = usePortfolioCoverage();
  const { count: attentionCount, totalOutstanding } = usePortfolioAttention();
  const { openProperty, openTenant } = useNav();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTenants
      .map((t) => ({ ...t, coverage: coverageMap.get(t.id) ?? null }))
      .filter((t) => {
        if (q && !(t.name.toLowerCase().includes(q) || t.property.toLowerCase().includes(q) || t.room.toLowerCase().includes(q))) return false;
        if (filter !== "ALL") {
          const status = t.coverage?.status ?? "EXCLUDED";
          if (status !== filter) return false;
        }
        return true;
      });
  }, [allTenants, coverageMap, search, filter]);


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">Tenants</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {allTenants.length} active tenant{allTenants.length === 1 ? "" : "s"} across {totals.totalBeds} bed{totals.totalBeds === 1 ? "" : "s"}
            {loading && <span className="ml-2 italic">· loading coverage…</span>}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          featured
          label="Active tenants"
          value={String(allTenants.length)}
          caption={`${totals.occupancyRate}% occupancy`}
          progress={totals.occupancyRate}
        />
        <StatCard
          label="Coverage current"
          value={String(Math.max(0, allTenants.length - attentionCount))}
          caption="paid through future"
        />
        <StatCard
          label="Needs attention"
          value={String(attentionCount)}
          delta={attentionCount > 0
            ? <DeltaPill tone="negative">{attentionCount}</DeltaPill>
            : <DeltaPill tone="positive">0</DeltaPill>}
          caption={attentionCount === 0 ? "All up to date" : "Overdue / due today / expiring soon"}
        />
        <StatCard
          label="Outstanding (coverage)"
          value={money(totalOutstanding)}
          caption="Days overdue × daily rate"
        />
      </section>

      <Panel>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-brand-gradient border-transparent text-white shadow-sm"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants, property, room…"
              className="pl-9"
            />
          </div>
        </header>
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">Tenant</TableHead>
                <TableHead>Property / Room</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead className="text-right tabular-nums">Rent</TableHead>
                <TableHead className="pe-5 text-right tabular-nums">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                    No tenants match your filter.
                  </TableCell>
                </TableRow>
              ) : rows.map((t) => (
                <TableRow key={t.id} className="h-12">
                  <TableCell className="ps-5 font-medium">
                    <button
                      type="button"
                      onClick={() => openTenant(t.id)}
                      className="text-left hover:underline"
                    >
                      {t.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openProperty(t.propertyId)}
                      className="text-left text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="font-medium" style={{ color: t.propertyColor }}>{t.property}</span>
                      <span className="text-muted-foreground/70"> · {t.room}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CoverageStatusBadge coverage={t.coverage} />
                      <span className="text-xs text-muted-foreground">{coverageSubLabel(t.coverage)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.rent)}</TableCell>
                  <TableCell className="pe-5 text-right tabular-nums">
                    <span className={cn(
                      "font-semibold",
                      t.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                    )}>{money(t.balance)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
