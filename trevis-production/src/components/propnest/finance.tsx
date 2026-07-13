import { useMemo, useState } from "react";
import { Panel } from "./panel";
import { StatCard } from "./stat-card";
import { DeltaPill } from "./delta-pill";
import { MonthlyTrend } from "./monthly-trend";
import { CoverageStatusBadge, coverageSubLabel } from "./coverage";
import { money } from "./fmt";
import { usePortfolio } from "./use-portfolio";
import { usePortfolioFinance, type AttentionRow } from "./coverage-context";
import { useNav } from "@/lib/propnest-nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCsv, timestamp } from "@/lib/csv";
import { toast } from "sonner";
// Engine modules (brief §3) — exact legacy filter/sort semantics, no re-derivation.
import { filterFinanceRecords, sortByCoverageEnd } from "@/services/dashboardAttention.js";

type Filter = "ALL" | "OVERDUE" | "DUE_TODAY" | "EXPIRING_SOON" | "CURRENT";

const FILTERS: { key: Filter; label: string; tone: string }[] = [
  { key: "ALL",            label: "All",           tone: "text-muted-foreground" },
  { key: "OVERDUE",        label: "Overdue",       tone: "text-rose-600 dark:text-rose-400" },
  { key: "DUE_TODAY",      label: "Due today",     tone: "text-orange-600 dark:text-orange-400" },
  { key: "EXPIRING_SOON",  label: "Expiring soon", tone: "text-amber-600 dark:text-amber-400" },
  { key: "CURRENT",        label: "Current",       tone: "text-emerald-600 dark:text-emerald-400" },
];

