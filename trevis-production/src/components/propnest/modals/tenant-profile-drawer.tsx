import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PlusIcon, UserMinusIcon, ExternalLinkIcon, PhoneIcon, IdCardIcon, CalendarIcon, BedSingleIcon, BuildingIcon,
  UserIcon, StickyNoteIcon, ArrowRightLeftIcon,
} from "lucide-react";
import { useNav } from "@/lib/propnest-nav";
import { useLabels } from "@/lib/vertical-labels";
// Engine modules (brief §3) — consumed without modification.
import { useAuth, useData } from "@/parts/p1_imports_context.jsx";
import { updateStudent } from "@/services/studentService.js";
import { usePortfolio, usePortfolioCoverage } from "../use-portfolio";
import { CoverageStatusBadge, coverageSubLabel } from "../coverage";
import { CoverageBreakdown } from "../coverage-breakdown";
import { EditableField } from "../editable-field";
import { money, formatDate } from "../fmt";
import { RecordPaymentSheet } from "./record-payment-sheet";
import { PaymentRowActions } from "./payment-row-actions";
import { VacateTenantDialog } from "./vacate-tenant-dialog";
import { TransferTenantSheet } from "./transfer-tenant-sheet";

/**
 * Mounted once at the shell level. Opens whenever NavContext.openTenant(id)
 * is called from anywhere (room row, Tenants table, Finance ledger).
 */
