import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { useLabels } from "@/lib/vertical-labels";
// Engine modules (brief §3) — consumed without modification.
import { useData } from "@/parts/p1_imports_context.jsx";
import { usePortfolioCoverage } from "../coverage-context";
import { removeStudent } from "@/services/studentService.js";

export type VacateTenantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  onSuccess?: () => void;
};

/**
 * Confirms a destructive vacate (status → VACATED). The engine soft-deletes:
 * payment history stays, coverage cache is cleared, the row is no longer ACTIVE.
 * Surfaces { error } per brief §5 and refreshes both stores on success.
 */
export function VacateTenantDialog({
  open, onOpenChange, tenantId, tenantName, onSuccess,
}: VacateTenantDialogProps) {
  const labels = useLabels();
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };
  const { refresh: refreshCoverage } = usePortfolioCoverage() as unknown as { refresh: () => void };
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { error } = (await removeStudent(tenantId)) as { error: { message?: string } | null };
      if (error) {
        toast.error(`Could not vacate ${labels.occupant.toLowerCase()}`, {
          description: error.message ?? "Unknown error from the database.",
        });
        return;
      }
      refreshData();
      refreshCoverage();
      toast.success(`${tenantName} vacated`, {
        description: `Payment history kept; bed marked vacant.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not vacate ${labels.occupant.toLowerCase()}`, { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vacate {tenantName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks the {labels.occupant.toLowerCase()} as <span className="font-medium text-foreground">VACATED</span>{" "}
            and clears their derived coverage. Payment history is preserved and the bed
            becomes available for a new {labels.occupant.toLowerCase()}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {submitting && <Loader2Icon className="animate-spin" />}
            Vacate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
