import { useState, useMemo, useEffect } from "react";
import { T, font, fmt, Badge, Btn, DateRangeFilter } from "./p2_helpers.jsx";
import * as CoverageDB from "../services/coverageDatabaseService.js";
import {
  buildFinanceRecords,
  filterFinanceRecords,
  sortByCoverageEnd,
  FINANCE_STATUS_FILTERS,
} from "../services/dashboardAttention.js";

/* ═══════════════════════════════════════════════════════════
   FINANCIAL MANAGEMENT - Complete Financial Hub
   TD-3 (Stabilization): status, outstanding, filters, and sort all derive from the
   COVERAGE engine (getAllStudentsCoverage → classifyStudent), the SAME source of
   truth as the Dashboard. The legacy month-based "balance = rent − paid" + aging
   buckets (days since last payment) are gone. Monthly cash figures (Due/Paid) are
   kept but explicitly labelled monthly, separate from coverage status.
═══════════════════════════════════════════════════════════ */

const FILTER_META = {
  ALL:           { label: "All",          color: T.muted },
  CURRENT:       { label: "Current",      color: T.green },
  EXPIRING_SOON: { label: "Expiring Soon",color: T.amber },
  DUE_TODAY:     { label: "Due Today",    color: "#F97316" },
  OVERDUE:       { label: "Overdue",      color: T.red },
};

