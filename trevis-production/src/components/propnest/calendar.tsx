import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, BanknoteIcon, ClockIcon, LogInIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Panel } from "./panel";
import { usePortfolio, usePortfolioCoverage } from "./use-portfolio";
import { money } from "./fmt";
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/propnest-nav";

type PaymentEvent = { id: string; studentId: string; tenant: string; amount: number; method?: string; property: string; room: string };
type ExpiryEvent = { studentId: string; tenant: string; property: string; room: string; status: string };
type CheckinEvent = { studentId: string; tenant: string; property: string; room: string };

type DayEvents = {
  payments: PaymentEvent[];
  expiries: ExpiryEvent[];
  checkins: CheckinEvent[];
};

function emptyDay(): DayEvents {
  return { payments: [], expiries: [], checkins: [] };
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  EXPIRING_SOON: "expiring soon",
  DUE_TODAY: "due today",
  OVERDUE: "overdue",
};

export function CalendarScreen() {
  const { properties } = usePortfolio();
  const { coverageMap, students } = usePortfolioCoverage();
  const { openTenant } = useNav();

  // classifyStudent() (what coverageMap holds) does NOT carry coverage_end, so an
  // expiry can't be placed on a day from the classification alone — that silently
  // killed the expiry markers. Join id → { status, coverageEnd } from the RAW
  // coverage rows (which do have coverage_end) so expiries land on the right day.
  const coverageInfo = useMemo(() => {
    const m = new Map<string, { status: string; coverageEnd: string | null }>();
    for (const s of (students ?? []) as Array<{ id: string; coverage_end?: string | null }>) {
      const c = coverageMap.get(s.id);
      if (c) m.set(s.id, { status: c.status, coverageEnd: s.coverage_end ?? null });
    }
    return m;
  }, [students, coverageMap]);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  const { byDay, monthLabel, firstWeekday, daysInMonth } = useMemo(() => {
    const map = new Map<string, DayEvents>();
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, emptyDay());
      return map.get(key)!;
    };
    for (const p of properties) {
      for (const r of p.rooms) {
        for (const s of r.students) {
          if (s.status === "VACANT" || s.status === "VACATED") continue;
          for (const pay of s.payHistory ?? []) {
            if (!pay.date) continue;
            ensure(pay.date.slice(0, 10)).payments.push({
              id: pay.id, studentId: s.id, tenant: s.name, amount: pay.amount, method: pay.method, property: p.name, room: r.no,
            });
          }
          // Check-in (tenancy start) — drives the "check-in" marker like Trevis.
          if (s.date && s.date !== "—") {
            ensure(s.date.slice(0, 10)).checkins.push({
              studentId: s.id, tenant: s.name, property: p.name, room: r.no,
            });
          }
          const cov = coverageInfo.get(s.id);
          if (cov && cov.coverageEnd && ["EXPIRING_SOON", "DUE_TODAY", "OVERDUE"].includes(cov.status)) {
            ensure(cov.coverageEnd.slice(0, 10)).expiries.push({
              studentId: s.id, tenant: s.name, property: p.name, room: r.no, status: cov.status,
            });
          }
        }
      }
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last  = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return {
      byDay: map,
      monthLabel: cursor.toLocaleString("en-US", { month: "long", year: "numeric" }),
      firstWeekday: first.getDay(),
      daysInMonth: last.getDate(),
    };
  }, [properties, coverageInfo, cursor]);

  const todayISO = ymd(new Date());
  const cells: Array<{ date: Date | null; iso: string; events?: DayEvents }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, iso: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    const iso = ymd(date);
    cells.push({ date, iso, events: byDay.get(iso) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, iso: "" });

  const upcoming: Array<{ iso: string; events: DayEvents }> = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = ymd(d);
    const ev = byDay.get(iso);
    if (ev && (ev.expiries.length > 0 || ev.payments.length > 0 || ev.checkins.length > 0)) upcoming.push({ iso, events: ev });
    if (upcoming.length >= 6) break;
  }

  const selectedEvents = selectedISO ? byDay.get(selectedISO) ?? emptyDay() : null;

  const openTenantFromCalendar = (id: string) => {
    setSelectedISO(null);
    openTenant(id);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">Calendar</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Click any day to see its payments, coverage expiries and check-ins.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-base font-semibold text-foreground">{monthLabel}</h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Previous month">
                <ChevronLeftIcon />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Today</Button>
              <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Next month">
                <ChevronRightIcon />
              </Button>
            </div>
          </header>
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((w) => <div key={w} className="py-1">{w}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                if (!c.date) return <div key={i} className="aspect-square rounded-md bg-muted/30" />;
                const isToday = c.iso === todayISO;
                const payCount = c.events?.payments.length ?? 0;
                const expCount = c.events?.expiries.length ?? 0;
                const inCount = c.events?.checkins.length ?? 0;
                const hasEvents = payCount + expCount + inCount > 0;
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSelectedISO(c.iso)}
                    aria-label={`${c.iso}${hasEvents ? ` — ${payCount + expCount + inCount} events` : ""}`}
                    className={cn(
                      "flex aspect-square flex-col rounded-md border bg-card p-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none",
                      isToday && "ring-2 ring-brand-blue",
                      hasEvents && !isToday && "border-brand-blue/30",
                    )}
                  >
                    <div className={cn("text-right font-semibold tabular-nums", isToday ? "text-brand-blue" : "text-foreground")}>
                      {c.date.getDate()}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1">
                      {payCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400" title={`${payCount} payment${payCount === 1 ? "" : "s"}`}>
                          <span className="size-1.5 rounded-full bg-emerald-500" />{payCount > 1 ? payCount : ""}
                        </span>
                      )}
                      {expCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tabular-nums text-rose-600 dark:text-rose-400" title={`${expCount} coverage expiring`}>
                          <span className="size-1.5 rounded-full bg-rose-500" />{expCount > 1 ? expCount : ""}
                        </span>
                      )}
                      {inCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tabular-nums text-amber-600 dark:text-amber-400" title={`${inCount} check-in${inCount === 1 ? "" : "s"}`}>
                          <span className="size-1.5 rounded-full bg-amber-500" />{inCount > 1 ? inCount : ""}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 px-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Payment received</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rose-500" /> Coverage expiring</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> Check-in</span>
            </div>
          </div>
        </Panel>

        <Panel>
          <header className="border-b px-5 py-4">
            <h3 className="text-base font-semibold text-foreground">Upcoming</h3>
            <p className="text-xs text-muted-foreground">Next 30 days · expiries, payments &amp; check-ins.</p>
          </header>
          <div className="divide-y divide-border">
            {upcoming.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing scheduled in the next 30 days.</div>
            ) : upcoming.map((u) => (
              <button
                type="button"
                key={u.iso}
                onClick={() => setSelectedISO(u.iso)}
                className="block w-full px-5 py-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
                    {new Date(u.iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}
                  </div>
                  <ArrowRightIcon className="size-3.5 text-muted-foreground" />
                </div>
                <ul className="mt-1.5 space-y-1">
                  {u.events.expiries.map((e) => (
                    <li key={`x-${e.studentId}`} className="text-xs">
                      <span className="font-medium text-foreground">{e.tenant}</span>{" "}
                      <span className="text-muted-foreground">coverage {STATUS_LABEL[e.status] ?? e.status.toLowerCase()}</span>{" "}
                      <span className="text-muted-foreground/70">· {e.property}</span>
                    </li>
                  ))}
                  {u.events.payments.map((p) => (
                    <li key={`p-${p.id}`} className="text-xs">
                      <span className="text-muted-foreground">payment </span>
                      <span className="tabular-nums font-medium text-foreground">{money(p.amount)}</span>{" "}
                      <span className="text-muted-foreground">from {p.tenant}</span>
                    </li>
                  ))}
                  {u.events.checkins.map((c) => (
                    <li key={`c-${c.studentId}`} className="text-xs">
                      <span className="text-muted-foreground">check-in </span>
                      <span className="font-medium text-foreground">{c.tenant}</span>{" "}
                      <span className="text-muted-foreground/70">· {c.property}</span>
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </Panel>
      </section>

      {/* Day detail — click any day to drill into its transactions (Trevis parity). */}
      <Sheet open={selectedISO !== null} onOpenChange={(o) => !o && setSelectedISO(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="text-brand-gradient text-xl font-bold">
              {selectedISO ? new Date(selectedISO).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
            </SheetTitle>
            <SheetDescription>
              {selectedEvents
                ? `${selectedEvents.payments.length} payment${selectedEvents.payments.length === 1 ? "" : "s"} · ${selectedEvents.expiries.length} expir${selectedEvents.expiries.length === 1 ? "y" : "ies"} · ${selectedEvents.checkins.length} check-in${selectedEvents.checkins.length === 1 ? "" : "s"}`
                : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {selectedEvents && (selectedEvents.payments.length + selectedEvents.expiries.length + selectedEvents.checkins.length) === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No events on this date.</div>
            ) : (
              <div className="space-y-6 p-5">
                {selectedEvents && selectedEvents.payments.length > 0 && (
                  <DaySection
                    icon={<BanknoteIcon className="size-4" />}
                    title="Payments recorded"
                    tone="text-emerald-600 dark:text-emerald-400"
                    count={selectedEvents.payments.length}
                    extra={money(selectedEvents.payments.reduce((s, p) => s + (p.amount || 0), 0))}
                  >
                    {selectedEvents.payments.map((p) => (
                      <DayRow key={`p-${p.id}`} onClick={() => openTenantFromCalendar(p.studentId)}
                        title={p.tenant} subtitle={`${p.property} · ${p.room}`}
                        right={<span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{money(p.amount)}</span>}
                        rightSub={p.method} />
                    ))}
                  </DaySection>
                )}

                {selectedEvents && selectedEvents.expiries.length > 0 && (
                  <DaySection
                    icon={<ClockIcon className="size-4" />}
                    title="Coverage expiring"
                    tone="text-rose-600 dark:text-rose-400"
                    count={selectedEvents.expiries.length}
                  >
                    {selectedEvents.expiries.map((e) => (
                      <DayRow key={`x-${e.studentId}`} onClick={() => openTenantFromCalendar(e.studentId)}
                        title={e.tenant} subtitle={`${e.property} · ${e.room}`}
                        right={<Badge variant={e.status === "EXPIRING_SOON" ? "secondary" : "destructive"}>{STATUS_LABEL[e.status] ?? e.status.toLowerCase()}</Badge>} />
                    ))}
                  </DaySection>
                )}

                {selectedEvents && selectedEvents.checkins.length > 0 && (
                  <DaySection
                    icon={<LogInIcon className="size-4" />}
                    title="Check-ins"
                    tone="text-amber-600 dark:text-amber-400"
                    count={selectedEvents.checkins.length}
                  >
                    {selectedEvents.checkins.map((c) => (
                      <DayRow key={`c-${c.studentId}`} onClick={() => openTenantFromCalendar(c.studentId)}
                        title={c.tenant} subtitle={`${c.property} · ${c.room}`} />
                    ))}
                  </DaySection>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DaySection({ icon, title, tone, count, extra, children }: {
  icon: React.ReactNode; title: string; tone: string; count: number; extra?: string; children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", tone)}>
        {icon}
        <span>{title} ({count})</span>
        {extra && <span className="ms-auto text-xs font-normal text-muted-foreground">{extra} total</span>}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function DayRow({ title, subtitle, right, rightSub, onClick }: {
  title: string; subtitle: string; right?: React.ReactNode; rightSub?: string; onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors hover:bg-accent"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {(right || rightSub) && (
          <div className="text-right">
            {right}
            {rightSub && <div className="mt-0.5 text-[11px] text-muted-foreground">{rightSub}</div>}
          </div>
        )}
      </button>
    </li>
  );
}
