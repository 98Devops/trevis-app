import { Panel } from "./panel";
import { usePortfolio } from "./use-portfolio";
import { moneyCompact } from "./fmt";
import { useNav } from "@/lib/propnest-nav";

export function PropertyMix() {
  const { properties } = usePortfolio();
  const { openProperty } = useNav();
  const max = Math.max(1, ...properties.map((p) => p.expected));

  return (
    <Panel className="md:col-span-2">
      <header className="border-b px-5 py-4">
        <h3 className="text-base font-semibold text-foreground">Collection by property</h3>
        <p className="text-xs text-muted-foreground">Collected vs. expected for the current month.</p>
      </header>
      <div className="space-y-4 px-5 py-5">
        {properties.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No properties yet.
          </div>
        ) : properties.map((p) => {
          const pct = p.expected > 0 ? Math.round((p.collected / p.expected) * 100) : 0;
          const widthPct = Math.round((p.expected / max) * 100);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openProperty(p.id)}
              className="-m-1 block w-full space-y-1.5 rounded-md p-1 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {moneyCompact(p.collected)} <span className="text-muted-foreground/60">/ {moneyCompact(p.expected)}</span>
                  <span className="ms-2 font-semibold text-foreground">{pct}%</span>
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" style={{ maxWidth: `${widthPct}%` }}>
                <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
