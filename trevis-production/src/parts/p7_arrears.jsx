import { useState, useMemo } from "react";
import { T, font, fmt, Badge, Bar, Btn, daysSince, daysColor, DateRangeFilter } from "./p2_helpers.jsx";

/* ═══════════════════════════════════════════════════════════
   FINANCIAL MANAGEMENT - Complete Financial Hub
   Shows: Due, Paid, Balance, Rate + Payment Recording & Reconciliation
═══════════════════════════════════════════════════════════ */
export function Finances({ props, onStudentClick, onRecordPayment, user, initialPropFilter }) {
  const [filter, setFilter] = useState("ALL");
  const [sortCol, setSortCol] = useState("balance");
  const [sortDir, setSortDir] = useState(-1);
  const [selected, setSelected] = useState(new Set());
  const [propFilter, setPropFilter] = useState(initialPropFilter || "ALL");
  const [viewMode, setViewMode] = useState("students"); // students | rooms | properties
  const [editingPayment, setEditingPayment] = useState(null);
  const [dateRange, setDateRange] = useState("This Month");
  const [searchQuery, setSearchQuery] = useState("");

  // Build financial records from all properties
  const allRecords = useMemo(() => {
    const now = new Date();
    return props.flatMap(p =>
      p.rooms.flatMap(r =>
        r.students
          .filter(s => s.status !== "VACANT" && s.status !== "VACATED")
          .map(s => {
            const balance = r.rent - s.paid;
            const lastPayDate = s.payHistory && s.payHistory.length > 0
              ? new Date(s.payHistory[0].date) : null;
            const daysSincePayment = lastPayDate ? daysSince(s.payHistory[0].date) : 
              (s.date ? daysSince(s.date) : 999);
            return {
              ...s, property: p.name, propertyColor: (T.prop[p.name]||{accent:T.gold}).accent,
              room: r.no, roomId: r.id, rent: r.rent, balance, lastPayDate,
              daysSince: daysSincePayment, notes: s.notes || "", 
              status: balance > 0 ? (s.paid > 0 ? "PARTIAL" : "OVERDUE") : "PAID"
            };
          })
      )
    );
  }, [props]);

  // Aging buckets
  const buckets = useMemo(() => ({
    "ALL": allRecords,
    "0-30": allRecords.filter(s => s.daysSince <= 30 && s.balance > 0),
    "31-60": allRecords.filter(s => s.daysSince > 30 && s.daysSince <= 60 && s.balance > 0),
    "60+": allRecords.filter(s => s.daysSince > 60 && s.balance > 0),
  }), [allRecords]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = buckets[filter] || allRecords;
    if (propFilter !== "ALL") list = list.filter(s => s.property === propFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.property.toLowerCase().includes(q) ||
        s.room.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      if (sortCol === "name") return sortDir * a.name.localeCompare(b.name);
      if (sortCol === "property") return sortDir * a.property.localeCompare(b.property);
      if (sortCol === "balance") return sortDir * (a.balance - b.balance);
      if (sortCol === "days") return sortDir * (a.daysSince - b.daysSince);
      return 0;
    });
  }, [allRecords, filter, sortCol, sortDir, propFilter, buckets, searchQuery]);

  const totalArrears = allRecords.filter(s=>s.balance>0).reduce((a, s) => a + s.balance, 0);
  const totalDue = allRecords.reduce((a, s) => a + s.rent, 0);
  const totalPaid = allRecords.reduce((a, s) => a + s.paid, 0);
  const collectionRate = totalDue > 0 ? ((totalPaid / totalDue) * 100).toFixed(1) : "0";
  const avgDays = allRecords.filter(s=>s.balance>0).length > 0
    ? Math.round(allRecords.filter(s=>s.balance>0).reduce((a, s) => a + Math.min(s.daysSince, 365), 0) / allRecords.filter(s=>s.balance>0).length) : 0;

  const toggleSort = (col) => { if (sortCol === col) setSortDir(d => -d); else { setSortCol(col); setSortDir(-1); } };
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
          <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>{allRecords.filter(s=>s.balance>0).length} in arrears</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Due</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(totalDue)}</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Paid</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(totalPaid)}</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Balance</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: totalArrears>0?T.red:T.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(totalArrears)}</div>
          <div style={{ fontSize: 11, color: T.gold, marginTop: 4 }}>{collectionRate}% rate</div>
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
          placeholder="🔍 Search by name, property, room, or notes..."
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

      {/* Aging buckets + filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { key: "ALL", label: "All", count: allRecords.length, color: T.muted },
          { key: "0-30", label: "0–30 days", count: buckets["0-30"].length, color: T.amber, amount: buckets["0-30"].reduce((a,s)=>a+s.balance,0) },
          { key: "31-60", label: "31–60 days", count: buckets["31-60"].length, color: "#F97316", amount: buckets["31-60"].reduce((a,s)=>a+s.balance,0) },
          { key: "60+", label: "60+ days", count: buckets["60+"].length, color: T.red, amount: buckets["60+"].reduce((a,s)=>a+s.balance,0) },
        ].map(b => (
          <button key={b.key} onClick={() => setFilter(b.key)}
            style={{ background: filter === b.key ? `${b.color}20` : T.card, border: `1px solid ${filter === b.key ? b.color : T.border}`,
              borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: font, transition: "all .15s",
              display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: b.color }}>{b.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: b.color }}>{b.count}</div>
            {b.amount !== undefined && <div style={{ fontSize: 10, color: T.muted }}>{fmt(b.amount)}</div>}
          </button>
        ))}
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
        <div style={{ display: "grid", gridTemplateColumns: "30px 2fr 1fr 0.8fr 1fr 1fr 1fr 0.8fr 1fr", gap: 8, padding: "10px 20px",
          background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <div><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll}
            style={{ accentColor: T.gold }} /></div>
          {[["Student","name"],["Property","property"],["Room",""],["Rent",""],["Paid",""],["Balance","balance"],["Days","days"],["Status",""]].map(([h,col]) => (
            <div key={h} onClick={() => col && toggleSort(col)} style={{ fontSize: 10, color: T.muted, textTransform: "uppercase",
              letterSpacing: "0.1em", fontWeight: 600, cursor: col ? "pointer" : "default" }}>
              {h}{sortCol === col ? (sortDir === 1 ? " ▲" : " ▼") : ""}
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 440, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>🎉 No records match your filters!</div>
          ) : filtered.map(s => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "30px 2fr 1fr 0.8fr 1fr 1fr 1fr 0.8fr 1fr", gap: 8,
              padding: "12px 20px", borderBottom: `1px solid ${T.border}20`, alignItems: "center", transition: "background .15s",
              background: selected.has(s.id) ? `${T.gold}10` : "transparent" }}
              onMouseEnter={e => e.currentTarget.style.background = selected.has(s.id) ? `${T.gold}15` : T.hover}
              onMouseLeave={e => e.currentTarget.style.background = selected.has(s.id) ? `${T.gold}10` : "transparent"}>
              <div><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} style={{ accentColor: T.gold }} /></div>
              <div onClick={() => onStudentClick && onStudentClick(s, { no: s.room, rent: s.rent }, s.property)} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.name}</div>
                {s.notes && <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 2 }}>{s.notes}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.propertyColor }} />
                <span style={{ fontSize: 12, color: T.subtle }}>{s.property}</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>{s.room}</div>
              <div style={{ fontSize: 12, color: T.subtle, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(s.rent)}</div>
              <div style={{ fontSize: 12, color: s.paid>=s.rent?T.green:T.amber, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(s.paid)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.balance>0?T.red:T.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(s.balance)}</div>
              <div style={{ fontSize: 11, color: daysColor(s.daysSince), fontWeight: 600 }}>{s.daysSince}d</div>
              <Badge status={s.status} />
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
                let csv = "Name,Property,Room,Rent,Paid,Balance,Days,Status\n";
                selectedStudents.forEach(s => csv += `"${s.name}",${s.property},${s.room},${s.rent},${s.paid},${s.balance},${s.daysSince},${s.status}\n`);
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
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13, background: T.card, borderRadius: 12 }}>🎉 No outstanding arrears!</div>
        ) : filtered.map(s => (
          <div key={s.id + "m"} onClick={() => onStudentClick && onStudentClick(s, { no: s.room, rent: s.rent }, s.property)}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{s.name}</div>
              <Badge status={s.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
              <div><span style={{ color: T.muted }}>Property: </span><span style={{ color: T.subtle }}>{s.property}</span></div>
              <div><span style={{ color: T.muted }}>Room: </span><span style={{ color: T.subtle }}>{s.room}</span></div>
              <div><span style={{ color: T.muted }}>Balance: </span><span style={{ color: T.red, fontWeight: 700 }}>{fmt(s.balance)}</span></div>
              <div><span style={{ color: T.muted }}>Days: </span><span style={{ color: daysColor(s.daysSince), fontWeight: 600 }}>{s.daysSince}d</span></div>
            </div>
            {s.notes && <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 6 }}>{s.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

