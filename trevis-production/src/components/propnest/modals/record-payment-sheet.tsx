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
import { useData, useAuth } from "@/parts/p1_imports_context.jsx";
import { usePortfolioCoverage } from "../coverage-context";
import { recordPaymentWithCoverage } from "@/services/coverageDatabaseService.js";
import { usePortfolio } from "../use-portfolio";
import { localTodayISO, isFutureDate } from "@/lib/dateGuards";

type PaymentResult = {
  payment: unknown;
  coverage: unknown;
  rebuildError?: unknown;
  duplicateSuppressed?: boolean;
};

import { PAYMENT_METHODS as METHODS, type PaymentMethod as Method } from "@/lib/payment-methods";

export type RecordPaymentSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a tenant. When absent, user picks from `propertyId`'s tenants (or all). */
  defaultStudentId?: string;
  /** Scope the tenant picker to a single property. */
  propertyId?: string;
};

/**
 * Wraps the legacy engine call `recordPaymentWithCoverage` in a typed sheet.
 * Per brief §3 we never compute coverage here — we hand the form values to the
 * engine and surface its `{ rebuildError, duplicateSuppressed }` signals via
 * toasts. On success we refresh both the data store and coverage store so the
 * dashboard / property / tenants screens pick the new payment up immediately.
 */
export function RecordPaymentSheet({
  open, onOpenChange, defaultStudentId, propertyId,
}: RecordPaymentSheetProps) {
  const labels = useLabels();
  const { allTenants } = usePortfolio();
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };
  const { refresh: refreshCoverage } = usePortfolioCoverage() as unknown as { refresh: () => void };
  const { user } = useAuth() as unknown as { user?: { id?: string } | null };

  const tenants = useMemo(
    () => (propertyId ? allTenants.filter((t) => t.propertyId === propertyId) : allTenants),
    [allTenants, propertyId],
  );

  const [studentId, setStudentId] = useState<string>(defaultStudentId ?? "");
  const [amount, setAmount]       = useState<string>("");
  const [date, setDate]           = useState<string>(localTodayISO());
  const [method, setMethod]       = useState<Method>("Cash");
  const [receipt, setReceipt]     = useState<string>("");
  const [notes, setNotes]         = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmFuture, setConfirmFuture] = useState(false);

  // Reset form whenever the sheet re-opens so we don't carry stale state.
  useEffect(() => {
    if (open) {
      setStudentId(defaultStudentId ?? "");
      setAmount("");
      setDate(localTodayISO());
      setMethod("Cash");
      setReceipt("");
      setNotes("");
      setSubmitting(false);
      setConfirmFuture(false);
    }
  }, [open, defaultStudentId]);

  const selectedTenant = tenants.find((t) => t.id === studentId) ?? null;
  const amountNum = Number(amount);
  // Guard: a future payment date silently pushes coverage forward — almost always a
  // data-entry slip. Require an explicit confirm before it can be submitted.
  const isFuture = isFutureDate(date);
  const canSubmit =
    !!studentId &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    !!date &&
    (!isFuture || confirmFuture) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // The engine's JSDoc loosely types the args; cast through unknown so the
      // call site stays typed while still passing the real values the DB expects.
      const args = {
        studentId,
        amount: amountNum,
        paymentDate: date,
        paymentMethod: method,
        receiptNumber: receipt || null,
        notes: notes || null,
        recordedBy: user?.id ?? null,
      } as unknown as Parameters<typeof recordPaymentWithCoverage>[0];
      const result = (await recordPaymentWithCoverage(args)) as PaymentResult;

      // Always refresh — even on duplicate-suppressed we want the dashboard
      // to reconcile its derived state.
      refreshData();
      refreshCoverage();

      if (result?.duplicateSuppressed) {
        toast.info("Duplicate suppressed", {
          description: "An identical payment was just recorded — nothing to add.",
        });
      } else if (result?.rebuildError) {
        // Brief §5: surface engine errors instead of swallowing.
        toast.warning("Payment saved · coverage may be stale", {
          description: "The payment was recorded but coverage rebuild failed. Run Repair Coverage from Settings.",
        });
      } else {
        toast.success("Payment recorded", {
          description: selectedTenant
            ? `${labels.currencySymbol}${amountNum.toLocaleString()} from ${selectedTenant.name}`
            : `${labels.currencySymbol}${amountNum.toLocaleString()} received`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Payment failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>
            <span className="text-brand-gradient">Record payment</span>
          </SheetTitle>
          <SheetDescription>
            Logs the payment and triggers a coverage rebuild for the {labels.occupant.toLowerCase()}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Tenant picker — fixed display when defaultStudentId is set */}
          <div className="space-y-2">
            <Label htmlFor="rp-tenant">{labels.occupant}</Label>
            {defaultStudentId && selectedTenant ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium text-foreground">{selectedTenant.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedTenant.property} · {selectedTenant.room}
                </div>
              </div>
            ) : (
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="rp-tenant">
                  <SelectValue placeholder={`Choose a ${labels.occupant.toLowerCase()}…`} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No {labels.occupantPlural.toLowerCase()} available.
                    </div>
                  ) : tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} <span className="text-muted-foreground">— {t.property} · {t.room}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rp-amount">Amount ({labels.currencySymbol})</Label>
              <Input
                id="rp-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {selectedTenant && (
                <p className="text-xs text-muted-foreground">
                  Rent {labels.currencySymbol}{selectedTenant.rent.toLocaleString()} /
                  {labels.ratePeriod === "month" ? "mo" : "night"}
                  {selectedTenant.balance > 0 && (
                    <> · Balance <span className="text-rose-600 dark:text-rose-400">{labels.currencySymbol}{selectedTenant.balance.toLocaleString()}</span></>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-date">Payment date</Label>
              <Input
                id="rp-date"
                type="date"
                max={localTodayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
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
            <Label htmlFor="rp-method">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger id="rp-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rp-receipt">Receipt number <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="rp-receipt"
              placeholder="e.g. RCP-2026-0142"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rp-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="rp-notes"
              placeholder="Anything to remember about this payment…"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t bg-card p-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2Icon className="animate-spin" />}
            Record payment
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
