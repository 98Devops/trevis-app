import { usePortfolio } from "./use-portfolio";
import { usePortfolioAttention } from "./coverage-context";
import { money } from "./fmt";
import { StatCard } from "./stat-card";
import { DeltaPill } from "./delta-pill";

export function PropNestStats() {
  const { totals } = usePortfolio();
  // Coverage-derived attention + outstanding (matches Finance/Tenants and Trevis's
  // arrears), not the month-based expected−collected figure.
  const { count: attentionCount, totalOutstanding } = usePortfolioAttention();

  return (
    <>
      <StatCard
        featured
        label="Collected this month"
        value={money(totals.collected)}
        delta={
          <DeltaPill tone={totals.collectionRate >= 90 ? "positive" : totals.collectionRate >= 70 ? "neutral" : "negative"}>
            {totals.collectionRate}%
          </DeltaPill>
        }
        caption={`${money(totals.collected)} of ${money(totals.expected)} expected`}
        progress={totals.collectionRate}
      />
      <StatCard
        label="Expected"
        value={money(totals.expected)}
        caption={`${totals.activeStudents} active tenant${totals.activeStudents === 1 ? "" : "s"}`}
      />
      <StatCard
        label="Outstanding"
        value={money(totalOutstanding)}
        delta={attentionCount > 0 ? (
          <DeltaPill tone="negative">{attentionCount}</DeltaPill>
        ) : (
          <DeltaPill tone="positive">0</DeltaPill>
        )}
        caption={attentionCount === 0 ? "Nothing needs attention" : `${attentionCount} tenant${attentionCount === 1 ? "" : "s"} need attention`}
      />
      <StatCard
        label="Occupancy"
        value={`${totals.occupancyRate}%`}
        caption={
          totals.overCapacity > 0
            ? `${totals.occupiedBeds} of ${totals.totalBeds} beds · ${totals.overCapacity} over capacity`
            : `${totals.occupiedBeds} of ${totals.totalBeds} beds`
        }
        progress={totals.occupancyRate}
      />
    </>
  );
}
