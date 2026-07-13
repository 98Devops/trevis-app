import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRightIcon, BedSingleIcon, BuildingIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLabels } from "@/lib/vertical-labels";
// Engine modules (brief §3) — consumed without modification.
import { useData, useAuth } from "@/parts/p1_imports_context.jsx";
import { usePortfolioCoverage } from "../coverage-context";
import { getAllAvailableRooms, executeTransfer } from "@/services/transferService.js";
import { toLocalISO } from "@/services/dateUtil.js";
import { money } from "../fmt";

type AvailableRoom = {
  id: string;
  roomNumber: string;
  bedCapacity: number;
  occupiedBeds: number;
  availableBeds: number;
  rentPerBed: number;
  propertyName: string;
};

export type TransferTenantSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  fromRoomId: string;
  fromLabel: string; // "King Fisher · Room 3"
  currentRent: number;
  onSuccess?: () => void;
};

/**
 * Move a tenant to any room in ANY property (Trevis parity). Reuses the existing
 * engine: getAllAvailableRooms lists every room with a free bed across the
 * portfolio, and executeTransfer runs the transfer RPC then REBUILDS coverage —
 * so if the destination rent differs, the daily rate and coverage_end are
 * recalculated automatically (surfaced as rebuildError if the replay fails).
 */
export function TransferTenantSheet({
  open, onOpenChange, tenantId, tenantName, fromRoomId, fromLabel, currentRent, onSuccess,
}: TransferTenantSheetProps) {
  const labels = useLabels();
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };
  const { refresh: refreshCoverage } = usePortfolioCoverage() as unknown as { refresh: () => void };
  const { user } = useAuth() as unknown as { user?: { id?: string } | null };

  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const [transferDate, setTransferDate] = useState(() => toLocalISO(new Date()) ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetRoomId(null);
    setReason("");
    setTransferDate(toLocalISO(new Date()) ?? "");
    setSubmitting(false);
    setLoadingRooms(true);
    let cancelled = false;
    (async () => {
      const { data, error } = (await getAllAvailableRooms()) as {
        data: AvailableRoom[]; error: { message?: string } | null;
      };
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load available rooms", { description: error.message ?? "Unknown error." });
      }
      // Exclude the tenant's current room — there's nowhere to "transfer" within it.
      setRooms((data ?? []).filter((r) => r.id !== fromRoomId));
      setLoadingRooms(false);
    })();
    return () => { cancelled = true; };
  }, [open, fromRoomId]);

  // Group available rooms by property for a scannable picker.
  const grouped = useMemo(() => {
    const map = new Map<string, AvailableRoom[]>();
    for (const r of rooms) {
      if (!map.has(r.propertyName)) map.set(r.propertyName, []);
      map.get(r.propertyName)!.push(r);
    }
    return Array.from(map.entries());
  }, [rooms]);

  const target = rooms.find((r) => r.id === targetRoomId) ?? null;
  const rentChanges = target ? Number(target.rentPerBed) !== Number(currentRent) : false;
  const canSubmit = !!targetRoomId && !!transferDate && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !target) return;
    setSubmitting(true);
    try {
      // Engine JSDoc types reason/performedBy as string, but null is the correct
      // value to send the RPC when they're absent — cast to keep null at runtime.
      const result = (await executeTransfer({
        studentId: tenantId,
        fromRoomId,
        toRoomId: target.id,
        transferDate,
        reason: reason.trim() || null,
        performedBy: user?.id ?? null,
      } as unknown as Parameters<typeof executeTransfer>[0])) as {
        success: boolean; error?: string; rebuildError?: string | null;
      };

      if (!result.success) {
        toast.error("Transfer failed", { description: result.error ?? "Unknown error from the database." });
        return;
      }

      refreshData();
      refreshCoverage();

      if (result.rebuildError) {
        toast.warning("Transferred — coverage may be stale", {
          description: `${tenantName} moved, but the coverage recalculation failed: ${result.rebuildError}. Re-save a payment to repair.`,
        });
      } else {
        toast.success(`${tenantName} transferred`, {
          description: `${fromLabel} → ${target.propertyName} · ${target.roomNumber}${rentChanges ? " · coverage recalculated at the new rent" : ""}`,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error("Transfer failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle><span className="text-brand-gradient">Transfer {labels.occupant.toLowerCase()}</span></SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-medium text-foreground">{tenantName}</span>
            <span>·</span>
            <span>{fromLabel}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <Label>Destination room</Label>
            <p className="text-xs text-muted-foreground">Any room with a free bed, across every property.</p>
            {loadingRooms ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Loading available rooms…
              </div>
            ) : grouped.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No other room has a free bed right now. Add a bed or remove a tenant elsewhere first.
              </div>
            ) : (
              <div className="max-h-72 space-y-4 overflow-y-auto rounded-md border p-3">
                {grouped.map(([propertyName, propRooms]) => (
                  <div key={propertyName} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <BuildingIcon className="size-3.5" /> {propertyName}
                    </div>
                    <div className="space-y-1.5">
                      {propRooms.map((r) => {
                        const selected = r.id === targetRoomId;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setTargetRoomId(r.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                              selected
                                ? "border-brand-blue bg-brand-gradient-soft"
                                : "hover:bg-muted/50",
                            )}
                            aria-pressed={selected}
                          >
                            <span className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg",
                              selected ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground",
                            )}>
                              <BedSingleIcon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-foreground">{r.roomNumber}</div>
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {r.availableBeds} of {r.bedCapacity} bed{r.bedCapacity === 1 ? "" : "s"} free · {money(r.rentPerBed)}/mo
                              </div>
                            </div>
                            {Number(r.rentPerBed) !== Number(currentRent) && (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                rent {Number(r.rentPerBed) > Number(currentRent) ? "↑" : "↓"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tt-date">Transfer date</Label>
            <Input
              id="tt-date"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tt-reason">Reason <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="tt-reason"
              placeholder="e.g. requested a quieter room, upgrade, consolidation…"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {target && rentChanges && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50/60 p-3 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              The new room's rent ({money(target.rentPerBed)}/mo) differs from the current {money(currentRent)}/mo.
              Coverage will be <span className="font-semibold">recalculated</span> at the new daily rate automatically.
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t bg-card p-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="gradient" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? <Loader2Icon className="animate-spin" /> : <ArrowRightIcon />}
            Transfer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
