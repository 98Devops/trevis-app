import { useState } from "react";
import { ChevronDownIcon, BedSingleIcon, UserIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { money } from "./fmt";
import { CoverageStatusBadge, coverageSubLabel } from "./coverage";
import type { PortfolioRow } from "./use-portfolio";
import { RecordPaymentSheet } from "./modals/record-payment-sheet";
import { RoomRowActions } from "./modals/room-row-actions";
import { useNav } from "@/lib/propnest-nav";

type Room = PortfolioRow["rooms"][number];
type CoverageMap = Map<string, { status: string; daysRemaining?: number; daysOverdue?: number; coverageEnd?: string }>;

export function RoomRow({
  room,
  coverageMap,
  isAdmin = false,
}: {
  room: Room;
  coverageMap: CoverageMap;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const { openTenant } = useNav();

  const real = room.students.filter((s) => s.status !== "VACANT" && s.status !== "VACATED");
  const vacant = Math.max(0, room.beds - real.length);

  const covered = real.filter((s) => {
    const c = coverageMap.get(s.id);
    return c && ["CURRENT", "EXPIRING_SOON", "DUE_TODAY"].includes(c.status);
  }).length;
  const overdue = real.filter((s) => coverageMap.get(s.id)?.status === "OVERDUE").length;
  const coveragePct = real.length > 0 ? Math.round((covered / real.length) * 100) : 0;

  const barTone =
    overdue > 0 ? "bg-rose-500" :
    coveragePct === 100 ? "bg-brand-gradient" :
    "bg-amber-500";

  return (
    <div className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-sm">
      <div className="flex w-full items-center gap-1 pe-2 transition-colors hover:bg-muted/40">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-4 px-4 py-3 text-left"
          aria-expanded={open}
        >
          <span className="bg-brand-gradient-soft text-brand-blue flex size-9 shrink-0 items-center justify-center rounded-lg">
            <BedSingleIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-foreground">{room.no}</span>
              <span className="text-xs text-muted-foreground">{room.beds} bed{room.beds === 1 ? "" : "s"}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs tabular-nums text-muted-foreground">{money(room.rent)}/mo</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-1.5 max-w-[180px] flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-[width]", barTone)} style={{ width: `${coveragePct}%` }} />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{covered}/{real.length}</span> covered
                {vacant > 0 && <> · <span className="text-amber-600 dark:text-amber-400">{vacant} vacant</span></>}
                {overdue > 0 && <> · <span className="text-rose-600 dark:text-rose-400">{overdue} overdue</span></>}
              </span>
            </div>
          </div>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {isAdmin && (
          <RoomRowActions room={{ id: room.id, no: room.no, activeCount: real.length, beds: room.beds }} />
        )}
      </div>

      {open && (
        <div className="border-t bg-muted/30 px-4 py-3">
          {real.length === 0 ? (
            <div className="py-3 text-center text-sm text-muted-foreground">
              All beds vacant.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {real.map((s) => {
                const cov = coverageMap.get(s.id) ?? null;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => openTenant(s.id)}
                      className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
                      aria-label={`Open ${s.name} profile`}
                    >
                      <UserIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openTenant(s.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium text-foreground hover:underline">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{coverageSubLabel(cov)}</div>
                    </button>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          Balance{" "}
                          <span className={cn(
                            "font-semibold",
                            s.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                          )}>
                            {money(s.balance)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <CoverageStatusBadge coverage={cov} />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Record payment for ${s.name}`}
                        onClick={() => setPayFor(s.id)}
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <RecordPaymentSheet
        open={payFor !== null}
        onOpenChange={(o) => !o && setPayFor(null)}
        defaultStudentId={payFor ?? undefined}
      />
    </div>
  );
}
