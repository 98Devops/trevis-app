import { useState, useMemo } from "react";
import { T, font, fmt, Badge, Bar, Btn } from "./p2_helpers.jsx";

/* ═══════════════════════════════════════════════════════════
   ARREARS MANAGEMENT VIEW
   Internal staff view — shows all students with outstanding balances
═══════════════════════════════════════════════════════════ */
export function Arrears({ props, onStudentClick }) {
  const [filter, setFilter] = useState("ALL");
  const [sortCol, setSortCol] = useState("balance");
  const [sortDir, setSortDir] = useState(-1);
  const [selected, setSelected] = useState(new Set());
  const [propFilter, setPropFilter] = useState("ALL");

  // Build arrears list from all properties
  const allArrears = useMemo(() => {
    const now = new Date();
    return props.flatMap(p =>
      p.rooms.flatMap(r =>
        r.students
          .filter(s => s.status !== "VACANT" && s.status !== "VACATED" && s.status !== "PAID")
          .map(s => {
            const balance = r.rent - s.paid;
            const lastPayDate = s.payHistory && s.payHistory.length > 0
              ? new Date(s.payHistory[0].date) : null;
            const daysSince = lastPayDate
              ? Math.floor((now - lastPayDate) / (1000*60*60*24))
              : s.date ? Math.floor((now - new Date(s.date)) / (1000*60*60*24)) : 999;
            return {
              ...s, property: p.name, propertyColor: (T.prop[p.name]||{accent:T.gold}).accent,
              room: r.no, rent: r.rent, balance, lastPayDate,
              daysSince, notes: s.notes || ""
            };
          })
      )
    ).filter(s => s.balance > 0);
  }, [props]);

  // Aging buckets
  const buckets = useMemo(() => ({
    "0-30": allArrears.filter(s => s.daysSince <= 30),
    "31-60": allArrears.filter(s => s.daysSince > 30 && s.daysSince <= 60),
    "60+": allArrears.filter(s => s.daysSince > 60),
  }), [allArrears]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = allArrears;
    if (propFilter !== "ALL") list = list.filter(s => s.property === propFilter);
    if (filter === "0-30") list = list.filter(s => s.daysSince <= 30);
    else if (filter === "31-60") list = list.filter(s => s.daysSince > 30 && s.daysSince <= 60);
    else if (filter === "60+") list = list.filter(s => s.daysSince > 60);
    return [...list].sort((a, b) => {
      if (sortCol === "name") return sortDir * a.name.localeCompare(b.name);
      if (sortCol === "property") return sortDir * a.property.localeCompare(b.property);
      if (sortCol === "balance") return sortDir * (a.balance - b.balance);
      if (sortCol === "days") return sortDir * (a.daysSince - b.daysSince);
      return 0;
    });
  }, [allArrears, filter, sortCol, sortDir, propFilter]);

  const totalArrears = allArrears.reduce((a, s) => a + s.balance, 0);
  const avgDays = allArrears.length > 0
    ? Math.round(allArrears.reduce((a, s) => a + Math.min(s.daysSince, 365), 0) / allArrears.length) : 0;

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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>Arrears Management</h1>
      </div>

      {/* Summary strip */}
      <div className="pn-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Total Arrears</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.red, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(totalArrears)}</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Students in Arrears</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.amber }}>{allArrears.length}</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Avg Days Overdue</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.amber }}>{avgDays}</div>
        </div>
      </div>

      {/* Aging buckets */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "ALL", label: "All", count: allArrears.length, color: T.muted },
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

      {/* Arrears table — desktop */}
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
            <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>🎉 No outstanding arrears!</div>
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
              <div style={{ fontSize: 12, color: T.amber, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(s.paid)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.red, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(s.balance)}</div>
              <div style={{ fontSize: 11, color: s.daysSince > 60 ? T.red : s.daysSince > 30 ? "#F97316" : T.amber, fontWeight: 600 }}>{s.daysSince}d</div>
              <Badge status={s.status} />
            </div>
          ))}
        </div>
        {/* Bulk actions */}
        {selected.size > 0 && (
          <div style={{ padding: "12px 20px", background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.muted }}>{selected.size} selected</span>
            <Btn accent={T.green} style={{ padding: "6px 14px", fontSize: 11 }}
              onClick={() => { alert(`Mark ${selected.size} as resolved — implement with Supabase update`); setSelected(new Set()); }}>
              Mark Resolved
            </Btn>
            <Btn accent={T.amber} style={{ padding: "6px 14px", fontSize: 11 }}
              onClick={() => { alert(`Flag ${selected.size} for follow-up`); setSelected(new Set()); }}>
              Flag for Follow-up
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
              <div><span style={{ color: T.muted }}>Days: </span><span style={{ color: s.daysSince > 60 ? T.red : T.amber, fontWeight: 600 }}>{s.daysSince}d</span></div>
            </div>
            {s.notes && <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 6 }}>{s.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