export function TenantProfileDrawer() {
  const { selectedTenantId, closeTenant, openProperty } = useNav();
  const { findTenant } = usePortfolio();
  const { coverageMap, refresh: refreshCoverage } = usePortfolioCoverage() as unknown as {
    coverageMap: Map<string, { status: string; daysRemaining?: number; daysOverdue?: number; coverageEnd?: string }>;
    refresh: () => void;
  };
  const labels = useLabels();
  const auth = useAuth() as unknown as { user?: { role?: string } | null } | null;
  const isAdmin = auth?.user?.role?.toUpperCase() === "ADMIN";
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };

  // Persist one student column, then reconcile every screen. Throws on error so
  // EditableField surfaces it as a toast (brief §5). updateStudent only rebuilds
  // coverage on room/status changes — these profile fields don't, so it's cheap.
  const saveField = (column: string) => async (next: string) => {
    if (!selectedTenantId) return;
    const { error } = (await updateStudent(selectedTenantId, { [column]: next || null })) as {
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    refreshData();
    refreshCoverage();
  };

  const [payOpen, setPayOpen] = useState(false);
  const [vacateOpen, setVacateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const found = findTenant(selectedTenantId);
  const open = !!selectedTenantId;

  // History sorting derived even when found is null to keep hook order stable.
  const sortedHistory = useMemo(() => {
    const list = found?.tenant.payHistory ?? [];
    return [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [found]);

  if (!found) {
    // Drawer still mounted (closed) so transitions feel right when the id arrives.
    return (
      <Sheet open={open} onOpenChange={(o) => !o && closeTenant()}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{labels.occupant} not found</SheetTitle>
            <SheetDescription>This record may have been removed or refreshed.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const { tenant, property, room } = found;
  const cov = coverageMap.get(tenant.id) ?? null;
  const totalPaid = sortedHistory.reduce((s, p) => s + Number(p.amount || 0), 0);
  const nowMonth = new Date().toISOString().slice(0, 7);
  const thisMonthPaid = sortedHistory
    .filter((p) => (p.date || "").startsWith(nowMonth))
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const isActive = tenant.status !== "VACATED" && tenant.status !== "VACANT";

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && closeTenant()}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span className="text-brand-gradient text-xl font-bold">{tenant.name}</span>
              <Badge variant={isActive ? "secondary" : "outline"}>{tenant.status?.toLowerCase()}</Badge>
              <CoverageStatusBadge coverage={cov} />
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-1.5 text-xs">
              <BuildingIcon className="size-3.5" />
              <button
                type="button"
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: property.color }}
                onClick={() => { closeTenant(); openProperty(property.id); }}
              >
                {property.name}
              </button>
              <span>·</span>
              <BedSingleIcon className="size-3.5" />
              <span>{room.no}</span>
              <span>·</span>
              <span className="tabular-nums">{money(room.rent)}/{labels.ratePeriod === "month" ? "mo" : "night"}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* KPI strip */}
            <section className="grid grid-cols-2 gap-3 border-b p-5">
              <Kpi label="Balance" value={money(tenant.balance)} tone={tenant.balance > 0 ? "negative" : "neutral"} />
              <Kpi label="Paid this month" value={money(thisMonthPaid)} />
              <Kpi label="Paid all-time" value={money(totalPaid)} />
              <Kpi
                label={cov?.status === "OVERDUE" ? "Days overdue" : "Days remaining"}
                value={String(cov?.status === "OVERDUE" ? (cov.daysOverdue ?? 0) : (cov?.daysRemaining ?? 0))}
                tone={cov?.status === "OVERDUE" ? "negative" : "neutral"}
                sub={coverageSubLabel(cov)}
              />
            </section>

            {/* Personal info — inline-editable (brief §15 #1) */}
            <section className="space-y-3 border-b p-5">
              <h3 className="text-sm font-semibold text-foreground">Details</h3>
              <EditableField
                icon={<UserIcon className="size-4" />}
                label={`${labels.occupant} name`}
                value={tenant.name}
                placeholder="Full name"
                onSave={saveField("full_name")}
              />
              <EditableField
                icon={<PhoneIcon className="size-4" />}
                label="Phone"
                type="tel"
                value={tenant.phone}
                placeholder="e.g. +1 555 0100"
                onSave={saveField("phone")}
              />
              <EditableField
                icon={<IdCardIcon className="size-4" />}
                label="National ID"
                value={tenant.idNumber}
                placeholder="ID number"
                onSave={saveField("national_id")}
              />
              <EditableField
                icon={<CalendarIcon className="size-4" />}
                label="Check-in"
                type="date"
                value={tenant.date && tenant.date !== "—" ? tenant.date : ""}
                onSave={saveField("check_in_date")}
              />
              <EditableField
                icon={<StickyNoteIcon className="size-4" />}
                label="Notes"
                type="textarea"
                value={tenant.notes ?? ""}
                placeholder="Anything to remember…"
                onSave={saveField("notes")}
              />
            </section>

            {/* Coverage breakdown — chain-aware ledger replay (Trevis parity).
                storedCoverageEnd lets it flag cache drift vs the ledger. */}
            <CoverageBreakdown
              payHistory={sortedHistory}
              monthlyRent={room.rent}
              storedCoverageEnd={selectedTenantId ? coverageMap.get(selectedTenantId)?.coverageEnd ?? null : null}
            />

            {/* Payment history */}
            <section className="p-5">
              <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-foreground">
                Payment history
                <span className="text-xs font-normal text-muted-foreground">
                  {sortedHistory.length} payment{sortedHistory.length === 1 ? "" : "s"}
                </span>
              </h3>
              {sortedHistory.length === 0 ? (
                <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead className="text-right tabular-nums">Amount</TableHead>
                        <TableHead className="pe-2 w-9" aria-label="Actions" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedHistory.map((p) => (
                        <TableRow key={p.id} className="h-11">
                          <TableCell className="ps-4 tabular-nums">{p.date ? formatDate(p.date) : "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{p.method ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{p.receipt ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{money(Number(p.amount))}</TableCell>
                          <TableCell className="pe-2">
                            <PaymentRowActions
                              payment={p}
                              canDelete={isAdmin}
                              onChanged={() => { refreshData(); refreshCoverage(); }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-card p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { closeTenant(); openProperty(property.id); }}
            >
              <ExternalLinkIcon /> Open property
            </Button>
            <div className="flex items-center gap-2">
              {isAdmin && isActive && (
                <Button variant="outline" onClick={() => setTransferOpen(true)}>
                  <ArrowRightLeftIcon /> Transfer
                </Button>
              )}
              {isAdmin && isActive && (
                <Button variant="outline" onClick={() => setVacateOpen(true)} className="text-rose-600 hover:text-rose-700 dark:text-rose-400">
                  <UserMinusIcon /> Vacate
                </Button>
              )}
              {isActive && (
                <Button variant="gradient" onClick={() => setPayOpen(true)}>
                  <PlusIcon /> Record payment
                </Button>
              )}
            </div>
          </footer>
        </SheetContent>
      </Sheet>

      {/* Nested sheets — mounted alongside so opening one doesn't unmount the drawer */}
      <RecordPaymentSheet
        open={payOpen}
        onOpenChange={setPayOpen}
        defaultStudentId={tenant.id}
      />
      <VacateTenantDialog
        open={vacateOpen}
        onOpenChange={setVacateOpen}
        tenantId={tenant.id}
        tenantName={tenant.name}
        onSuccess={closeTenant}
      />
      <TransferTenantSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        tenantId={tenant.id}
        tenantName={tenant.name}
        fromRoomId={room.id}
        fromLabel={`${property.name} · ${room.no}`}
        currentRent={room.rent}
      />
    </>
  );
}

function Kpi({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: "neutral" | "negative";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums text-xl font-semibold ${tone === "negative" ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

