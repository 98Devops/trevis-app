import { CreditCardIcon } from "lucide-react";
import { Panel } from "./panel";
import { usePortfolio } from "./use-portfolio";
import { money, formatDate } from "./fmt";

export function PropNestActivity() {
  const { recentPayments } = usePortfolio();

  return (
    <Panel>
      <header className="border-b px-5 py-4">
        <h3 className="text-base font-semibold text-foreground">Recent payments</h3>
        <p className="text-xs text-muted-foreground">Latest receipts across the portfolio.</p>
      </header>
      {recentPayments.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          No payments recorded yet.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {recentPayments.map((p) => (
            <li className="flex h-16 items-center gap-3 px-5" key={p.id}>
              <span
                aria-hidden
                className="bg-brand-gradient-soft text-brand-blue flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4"
              >
                <CreditCardIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium leading-snug text-foreground">
                  {p.studentName} <span className="font-normal text-muted-foreground">paid </span>
                  <span className="tabular-nums">{money(p.amount)}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {p.property} · {p.room} · {formatDate(p.date)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
