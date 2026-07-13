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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { useLabels } from "@/lib/vertical-labels";
// Engine modules (brief §3) — consumed without modification.
import { useData } from "@/parts/p1_imports_context.jsx";
import { usePortfolioCoverage } from "../coverage-context";
import { addStudent } from "@/services/studentService.js";
import type { PortfolioRow } from "../use-portfolio";
import { money } from "../fmt";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export type AddTenantSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Scope room picker to one property's rooms. */
  property: PortfolioRow;
};

/**
 * Wraps studentService.addStudent in a typed Sheet. Defaults check-in to today,
 * filters the room picker to rooms with a vacant bed (avoids over-allocation),
 * and surfaces the service `{ data, error }` contract via sonner (brief §5).
 */
export function AddTenantSheet({ open, onOpenChange, property }: AddTenantSheetProps) {
  const labels = useLabels();
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };
  const { refresh: refreshCoverage } = usePortfolioCoverage() as unknown as { refresh: () => void };

  const rooms = property.rooms.map((r) => {
    const occupied = r.students.filter((s) => s.status !== "VACANT" && s.status !== "VACATED").length;
    return { id: r.id, no: r.no, rent: r.rent, beds: r.beds, occupied, vacant: Math.max(0, r.beds - occupied) };
  });
  const availableRooms = rooms.filter((r) => r.vacant > 0);

  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [nationalId, setNationalId] = useState("");
  const [roomId, setRoomId]   = useState<string>("");
  const [checkIn, setCheckIn] = useState<string>(todayISO());
  const [notes, setNotes]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setPhone(""); setNationalId("");
      setRoomId(availableRooms[0]?.id ?? "");
      setCheckIn(todayISO()); setNotes(""); setSubmitting(false);
    }
    // availableRooms is derived per render — including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, property.id]);

  const canSubmit = !!name.trim() && !!roomId && !!checkIn && !submitting;

  const selectedRoom = rooms.find((r) => r.id === roomId);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        full_name: name.trim(),
        phone: phone.trim() || null,
        national_id: nationalId.trim() || null,
        room_id: roomId,
        check_in_date: checkIn || null,
        status: "ACTIVE",
        notes: notes.trim() || null,
      } as unknown as Parameters<typeof addStudent>[0];

      const { error } = (await addStudent(payload)) as { data: unknown; error: { message?: string } | null };

      if (error) {
        toast.error(`Could not add ${labels.occupant.toLowerCase()}`, {
          description: error.message ?? "Unknown error from the database.",
        });
        return;
      }

      refreshData();
      refreshCoverage();
      toast.success(`${labels.occupant} added`, {
        description: `${name.trim()} · ${property.name}${selectedRoom ? ` · ${selectedRoom.no}` : ""}`,
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not add ${labels.occupant.toLowerCase()}`, { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>
            <span className="text-brand-gradient">{labels.addOccupant}</span>
          </SheetTitle>
          <SheetDescription>
            Onboard a new {labels.occupant.toLowerCase()} into {property.name}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {availableRooms.length === 0 ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              Every {labels.unit.toLowerCase()} in {property.name} is full. Add a {labels.unit.toLowerCase()} first or vacate a {labels.occupant.toLowerCase()} to free a bed.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="at-name">Full name</Label>
                <Input
                  id="at-name"
                  placeholder="e.g. Sarah Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="at-phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="at-phone"
                    type="tel"
                    placeholder="+263 …"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="at-id">National ID <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="at-id"
                    placeholder="e.g. 12-345678-A-90"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="at-room">{labels.unit}</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger id="at-room">
                    <SelectValue placeholder={`Choose a ${labels.unit.toLowerCase()}…`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.no}
                        <span className="text-muted-foreground"> — {money(r.rent)}/{labels.ratePeriod === "month" ? "mo" : "night"} · {r.vacant} vacant bed{r.vacant === 1 ? "" : "s"}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="at-checkin">Check-in date</Label>
                <Input
                  id="at-checkin"
                  type="date"
                  max={todayISO()}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="at-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="at-notes"
                  placeholder="Anything to remember about this tenancy…"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t bg-card p-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={handleSubmit} disabled={!canSubmit || availableRooms.length === 0}>
            {submitting && <Loader2Icon className="animate-spin" />}
            {labels.addOccupant}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
