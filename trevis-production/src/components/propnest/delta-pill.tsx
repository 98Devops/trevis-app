import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeltaTone = "positive" | "negative" | "neutral";

type Props = {
  tone?: DeltaTone;
  children: React.ReactNode;
  className?: string;
};

/**
 * Compact change indicator — green/red/neutral pill with a tiny trend glyph.
 * Mirrors the "+12.5%" pill in the reference card; consume wherever a delta
 * needs to sit next to a KPI value.
 */
export function DeltaPill({ tone = "neutral", children, className }: Props) {
  const Icon =
    tone === "positive" ? TrendingUpIcon :
    tone === "negative" ? TrendingDownIcon :
    MinusIcon;

  const tones: Record<DeltaTone, string> = {
    positive: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30",
    negative: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/30",
    neutral:  "text-muted-foreground bg-muted",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tones[tone],
        className,
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  );
}
