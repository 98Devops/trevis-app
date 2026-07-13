import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "./panel";
import { usePortfolio } from "./use-portfolio";
import { moneyCompact, money } from "./fmt";

export function MonthlyTrend() {
  const { monthlyTrend } = usePortfolio();

  const total = monthlyTrend.reduce((s, m) => s + m.collected, 0);
  const last = monthlyTrend[monthlyTrend.length - 1]?.collected ?? 0;
  const prev = monthlyTrend[monthlyTrend.length - 2]?.collected ?? 0;
  const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;

  return (
    <Panel>
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Collection trend</h3>
          <p className="text-xs text-muted-foreground">Last 12 months · payments received</p>
        </div>
        <div className="text-right">
          <div className="font-semibold text-2xl tabular-nums text-foreground">{moneyCompact(total)}</div>
          {prev > 0 && (
            <div className={`text-xs font-medium ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {delta >= 0 ? "↗" : "↘"} {Math.abs(delta)}% vs previous month
            </div>
          )}
        </div>
      </header>
      {/* Inline height (not just the h-64 class) guarantees a non-zero height on
          the very first paint, before the external CSS loads — which silences
          Recharts' "width(-1)/height(-1)" warning on initial render. */}
      <div className="w-full px-2 pt-4 pb-2" style={{ height: 256 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="propnest-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--brand-blue)"   stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--brand-purple)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="propnest-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="var(--brand-blue)" />
                <stop offset="100%" stopColor="var(--brand-purple)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis
              tickFormatter={(v) => moneyCompact(Number(v))}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted-foreground)"
              fontSize={11}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: "var(--brand-blue)", strokeOpacity: 0.3 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value) => [money(Number(value)), "Collected"]}
            />
            <Area
              type="monotone"
              dataKey="collected"
              stroke="url(#propnest-line)"
              strokeWidth={2.5}
              fill="url(#propnest-area)"
              activeDot={{ r: 4, fill: "var(--brand-purple)", stroke: "white", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
