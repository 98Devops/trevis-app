import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import { PropertyCard } from "./property-card";
import { PropertyDetail } from "./property-detail";
import { Panel } from "./panel";
import { usePortfolio, usePortfolioAttention } from "./use-portfolio";
import { useNav } from "@/lib/propnest-nav";

export function Properties() {
  const { properties, loading } = usePortfolio();
  // Coverage-derived attention per property (matches detail / dashboard / finance).
  const { byProperty } = usePortfolioAttention();
  const { selectedPropertyId, setSelectedPropertyId } = useNav();
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  );

  if (selected) {
    return <PropertyDetail property={selected} onBack={() => setSelectedPropertyId(null)} />;
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? properties.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q),
      )
    : properties;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">Properties</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {properties.length} propert{properties.length === 1 ? "y" : "ies"} in the portfolio
            {loading && <span className="ml-2 italic">· loading…</span>}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search properties…"
            className="pl-9"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <Panel>
          <div className="py-12 text-center text-sm text-muted-foreground">
            {properties.length === 0
              ? "No properties yet."
              : "No properties match your search."}
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              attentionCount={byProperty[p.name] ?? 0}
              onClick={() => setSelectedPropertyId(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
