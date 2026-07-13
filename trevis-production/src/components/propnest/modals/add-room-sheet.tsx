import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { useLabels } from "@/lib/vertical-labels";
import { useData } from "@/parts/p1_imports_context.jsx";
import { addRoom } from "@/services/propertyService.js";
import type { PortfolioRow } from "../use-portfolio";

export type AddRoomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: PortfolioRow;
};

/**
 * Wraps propertyService.addRoom in a typed Sheet. Admin-only at the call site;
 * this component trusts the parent's gate per brief §5 (RLS enforces server-side).
 */
export function AddRoomSheet({ open, onOpenChange, property }: AddRoomSheetProps) {
  const labels = useLabels();
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };

  const [roomNumber, setRoomNumber] = useState("");
  const [bedCapacity, setBedCapacity] = useState("1");
  const [rent, setRent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRoomNumber(""); setBedCapacity("1"); setRent(""); setNotes("");
      setSubmitting(false);
    }
  }, [open]);

  const bedCount = parseInt(bedCapacity, 10);
  const rentNum = parseFloat(rent);
  const trimmedNo = roomNumber.trim();

  // Disallow exact duplicate room numbers within this property — the legacy
  // schema doesn't block it but it confuses every downstream view.
  const duplicate = trimmedNo.length > 0 && property.rooms.some(
    (r) => r.no.trim().toLowerCase() === trimmedNo.toLowerCase(),
  );

  const canSubmit =
    trimmedNo.length > 0 &&
    !duplicate &&
    Number.isFinite(bedCount) && bedCount > 0 &&
    Number.isFinite(rentNum) && rentNum > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = (await addRoom(
        property.id,
        trimmedNo,
        bedCount,
        rentNum,
        notes.trim() || null,
      )) as { data: unknown; error: { message?: string } | null };

      if (error) {
        toast.error(`Could not add ${labels.unit.toLowerCase()}`, {
          description: error.message ?? "Unknown error from the database.",
        });
        return;
      }

      refreshData();
      toast.success(`${labels.unit} added`, {
        description: `${trimmedNo} · ${bedCount} bed${bedCount === 1 ? "" : "s"} · ${labels.currencySymbol}${rentNum.toLocaleString()}/${labels.ratePeriod === "month" ? "mo" : "night"}`,
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not add ${labels.unit.toLowerCase()}`, { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>
            <span className="text-brand-gradient">Add {labels.unit.toLowerCase()}</span>
          </SheetTitle>
          <SheetDescription>
            Adds a new {labels.unit.toLowerCase()} to {property.name}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ar-no">{labels.unit} number</Label>
            <Input
              id="ar-no"
              placeholder="e.g. 101"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              autoFocus
              aria-invalid={duplicate || undefined}
            />
            {duplicate && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {labels.unit} “{trimmedNo}” already exists in {property.name}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ar-beds">Bed capacity</Label>
              <Input
                id="ar-beds"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={bedCapacity}
                onChange={(e) => setBedCapacity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-rent">Rent per bed ({labels.currencySymbol})</Label>
              <Input
                id="ar-rent"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ar-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="ar-notes"
              placeholder="Layout, condition, anything worth remembering…"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Total monthly potential: <span className="tabular-nums font-semibold text-foreground">{labels.currencySymbol}{(Number.isFinite(bedCount) && Number.isFinite(rentNum) ? bedCount * rentNum : 0).toLocaleString()}</span>
            <span className="ml-1">when fully occupied</span>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t bg-card p-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2Icon className="animate-spin" />}
            Add {labels.unit.toLowerCase()}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
