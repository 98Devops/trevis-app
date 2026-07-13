import { useCallback, useEffect, useState } from "react";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, Loader2Icon, ShieldCheckIcon, CalendarClockIcon } from "lucide-react";
import { toast } from "sonner";
// Engine modules (brief §3) — consumed without modification.
import { getDataFlags, updateStudent } from "@/services/studentService.js";
// Read-only detection probe (lib/, outside the engine).
import { getFutureDatedPayments } from "@/lib/dataQualityChecks.js";
import { usePortfolioCoverage } from "./coverage-context";
import { useNav } from "@/lib/propnest-nav";
import { money } from "./fmt";

/**
 * Admin-only data-quality review (mirrors legacy Reports → Quality tab). Lists
 * every ACTIVE student the ingest tagged with a `data_flags` code, and lets an
 * admin Resolve it for real — legacy's onResolveFlag was an undefined no-op, so
 * this is the "same or better" engine: clearing the flag via
 * updateStudent(id, { data_flags: null }) (a non-coverage column, so no rebuild).
 */

type FlagInfo = { label: string; tone: string };

const FLAG_LABELS: Record<string, FlagInfo> = {
  OVER_CAPACITY: { label: "Over-capacity", tone: "text-rose-600 dark:text-rose-400" },
  ANONYMOUS_PLACEHOLDER: { label: "Anonymous / unidentified", tone: "text-amber-600 dark:text-amber-400" },
  INVALID_DATE: { label: "Invalid date in source", tone: "text-violet-600 dark:text-violet-400" },
  FUTURE_DATE: { label: "Future date (suspicious)", tone: "text-blue-600 dark:text-blue-400" },
  MISSING_PAYMENT: { label: "Missing payment amount", tone: "text-rose-600 dark:text-rose-400" },
  MISSING_DATE: { label: "Missing date", tone: "text-muted-foreground" },
  UNCLEAR_NOTE: { label: "Unclear note — needs clarification", tone: "text-amber-600 dark:text-amber-400" },
  PARTIAL_UNDERPAYMENT: { label: "Underpayment", tone: "text-amber-600 dark:text-amber-400" },
};

type FlagRow = {
  id: string;
  full_name: string;
  data_flags: string;
  notes: string | null;
  rooms?: { room_number?: string | null; properties?: { name?: string | null } | null } | null;
};

type FuturePaymentRow = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  student_id: string;
  students?: {
    full_name?: string | null;
    rooms?: { room_number?: string | null; properties?: { name?: string | null } | null } | null;
  } | null;
};

export function DataQuality() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [future, setFuture] = useState<FuturePaymentRow[]>([]);
  const [loadingFuture, setLoadingFuture] = useState(true);
  const { refresh: refreshCoverage } = usePortfolioCoverage() as unknown as { refresh: () => void };
  const { openTenant } = useNav();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadingFuture(true);
    const [flagRes, futureRes] = await Promise.all([
      getDataFlags() as Promise<{ data: FlagRow[]; error: { message?: string } | null }>,
      getFutureDatedPayments() as Promise<{ data: FuturePaymentRow[]; error: { message?: string } | null }>,
    ]);
    if (flagRes.error) {
      toast.error("Could not load data-quality flags", { description: flagRes.error.message ?? "Unknown error." });
    }
    setFlags(flagRes.data ?? []);
    setLoading(false);
    if (futureRes.error) {
      toast.error("Could not check future-dated payments", { description: futureRes.error.message ?? "Unknown error." });
    }
    setFuture(futureRes.data ?? []);
    setLoadingFuture(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (f: FlagRow) => {
    setResolving(f.id);
    try {
      const { error } = (await updateStudent(f.id, { data_flags: null })) as { error: { message?: string } | null };
      if (error) {
        toast.error("Could not resolve flag", { description: error.message ?? "Unknown error." });
        return;
      }
      setFlags((prev) => prev.filter((x) => x.id !== f.id));
      refreshCoverage();
      toast.success("Flag resolved", { description: `${f.full_name} cleared from the review queue.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Could not resolve flag", { description: message });
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="space-y-6">
    <Panel>
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold text-foreground">Data quality</h3>
            <p className="text-xs text-muted-foreground">Records the ingest flagged for review.</p>
          </div>
        </div>
        <Badge variant={flags.length ? "secondary" : "outline"}>
          {loading ? "…" : `${flags.length} issue${flags.length === 1 ? "" : "s"}`}
        </Badge>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Loading flags…
        </div>
      ) : flags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <CheckCircle2Icon className="size-8 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">No outstanding data-quality issues</p>
          <p className="text-xs text-muted-foreground">Every active record is clean.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {flags.map((f) => {
            const info = FLAG_LABELS[f.data_flags] ?? { label: f.data_flags, tone: "text-muted-foreground" };
            const propName = f.rooms?.properties?.name ?? "—";
            const roomName = f.rooms?.room_number ?? "—";
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-44 flex-1">
                  <div className="text-sm font-medium text-foreground">{f.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{propName} · {roomName}</div>
                </div>
                <div className={`text-xs font-semibold ${info.tone}`}>{info.label}</div>
                <div className="min-w-32 flex-1 truncate text-xs text-muted-foreground" title={f.notes ?? ""}>
                  {f.notes || "—"}
                </div>
                <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{f.data_flags}</code>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolving === f.id}
                  onClick={() => resolve(f)}
                >
                  {resolving === f.id ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
                  Resolve
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>

    <Panel>
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold text-foreground">Future-dated payments</h3>
            <p className="text-xs text-muted-foreground">
              Payments dated after today — usually a data-entry slip that pushes coverage forward.
            </p>
          </div>
        </div>
        <Badge variant={future.length ? "secondary" : "outline"}>
          {loadingFuture ? "…" : `${future.length} payment${future.length === 1 ? "" : "s"}`}
        </Badge>
      </header>

      {loadingFuture ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Checking payments…
        </div>
      ) : future.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <CheckCircle2Icon className="size-8 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">No future-dated payments</p>
          <p className="text-xs text-muted-foreground">Every payment is dated today or earlier.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {future.map((p) => {
            const name = p.students?.full_name ?? "—";
            const propName = p.students?.rooms?.properties?.name ?? "—";
            const roomName = p.students?.rooms?.room_number ?? "—";
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-44 flex-1">
                  <div className="text-sm font-medium text-foreground">{name}</div>
                  <div className="text-xs text-muted-foreground">{propName} · {roomName}</div>
                </div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Dated {p.payment_date}
                </div>
                <div className="min-w-20 text-right text-sm font-semibold tabular-nums text-foreground">
                  {money(p.amount)}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openTenant(p.student_id)}
                >
                  Review tenant
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
    </div>
  );
}
