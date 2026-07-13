import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** Render a thin gradient top-stripe (matches StatCard). */
  stripe?: boolean;
};

/**
 * The big-tile container used by Dashboard sections (PropertyMix, Attention,
 * Activity). Same rounding/shadow language as StatCard so the whole grid
 * reads as one consistent surface set.
 */
export function Panel({ children, className, stripe }: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card shadow-sm",
        className,
      )}
    >
      {stripe && (
        <div aria-hidden className="bg-brand-gradient absolute inset-x-0 top-0 h-[3px]" />
      )}
      {children}
    </div>
  );
}