export function Finances({ props, onStudentClick, onRecordPayment, user, initialPropFilter }) {
  const [filter, setFilter] = useState("ALL");
  const [sortCol, setSortCol] = useState("coverage");
  const [sortDir, setSortDir] = useState(1); // coverage_end ascending = soonest first
  const [selected, setSelected] = useState(new Set());
  const [propFilter, setPropFilter] = useState(initialPropFilter || "ALL");
  const [dateRange, setDateRange] = useState("This Month");
  const [searchQuery, setSearchQuery] = useState("");

  // TD-3: single coverage fetch (one query, not N+1), refetched on [props] so it
  // stays in sync with every payment mutation — same pattern as the Dashboard.
  const [coverageStudents, setCoverageStudents] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchCoverage() {
      setIsLoading(true);
      const students = await CoverageDB.getAllStudentsCoverage();
      if (!cancelled) {
        setCoverageStudents(students);
        setIsLoading(false);
      }
    }
    fetchCoverage();
    return () => { cancelled = true; };
  }, [props]);

  // All ACTIVE students as coverage records (status/outstanding/days from the engine).
  const allRecords = useMemo(() => buildFinanceRecords(coverageStudents), [coverageStudents]);

  // Coverage-status buckets (replaces aging buckets).
  const buckets = useMemo(() => {
    const m = {};
    for (const key of FINANCE_STATUS_FILTERS) m[key] = filterFinanceRecords(allRecords, key);
    return m;
  }, [allRecords]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = buckets[filter] || allRecords;
    if (propFilter !== "ALL") list = list.filter(s => s.property === propFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.property.toLowerCase().includes(q) ||
        String(s.room).toLowerCase().includes(q)
      );
    }
    if (sortCol === "coverage") {
      const byEnd = sortByCoverageEnd(list);
      return sortDir === 1 ? byEnd : byEnd.reverse();
    }
    return [...list].sort((a, b) => {
      if (sortCol === "name") return sortDir * a.name.localeCompare(b.name);
      if (sortCol === "property") return sortDir * a.property.localeCompare(b.property);
      if (sortCol === "outstanding") return sortDir * (a.outstanding - b.outstanding);
      return 0;
    });
  }, [allRecords, filter, sortCol, sortDir, propFilter, buckets, searchQuery]);

  // Coverage-based totals.
  const inArrears = allRecords.filter(s => ["OVERDUE", "DUE_TODAY"].includes(s.coverageStatus));
  const totalOutstanding = allRecords.reduce((a, s) => a + s.outstanding, 0);
  // Monthly cash figures (cash basis) — kept for context, labelled monthly.
  const monthlyDue = useMemo(() =>
    props.flatMap(p => p.rooms.flatMap(r =>
      r.students.filter(s => s.status !== "VACANT" && s.status !== "VACATED").map(() => r.rent)
    )).reduce((a, n) => a + n, 0), [props]);
  const monthlyPaid = useMemo(() =>
    props.flatMap(p => p.rooms.flatMap(r =>
      r.students.filter(s => s.status !== "VACANT" && s.status !== "VACATED").map(s => s.paid)
    )).reduce((a, n) => a + n, 0), [props]);
  const collectionRate = monthlyDue > 0 ? ((monthlyPaid / monthlyDue) * 100).toFixed(1) : "0";

  const toggleSort = (col) => { if (sortCol === col) setSortDir(d => -d); else { setSortCol(col); setSortDir(col === "coverage" ? 1 : -1); } };
  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  };

  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, color: T.gold, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 4 }}>{monthLabel}</h2>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>Financial Management</h1>
      </div>

      {/* Summary strip */}
      <div className="pn-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Students</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.blue, fontFamily: "'IBM Plex Mono',monospace" }}>{allRecords.length}</div>
          <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>{inArrears.length} overdue</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Outstanding</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: totalOutstanding>0?T.red:T.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(totalOutstanding)}</div>
          <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>coverage (days × daily rate)</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Collected (mo)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(monthlyPaid)}</div>
          <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>of {fmt(monthlyDue)} monthly cash</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Collection Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.gold, fontFamily: "'IBM Plex Mono',monospace" }}>{collectionRate}%</div>
          <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>monthly cash basis</div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Date Range</div>
        <DateRangeFilter value={dateRange} onChange={(range) => setDateRange(range)} />
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search by name, property, or room..."
          style={{
            width: "100%",
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "10px 14px",
            color: T.text,
            fontSize: 13,
            fontFamily: font,
            outline: "none"
          }}
        />
      </div>

      {/* Coverage-status filters (TD-3 — replaces aging buckets) */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {FINANCE_STATUS_FILTERS.map(key => {
          const meta = FILTER_META[key];
          const list = buckets[key] || [];
          const amount = key === "ALL" ? totalOutstanding : list.reduce((a, s) => a + s.outstanding, 0);
          return (
            <button key={key} onClick={() => setFilter(key)}
              style={{ background: filter === key ? `${meta.color}20` : T.card, border: `1px solid ${filter === key ? meta.color : T.border}`,
                borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: font, transition: "all .15s",
                display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{meta.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: meta.color }}>{list.length}</div>
              {amount > 0 && <div style={{ fontSize: 10, color: T.muted }}>{fmt(amount)}</div>}
            </button>
          );
        })}
        {/* Property filter */}
        <select value={propFilter} onChange={e => setPropFilter(e.target.value)}
          style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px",
            color: T.text, fontSize: 12, fontFamily: font, marginLeft: "auto" }}>
          <option value="ALL">All Properties</option>
          {props.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {/* Financial records table */}
      <div className="pn-attn-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "30px 2fr 1fr 0.8fr 1.2fr 1fr 1.2fr 1fr", gap: 8, padding: "10px 20px",
          background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <div><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll}
            style={{ accentColor: T.gold }} /></div>
          {[["Student","name"],["Property","property"],["Room",""],["Coverage Ends","coverage"],["Days",""],["Outstanding","outstanding"],["Status",""]].map(([h,col]) => (
            <div key={h} onClick={() => col && toggleSort(col)} style={{ fontSize: 10, color: T.muted, textTransform: "uppercase",
              letterSpacing: "0.1em", fontWeight: 600, cursor: col ? "pointer" : "default" }}>
              {h}{sortCol === col ? (sortDir === 1 ? " ▲" : " ▼") : ""}
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 440, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading coverage…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>🎉 No records match your filters!</div>
          ) : filtered.map(s => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "30px 2fr 1fr 0.8fr 1.2fr 1fr 1.2fr 1fr", gap: 8,
              padding: "12px 20px", borderBottom: `1px solid ${T.border}20`, alignItems: "center", transition: "background .15s",
              background: selected.has(s.id) ? `${T.gold}10` : "transparent" }}
              onMouseEnter={e => e.currentTarget.style.background = selected.has(s.id) ? `${T.gold}15` : T.hover}
              onMouseLeave={e => e.currentTarget.style.background = selected.has(s.id) ? `${T.gold}10` : "transparent"}>
              <div><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} style={{ accentColor: T.gold }} /></div>
              <div onClick={() => onStudentClick && onStudentClick(s, { no: s.room, rent: s.roomRent }, s.property)} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.name}</div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{fmt(s.roomRent)}/mo · {fmt(s.dailyRate)}/day</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.propertyColor || T.gold }} />
                <span style={{ fontSize: 12, color: T.subtle }}>{s.property}</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>{s.room}</div>
              <div style={{ fontSize: 12, color: T.subtle, fontFamily: "'IBM Plex Mono',monospace" }}>{s.coverageEnd || "—"}</div>
              <div style={{ fontSize: 11, color: s.coverageStatus==="OVERDUE"?T.red:s.coverageStatus==="DUE_TODAY"?"#F97316":s.coverageStatus==="EXPIRING_SOON"?T.amber:T.green, fontWeight: 600 }}>{s.daysLabel}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.outstanding>0?T.red:T.green, fontFamily: "'IBM Plex Mono',monospace" }}>{s.outstanding>0?fmt(s.outstanding):"—"}</div>
              <Badge status={s.coverageStatus} />
            </div>
          ))}
        </div>
        {/* Bulk actions */}
        {selected.size > 0 && (
          <div style={{ padding: "12px 20px", background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: T.muted }}>{selected.size} selected</span>
            <Btn accent={T.green} style={{ padding: "6px 14px", fontSize: 11 }}
              onClick={() => {
                alert(`Record bulk payment for ${selected.size} students`);
                setSelected(new Set());
              }}>
              💰 Record Payment
            </Btn>
            <Btn accent={T.amber} style={{ padding: "6px 14px", fontSize: 11 }}
              onClick={() => {
                alert(`Send WhatsApp reminders to ${selected.size} students`);
                setSelected(new Set());
              }}>
              📱 Send Reminder
            </Btn>
            <Btn accent={T.blue} style={{ padding: "6px 14px", fontSize: 11 }}
              onClick={() => {
                const selectedStudents = filtered.filter(s => selected.has(s.id));
                let csv = "Name,Property,Room,MonthlyRent,DailyRate,CoverageEnd,Days,Outstanding,Status\n";
                selectedStudents.forEach(s => csv += `"${s.name}",${s.property},${s.room},${s.roomRent},${s.dailyRate},${s.coverageEnd||""},"${s.daysLabel}",${s.outstanding},${s.coverageStatus}\n`);
                const blob = new Blob([csv], { type:"text/csv" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                a.download = `Financial_Export_${new Date().toISOString().slice(0,10)}.csv`; a.click();
                setSelected(new Set());
              }}>
              ↓ Export Selected
            </Btn>
          </div>
        )}
      </div>

      {/* Mobile card layout */}
      <div className="pn-attn-cards" style={{ display: "none", flexDirection: "column", gap: 8 }}>
        {isLoading ? (
          <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13, background: T.card, borderRadius: 12 }}>Loading coverage…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13, background: T.card, borderRadius: 12 }}>🎉 No records match your filters!</div>
        ) : filtered.map(s => (
          <div key={s.id + "m"} onClick={() => onStudentClick && onStudentClick(s, { no: s.room, rent: s.roomRent }, s.property)}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{s.name}</div>
              <Badge status={s.coverageStatus} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
              <div><span style={{ color: T.muted }}>Property: </span><span style={{ color: T.subtle }}>{s.property}</span></div>
              <div><span style={{ color: T.muted }}>Room: </span><span style={{ color: T.subtle }}>{s.room}</span></div>
              <div><span style={{ color: T.muted }}>Coverage ends: </span><span style={{ color: T.subtle }}>{s.coverageEnd || "—"}</span></div>
              <div><span style={{ color: T.muted }}>{s.daysLabel}</span></div>
              <div><span style={{ color: T.muted }}>Outstanding: </span><span style={{ color: s.outstanding>0?T.red:T.green, fontWeight: 700 }}>{s.outstanding>0?fmt(s.outstanding):"—"}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
