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
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { updateProperty } from "@/services/propertyService.js";

export type EditPropertySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: { id: string; name: string; location: string };
  /** Called after a successful save so the parent can refresh data + coverage. */
  onSaved: () => void;
};

/**
 * Rename a property (and edit its location). Admin-only at the call site; RLS
 * enforces it server-side too. The property name is a pure display label — never
 * a coverage input — so saving here can't affect any balance or status.
 */
export function EditPropertySheet({ open, onOpenChange, property, onSaved }: EditPropertySheetProps) {
  const [name, setName] = useState(property.name);
  const [location, setLocation] = useState(property.location);
  const [saving, setSaving] = useState(false);

  // Re-seed from the property each time the sheet opens.
  useEffect(() => {
    if (open) {
      setName(property.name);
      setLocation(property.location);
      setSaving(false);
    }
  }, [open, property]);

  const trimmed = name.trim();
  const unchanged = trimmed === property.name && location.trim() === property.location;
  const canSubmit = trimmed.length > 0 && !unchanged && !saving;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const { error } = (await updateProperty(property.id, {
        name: trimmed,
        location: location.trim(),
      })) as { data: unknown; error: { message?: string } | null };

      if (error) {
        toast.error("Could not update property", {
          description: error.message ?? "Unknown error from the database.",
        });
        return;
      }

      onSaved();
      toast.success("Property updated", { description: `Now showing as “${trimmed}”.` });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Could not update property", { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>
            <span className="text-brand-gradient">Edit property</span>
          </SheetTitle>
          <SheetDescription>
            Rename the property or update its location. This only changes the label —
            tenants, rooms, payments, and coverage are untouched.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ep-name">Property name</Label>
            <Input
              id="ep-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-invalid={trimmed.length === 0 || undefined}
            />
            {trimmed.length === 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Property name can’t be empty.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-location">
              Location <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="ep-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Avondale, Harare"
            />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t bg-card p-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={handleSave} disabled={!canSubmit}>
            {saving && <Loader2Icon className="animate-spin" />}
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
