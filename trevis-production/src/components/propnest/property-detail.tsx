import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftIcon, BedSingleIcon, Download, PencilIcon, PlusIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import { money, moneyCompact } from "./fmt";
import { RoomRow } from "./room-row";
import { Panel } from "./panel";
import { StatCard } from "./stat-card";
import { DeltaPill } from "./delta-pill";
import { usePortfolioCoverage, usePortfolioAttention, type PortfolioRow } from "./use-portfolio";
import { RecordPaymentSheet } from "./modals/record-payment-sheet";
import { AddTenantSheet } from "./modals/add-tenant-sheet";
import { AddRoomSheet } from "./modals/add-room-sheet";
import { EditPropertySheet } from "./modals/edit-property-sheet";
import { useLabels } from "@/lib/vertical-labels";
import { useData, useAuth } from "@/parts/p1_imports_context.jsx";
import { downloadCsv, slug, timestamp } from "@/lib/csv";
import { toast } from "sonner";

export function PropertyDetail({
  property,
  onBack,
}: {
  property: PortfolioRow;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [addTenantOpen, setAddTenantOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { coverageMap, loading: coverageLoading, refresh: refreshCoverage } = usePortfolioCoverage();
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };
  const { rows: attentionRows } = usePortfolioAttention();
  const labels = useLabels();
  const auth = useAuth() as unknown as { user?: { role?: string } | null } | null;
  const role = auth?.user?.role?.toUpperCase();
  const isAdmin = role === "ADMIN";

  const exportCsv = () => {
    const headers = [
      labels.property, labels.unit, labels.occupant, "Phone", "National ID",
      "Status", "Coverage", "Rent", "Paid (month)", "Balance", "Check-in", "Notes",
    ] as const;
    const rows: Array<readonly unknown[]> = [];
    for (const r of property.rooms) {
      for (const s of r.students) {
        if (s.status === "VACANT" || s.status === "VACATED") continue;
        const cov = coverageMap.get(s.id);
        rows.push([
          property.name, r.no, s.name, s.phone ?? "", s.idNumber ?? "",
          s.status, cov?.status ?? "EXCLUDED", r.rent, s.paid, s.balance,
          s.date && s.date !== "—" ? s.date : "", s.notes ?? "",
        ]);
      }
    }
    if (rows.length === 0) {
      toast.info("Nothing to export", { description: `No active ${labels.occupantPlural.toLowerCase()} in ${property.name}.` });
      return;
    }
    downloadCsv(`PropNest_${slug(property.name)}_${timestamp()}.csv`, headers, rows);
    toast.success("CSV downloaded", { description: `${rows.length} ${rows.length === 1 ? labels.occupant.toLowerCase() : labels.occupantPlural.toLowerCase()} from ${property.name}.` });
  };

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return property.rooms;
    return property.rooms.filter(
      (r) =>
        r.no.toLowerCase().includes(q) ||
        r.students.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [property.rooms, search]);

  const collectionPct = property.expected > 0
    ? Math.round((property.collected / property.expected) * 100)
    : 0;
  const occPct = property.totalBeds > 0
    ? Math.round((property.students / property.totalBeds) * 100)
    : 0;
  // Coverage-derived attention for THIS property (matches dashboard / finance).
  const propAttention = attentionRows.filter((r) => r.property === property.name);
  const attentionCount = propAttention.length;
  const attentionOutstanding = propAttention.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5 text-muted-foreground">
        <ArrowLeftIcon className="size-3.5" />
        Back to properties
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: property.color }}
          >
            {property.location}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">{property.name}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {property.rooms.length} room{property.rooms.length === 1 ? "" : "s"} · {property.totalBeds} bed{property.totalBeds === 1 ? "" : "s"} · {property.students} tenant{property.students === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={property.students === 0}>
            <Download /> Export CSV
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit property
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setAddRoomOpen(true)}>
              <BedSingleIcon /> Add {labels.unit.toLowerCase()}
            </Button>
          )}
          <Button variant="outline" onClick={() => setAddTenantOpen(true)}>
            <UserPlusIcon /> {labels.addOccupant}
          </Button>
          <Button variant="gradient" onClick={() => setPayOpen(true)} disabled={property.students === 0}>
            <PlusIcon /> Record payment
          </Button>
        </div>
      </header>

      <RecordPaymentSheet
        open={payOpen}
        onOpenChange={setPayOpen}
        propertyId={property.id}
      />
      <AddTenantSheet
        open={addTenantOpen}
        onOpenChange={setAddTenantOpen}
        property={property}
      />
      {isAdmin && (
        <AddRoomSheet
          open={addRoomOpen}
          onOpenChange={setAddRoomOpen}
          property={property}
        />
      )}
      {isAdmin && (
        <EditPropertySheet
          open={editOpen}
          onOpenChange={setEditOpen}
          property={{ id: property.id, name: property.name, location: property.location }}
          onSaved={() => {
            refreshData();
            refreshCoverage();
          }}
        />
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          featured
          label="Collected"
          value={moneyCompact(property.collected)}
          delta={<DeltaPill tone={collectionPct >= 90 ? "positive" : collectionPct >= 70 ? "neutral" : "negative"}>{collectionPct}%</DeltaPill>}
          caption={`of ${moneyCompact(property.expected)} expected`}
          progress={collectionPct}
        />
        <StatCard
          label="Occupancy"
          value={`${occPct}%`}
          caption={`${property.students} of ${property.totalBeds} beds`}
          progress={occPct}
        />
        <StatCard
          label="Rooms"
          value={String(property.rooms.length)}
          caption="In this property"
        />
        <StatCard
          label="Vacant"
          value={String(property.vacantBeds)}
          caption={property.vacantBeds === 0 ? "Fully occupied" : "Beds available"}
        />
        <StatCard
          label="Attention"
          value={String(attentionCount)}
          delta={attentionCount > 0
            ? <DeltaPill tone="negative">need follow-up</DeltaPill>
            : <DeltaPill tone="positive">all clear</DeltaPill>}
          caption={attentionCount === 0 ? "Coverage up to date" : `${money(attentionOutstanding)} outstanding`}
        />
      </section>

      <Panel>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Rooms & tenants</h3>
            <p className="text-xs text-muted-foreground">
              {filteredRooms.length} of {property.rooms.length} room{property.rooms.length === 1 ? "" : "s"}
              {coverageLoading && <span className="ml-2 italic">· loading coverage…</span>}
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms or tenants…"
              className="pl-9"
            />
          </div>
        </header>
        <div className="p-5">
          {filteredRooms.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No rooms match your search.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRooms.map((room) => (
                <RoomRow key={room.id} room={room} coverageMap={coverageMap} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
