import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: ReactNode;
  value: ReactNode;
  /** Right-aligned chip next to the label (e.g. <DeltaPill />). */
  delta?: ReactNode;
  /** Small text under the value — context, not a metric. */
  caption?: ReactNode;
  /** Optional thin progress bar under the value (0..100). */
  progress?: number;
  className?: string;
  /** Highlight: gradient top-stripe + slightly stronger shadow. */
  featured?: boolean;
};

/**
 * KPI card — semantically neutral but visually consistent with the brand
 * palette. The 3-pixel top-stripe is the gradient signature; numerals are
 * tabular for clean alignment in a row.
 */
export function StatCard({
  label, value, delta, caption, progress, className, featured,
}: Props) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-5 transition-shadow",
        featured ? "shadow-md" : "shadow-sm hover:shadow-md",
        className,
      )}
    >
      <div
        aria-hidden
        className="bg-brand-gradient absolute inset-x-0 top-0 h-[3px]"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {delta}
      </div>
      <div className="mt-3 font-semibold text-3xl tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="bg-brand-gradient h-full rounded-full transition-[width]"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {caption && (
        <div className="mt-2 text-xs text-muted-foreground">{caption}</div>
      )}
    </div>
  );
}
