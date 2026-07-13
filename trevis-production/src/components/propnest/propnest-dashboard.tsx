import { PropNestStats } from "./stats";
import { CoverageStrip } from "./coverage-strip";
import { PropNestAttention } from "./attention";
import { PropNestActivity } from "./activity";
import { PropertyMix } from "./property-mix";
import { MonthlyTrend } from "./monthly-trend";

export function PropNestDashboard() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">Portfolio</span> overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Coverage, collection, and tenants needing attention — all live.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PropNestStats />
      </section>

      <CoverageStrip />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <PropertyMix />
          <MonthlyTrend />
        </div>
        <PropNestActivity />
      </section>

      <section className="grid grid-cols-1 gap-4">
        <PropNestAttention />
      </section>
    </div>
  );
}