export function Finance() {
  const { totals } = usePortfolio();
  const { records, loading } = usePortfolioFinance();
  const { openTenant } = useNav();

  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Per-status counts + outstanding (coverage), for the chips and the summary cards.
  const buckets = useMemo(() => {
    const m: Record<string, { count: number; balance: number }> = {
      ALL: { count: records.length, balance: 0 },
      OVERDUE: { count: 0, balance: 0 },
      DUE_TODAY: { count: 0, balance: 0 },
      EXPIRING_SOON: { count: 0, balance: 0 },
      CURRENT: { count: 0, balance: 0 },
    };
    for (const r of records) {
      m.ALL.balance += r.outstanding;
      const b = m[r.coverageStatus];
      if (b) { b.count += 1; b.balance += r.outstanding; }
    }
    return m;
  }, [records]);

  const filtered = useMemo(() => {
    let list = filterFinanceRecords(records, filter) as AttentionRow[];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.property.toLowerCase().includes(q) ||
          String(r.room).toLowerCase().includes(q),
      );
    }
    return sortByCoverageEnd(list) as AttentionRow[];
  }, [records, filter, search]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      if (filtered.every((r) => prev.has(r.id))) return new Set();
      return new Set(filtered.map((r) => r.id));
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const exportSelected = () => {
    const rows = filtered.filter((r) => selected.has(r.id));
    if (rows.length === 0) return;
    const headers = ["Tenant", "Property", "Room", "Monthly rent", "Daily rate", "Coverage ends", "Status", "Days", "Outstanding"] as const;
    const body = rows.map((r) => [
      r.name, r.property, r.room, r.roomRent, r.dailyRate, r.coverageEnd ?? "", r.coverageStatus, r.daysLabel, r.outstanding,
    ]);
    downloadCsv(`PropNest_finance_${timestamp()}.csv`, headers, body);
    toast.success("Selection exported", { description: `${rows.length} tenant${rows.length === 1 ? "" : "s"} exported.` });
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">Finance</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collection performance and the coverage ledger across the portfolio.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          featured
          label="Collected"
          value={money(totals.collected)}
          delta={<DeltaPill tone={totals.collectionRate >= 90 ? "positive" : "neutral"}>{totals.collectionRate}%</DeltaPill>}
          caption={`of ${money(totals.expected)} expected this month`}
          progress={totals.collectionRate}
        />
        <StatCard
          label="Outstanding (coverage)"
          value={money(buckets.ALL.balance)}
          delta={buckets.ALL.balance > 0 ? <DeltaPill tone="negative">owed</DeltaPill> : <DeltaPill tone="positive">clear</DeltaPill>}
          caption="Days overdue × daily rate"
        />
        <StatCard
          label="Overdue tenants"
          value={String(buckets.OVERDUE.count)}
          caption={`${money(buckets.OVERDUE.balance)} outstanding`}
        />
        <StatCard
          label="Expiring soon"
          value={String(buckets.EXPIRING_SOON.count + buckets.DUE_TODAY.count)}
          caption="Within 7 days"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyTrend />
        <Panel>
          <header className="border-b px-5 py-4">
            <h3 className="text-base font-semibold text-foreground">Coverage mix</h3>
            <p className="text-xs text-muted-foreground">Where every active tenant currently sits.</p>
          </header>
          <div className="space-y-3 px-5 py-5">
            {[
              { key: "OVERDUE",       label: "Overdue",       tone: "bg-rose-500" },
              { key: "DUE_TODAY",     label: "Due today",     tone: "bg-orange-500" },
              { key: "EXPIRING_SOON", label: "Expiring soon", tone: "bg-amber-500" },
              { key: "CURRENT",       label: "Current",       tone: "bg-emerald-500" },
            ].map((b) => {
              const data = buckets[b.key]!;
              const pct = records.length > 0 ? Math.round((data.count / records.length) * 100) : 0;
              return (
                <div key={b.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{b.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{data.count}</span> · {money(data.balance)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`${b.tone} h-full rounded-full transition-[width]`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <Panel>
        <header className="space-y-3 border-b px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Coverage ledger</h3>
              <p className="text-xs text-muted-foreground">
                {filtered.length} of {records.length} active tenant{records.length === 1 ? "" : "s"} · soonest to expire first
                {loading && <span className="ml-1 italic">· loading…</span>}
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenant, property, room…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const b = buckets[f.key]!;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-brand-gradient border-transparent text-white shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {f.label} <span className={cn("tabular-nums", active ? "text-white/90" : "text-muted-foreground/70")}>({b.count})</span>
                </button>
              );
            })}
          </div>
        </header>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-5 py-2.5">
            <span className="text-xs font-medium text-foreground">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={exportSelected}>
              <Download /> Export selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <XIcon /> Clear
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-5 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="size-4 cursor-pointer accent-blue-600"
                />
              </TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Property / Room</TableHead>
              <TableHead>Coverage ends</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pe-5 text-right tabular-nums">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  {records.length === 0 ? "No active tenants yet." : "No tenants match your filter. 🎉"}
                </TableCell>
              </TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} className={cn("h-12", selected.has(r.id) && "bg-brand-blue/5")}>
                <TableCell className="ps-5">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Select ${r.name}`}
                    className="size-4 cursor-pointer accent-blue-600"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <button type="button" onClick={() => openTenant(r.id)} className="text-left hover:underline">
                    {r.name}
                  </button>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {money(r.roomRent)}/mo · {money(r.dailyRate)}/day
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="font-medium" style={{ color: r.propertyColor ?? undefined }}>{r.property}</span>
                  <span className="text-muted-foreground/70"> · {r.room}</span>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.coverageEnd ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CoverageStatusBadge coverage={{ status: r.coverageStatus }} />
                    <span className="text-xs text-muted-foreground">{coverageSubLabel({ status: r.coverageStatus, daysRemaining: r.daysRemaining ?? undefined, daysOverdue: r.daysOverdue ?? undefined })}</span>
                  </div>
                </TableCell>
                <TableCell className="pe-5 text-right tabular-nums">
                  <span className={cn("font-semibold", r.outstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                    {r.outstanding > 0 ? money(r.outstanding) : "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
