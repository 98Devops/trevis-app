import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { useLabels } from "@/lib/vertical-labels";
// Engine modules (brief §3) — consumed without modification.
import { useAuth } from "@/parts/p1_imports_context.jsx";
import { updatePayment, deletePayment } from "@/services/paymentService.js";
import { localTodayISO, isFutureDate } from "@/lib/dateGuards";

type PaymentRow = {
  id: string;
  amount: number;
  date: string;
  method?: string;
  receipt?: string;
  notes?: string;
};

import { PAYMENT_METHODS } from "@/lib/payment-methods";

const METHODS: string[] = [...PAYMENT_METHODS];

export type PaymentRowActionsProps = {
  payment: PaymentRow;
  /** Delete is destructive — gate to admins (matches Vacate). Edit is allowed for all. */
  canDelete: boolean;
  /** Called after a successful edit/delete so the drawer can refresh data + coverage. */
  onChanged: () => void;
};

/**
 * Per-payment row menu in the Tenant Profile history table (brief §15 #2).
 * Edit wraps paymentService.updatePayment, Delete wraps deletePayment — both are
 * coverage-aware and return `rebuildError`, which we surface as a toast.
 */
export function PaymentRowActions({ payment, canDelete, onChanged }: PaymentRowActionsProps) {
  const labels = useLabels();
  const { user } = useAuth() as unknown as { user?: { id?: string } | null };

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7" aria-label="Payment actions">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <PencilIcon /> Edit payment
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2Icon /> Delete payment
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPaymentSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        payment={payment}
        userId={user?.id ?? null}
        currency={labels.currencySymbol}
        onChanged={onChanged}
      />

      <DeletePaymentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        payment={payment}
        currency={labels.currencySymbol}
        onChanged={onChanged}
      />
    </>
  );
}

function rebuildToast(rebuildError: unknown, okMessage: string) {
  if (rebuildError) {
    toast.warning("Saved · coverage may be stale", {
      description: "The change was saved but coverage rebuild failed. Run Repair Coverage from Settings.",
    });
  } else {
    toast.success(okMessage);
  }
}

function EditPaymentSheet({
  open, onOpenChange, payment, userId, currency, onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payment: PaymentRow;
  userId: string | null;
  currency: string;
  onChanged: () => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount ?? ""));
  const [date, setDate] = useState(payment.date || localTodayISO());
  const [method, setMethod] = useState(payment.method || "Cash");
  const [receipt, setReceipt] = useState(payment.receipt || "");
  const [notes, setNotes] = useState(payment.notes || "");
  const [saving, setSaving] = useState(false);
  const [confirmFuture, setConfirmFuture] = useState(false);

  // Re-seed from the row each time the sheet opens.
  useEffect(() => {
    if (open) {
      setAmount(String(payment.amount ?? ""));
      setDate(payment.date || localTodayISO());
      setMethod(payment.method || "Cash");
      setReceipt(payment.receipt || "");
      setNotes(payment.notes || "");
      setSaving(false);
      setConfirmFuture(false);
    }
  }, [open, payment]);

  const amountNum = Number(amount);
  // Same future-date guard as the record sheet — a future payment_date pushes
  // coverage forward and is almost always a slip; require explicit confirmation.
  const isFuture = isFutureDate(date);
  const canSubmit =
    Number.isFinite(amountNum) && amountNum > 0 && !!date && (!isFuture || confirmFuture) && !saving;
  // Existing seed data may carry methods (EcoCash/Zipit) outside the current list.
  const methodOptions = METHODS.includes(method) ? METHODS : [method, ...METHODS];

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const { error, rebuildError } = (await updatePayment(
        payment.id,
        {
          amount: amountNum,
          payment_date: date,
          payment_method: method,
          receipt_number: receipt || null,
          notes: notes || null,
        },
        userId,
      )) as { error: { message: string } | null; rebuildError?: unknown };
      if (error) throw new Error(error.message);
      onChanged();
      rebuildToast(rebuildError, "Payment updated");
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't update payment", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle><span className="text-brand-gradient">Edit payment</span></SheetTitle>
          <SheetDescription>Updates the payment and rebuilds coverage from the ledger.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ep-amount">Amount ({currency})</Label>
              <Input id="ep-amount" type="number" inputMode="decimal" min="0" step="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-date">Payment date</Label>
              <Input id="ep-date" type="date" max={localTodayISO()}
                value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {isFuture && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700/60 dark:bg-amber-900/20">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                This payment is dated in the future ({date}).
              </p>
              <p className="mt-0.5 text-amber-700/90 dark:text-amber-400/90">
                A future date pushes coverage forward and is usually a data-entry mistake.
              </p>
              <label className="mt-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                <input
                  type="checkbox"
                  className="size-4 accent-amber-600"
                  checked={confirmFuture}
                  onChange={(e) => setConfirmFuture(e.target.checked)}
                />
                Yes, this future date is intentional.
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ep-method">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="ep-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {methodOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-receipt">Receipt number <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="ep-receipt" value={receipt} onChange={(e) => setReceipt(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="ep-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t bg-card p-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="gradient" onClick={handleSave} disabled={!canSubmit}>
            {saving && <Loader2Icon className="animate-spin" />} Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DeletePaymentDialog({
  open, onOpenChange, payment, currency, onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payment: PaymentRow;
  currency: string;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error, rebuildError } = (await deletePayment(payment.id)) as {
        error: { message: string } | null; rebuildError?: unknown;
      };
      if (error) throw new Error(error.message);
      onChanged();
      rebuildToast(rebuildError, "Payment deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't delete payment", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
          <AlertDialogDescription>
            {currency}{Number(payment.amount).toLocaleString()} on {payment.date || "—"} will be permanently
            removed and coverage will be rebuilt from the remaining ledger. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={deleting}
            className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-600"
          >
            {deleting && <Loader2Icon className="animate-spin" />} Delete payment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
