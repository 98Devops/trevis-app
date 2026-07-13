import { Panel } from "./panel";
import { StatCard } from "./stat-card";
import { DeltaPill } from "./delta-pill";
import { MonthlyTrend } from "./monthly-trend";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { money, moneyCompact } from "./fmt";
import { usePortfolio } from "./use-portfolio";
import { DataQuality } from "./data-quality";
import { downloadCsv, timestamp } from "@/lib/csv";
import { toast } from "sonner";
// Engine module (brief §3) — consumed without modification.
import { useAuth } from "@/parts/p1_imports_context.jsx";

export function Reports() {
  const { properties, totals, monthlyTrend } = usePortfolio();
  const auth = useAuth() as unknown as { user?: { role?: string } | null } | null;
  const isAdmin = auth?.user?.role?.toUpperCase() === "ADMIN";

  const best = [...monthlyTrend].sort((a, b) => b.collected - a.collected)[0];
  const total12mo = monthlyTrend.reduce((s, m) => s + m.collected, 0);

  const exportPortfolioCsv = () => {
    if (properties.length === 0) {
      toast.info("Nothing to export", { description: "Add a property first." });
      return;
    }
    const headers = ["Property", "Location", "Rooms", "Tenants", "Bed capacity", "Vacant", "Occupancy %", "Collected", "Expected", "Outstanding", "Rate %"] as const;
    const rows = properties.map((p) => {
      const rate = p.expected > 0 ? Math.round((p.collected / p.expected) * 100) : 0;
      const occ = p.totalBeds > 0 ? Math.round(((p.totalBeds - p.vacantBeds) / p.totalBeds) * 100) : 0;
      return [p.name, p.location, p.rooms.length, p.students, p.totalBeds, p.vacantBeds, occ, p.collected, p.expected, Math.max(0, p.expected - p.collected), rate];
    });
    downloadCsv(`PropNest_portfolio_${timestamp()}.csv`, headers, rows);
    toast.success("Portfolio CSV downloaded", { description: `${rows.length} propert${rows.length === 1 ? "y" : "ies"} exported.` });
  };

  const exportMonthlyCsv = () => {
    const headers = ["Month", "Collected"] as const;
    const rows = monthlyTrend.map((m) => [`${m.key} (${m.label})`, m.collected]);
    downloadCsv(`PropNest_monthly_${timestamp()}.csv`, headers, rows);
    toast.success("Monthly trend CSV downloaded", { description: `${rows.length} months exported.` });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">Reports</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio-wide performance snapshot for the past 12 months.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportMonthlyCsv}>
            <Download /> Monthly CSV
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          featured
          label="12-month collected"
          value={moneyCompact(total12mo)}
          caption="Payments received, last 12 months"
        />
        <StatCard
          label="This month"
          value={money(totals.collected)}
          delta={<DeltaPill tone={totals.collectionRate >= 90 ? "positive" : "neutral"}>{totals.collectionRate}%</DeltaPill>}
          caption="vs expected"
          progress={totals.collectionRate}
        />
        <StatCard
          label="Best month"
          value={best ? moneyCompact(best.collected) : "—"}
          caption={best ? best.label : "no data yet"}
        />
        <StatCard
          label="Properties"
          value={String(properties.length)}
          caption={
            totals.overCapacity > 0
              ? `${totals.occupiedBeds} of ${totals.totalBeds} beds · ${totals.overCapacity} over capacity`
              : `${totals.occupiedBeds} of ${totals.totalBeds} beds`
          }
          progress={totals.occupancyRate}
        />
      </section>

      <MonthlyTrend />

      <Panel>
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">By property</h3>
            <p className="text-xs text-muted-foreground">Per-property snapshot for the current month.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportPortfolioCsv}>
            <Download /> Export CSV
          </Button>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-5">Property</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right tabular-nums">Rooms</TableHead>
              <TableHead className="text-right tabular-nums">Tenants</TableHead>
              <TableHead className="text-right tabular-nums">Vacant</TableHead>
              <TableHead className="text-right tabular-nums">Occ.</TableHead>
              <TableHead className="text-right tabular-nums">Collected</TableHead>
              <TableHead className="text-right tabular-nums">Expected</TableHead>
              <TableHead className="pe-5 text-right tabular-nums">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => {
              const pct = p.expected > 0 ? Math.round((p.collected / p.expected) * 100) : 0;
              // Bed occupancy is capped at capacity (occupied = min(tenants, beds));
              // the "Tenants X/Y" column above reveals any over-capacity headcount.
              const occupiedBeds = p.totalBeds - p.vacantBeds;
              const occ = p.totalBeds > 0 ? Math.round((occupiedBeds / p.totalBeds) * 100) : 0;
              return (
                <TableRow key={p.id} className="h-12">
                  <TableCell className="ps-5 font-medium" style={{ color: p.color }}>{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.location}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.rooms.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.students}/{p.totalBeds}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.vacantBeds}</TableCell>
                  <TableCell className="text-right tabular-nums">{occ}%</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.collected)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.expected)}</TableCell>
                  <TableCell className="pe-5 text-right tabular-nums font-semibold">{pct}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>

      {isAdmin && <DataQuality />}
    </div>
  );
}
