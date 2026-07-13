import { Building2Icon, AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { moneyCompact } from "./fmt";
import type { PortfolioRow } from "./use-portfolio";

export function PropertyCard({
  property,
  attentionCount = 0,
  onClick,
}: {
  property: PortfolioRow;
  /**
   * Coverage-derived attention count for this property (OVERDUE / DUE_TODAY /
   * EXPIRING_SOON), supplied by the caller from usePortfolioAttention so the card
   * agrees with the property detail, dashboard, and finance — one definition of
   * "attention" across the app.
   */
  attentionCount?: number;
  onClick?: () => void;
}) {
  const pct = property.expected > 0
    ? Math.round((property.collected / property.expected) * 100)
    : 0;
  const occPct = property.totalBeds > 0
    ? Math.round((property.students / property.totalBeds) * 100)
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Brand stripe tinted by the property's own accent */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${property.color} 0%, var(--brand-purple) 100%)` }}
      />

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${property.color}1a`, color: property.color }}
              aria-hidden
            >
              <Building2Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{property.name}</div>
              <div className="truncate text-xs text-muted-foreground">{property.location}</div>
            </div>
          </div>
          {attentionCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
              <AlertCircleIcon className="size-3" />
              {attentionCount}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 border-t pt-3 text-xs">
          <MiniStat label="Rooms"   value={String(property.rooms.length)} />
          <MiniStat label="Tenants" value={`${property.students}/${property.totalBeds}`} />
          <MiniStat label="Vacant"  value={String(property.vacantBeds)} />
        </div>

        <ProgressLine
          label="Collection"
          pct={pct}
          right={
            <>
              {moneyCompact(property.collected)}
              <span className="text-muted-foreground/60"> / {moneyCompact(property.expected)}</span>
              <span className="ms-2 font-semibold text-foreground">{pct}%</span>
            </>
          }
          tone="gradient"
        />

        <ProgressLine
          label="Occupancy"
          pct={occPct}
          right={<span className="font-semibold text-foreground">{occPct}%</span>}
          tone="success"
        />
      </div>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function ProgressLine({
  label, pct, right, tone,
}: { label: string; pct: number; right: React.ReactNode; tone: "gradient" | "success" }) {
  const bar = tone === "gradient" ? "bg-brand-gradient" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{right}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`${bar} h-full rounded-full transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
