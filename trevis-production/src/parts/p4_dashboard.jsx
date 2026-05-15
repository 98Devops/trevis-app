import { useState, useMemo } from "react";
import { T, font, fmt, Badge, Stat, Bar, Btn } from "./p2_helpers.jsx";

/* ═══════════════════════════════════════════════════════════
   DASHBOARD VIEW
═══════════════════════════════════════════════════════════ */
export function Dashboard({ props, onSelect, onAddStudent, onRecordPayment, onExport }) {
  const [timeRange, setTimeRange] = useState("month");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState(1);

  const totals = useMemo(() => props.reduce((a, p) => ({
    students:  a.students  + p.students,
    collected: a.collected + p.collected,
    expected:  a.expected  + p.expected,
    overdue:   a.overdue   + p.overdue.length,
    vacantBeds: a.vacantBeds + p.vacantBeds,
  }), { students:0, collected:0, expected:0, overdue:0, vacantBeds:0 }), [props]);

  const rate = totals.expected > 0 ? ((totals.collected / totals.expected) * 100).toFixed(1) : "0.0";
  const now = new Date();
  const monthYear = now.toLocaleString("en-US", { month:"long", year:"numeric" });

  const allOverdue = props.flatMap(p => p.overdue.map(s => ({ ...s, property: p.name })));
  const sorted = [...allOverdue].sort((a,b) => {
    if (sortCol==="name") return sortDir * a.name.localeCompare(b.name);
    if (sortCol==="property") return sortDir * a.property.localeCompare(b.property);
    if (sortCol==="balance") return sortDir * ((a.roomRent-a.paid) - (b.roomRent-b.paid));
    return 0;
  });
  const toggleSort = (col) => { if(sortCol===col) setSortDir(d=>-d); else { setSortCol(col); setSortDir(1); } };

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:13, color:T.gold, textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:600, marginBottom:4 }}>{monthYear}</h2>
        <div className="pn-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h1 style={{ fontSize:28, fontWeight:800, color:T.text, margin:0 }}>Portfolio Overview</h1>
          <div style={{ display:"flex", gap:4, background:T.surface, borderRadius:8, padding:2 }}>
            {[["month","This Month"],["all","All Time"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTimeRange(k)} style={{ background:timeRange===k?T.gold:"none", border:"none", borderRadius:6,
                padding:"6px 14px", color:timeRange===k?"#0D0F14":T.muted, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:font }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="pn-kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        <Stat label="Total Students" value={totals.students} accent={T.blue} />
        <Stat label="Collected" value={fmt(totals.collected)} accent={T.green} />
        <Stat label="Outstanding" value={fmt(totals.expected-totals.collected)} accent={T.red} sub={`${totals.vacantBeds} vacant beds`} />
        <Stat label="Collection Rate" value={`${rate}%`} sub={`${totals.overdue} need attention`} accent={T.gold} />
      </div>

      {/* Quick Actions */}
      <div className="pn-quick-actions" style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
        <Btn accent={T.gold} onClick={onAddStudent}>+ Add Student</Btn>
        <Btn accent={T.green} onClick={onRecordPayment}>+ Record Payment</Btn>
        <Btn accent={T.blue} onClick={onExport} style={{color:"#fff"}}>↓ Download Report</Btn>
      </div>

      {/* Collection bar chart — grouped bars */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>Collected vs Expected by Property</div>
        {/* Desktop: vertical grouped bars */}
        <div className="pn-chart-desktop" style={{ display:"flex", gap:32, alignItems:"flex-end", minHeight:240, padding:"0 8px" }}>
          {props.map(p => {
            const maxVal = Math.max(...props.map(x=>Math.max(x.expected,x.collected)), 1);
            const ePct = Math.max(2, (p.expected/maxVal)*100);
            const cPct = Math.max(2, (p.collected/maxVal)*100);
            const is100 = p.expected > 0 && p.collected >= p.expected;
            return (
              <div key={p.name} style={{ flex:1, textAlign:"center", minWidth:120 }}>
                <div style={{ display:"flex", gap:6, justifyContent:"center", alignItems:"flex-end", height:180 }}>
                  {is100 ? (
                    <div style={{ width:32, height:`${Math.max(cPct, ePct)}%`, background:"#F59E0B", borderRadius:"4px 4px 0 0", position:"relative" }}>
                      <div style={{ position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap",fontSize:10,fontWeight:700,color:"#F59E0B",paddingBottom:10 }}>
                        ✓ {fmt(p.collected)}
                      </div>
                    </div>
                  ) : (<>
                    <div style={{ width:20, height:`${ePct}%`, background:"rgba(56, 189, 248, 0.7)", borderRadius:"4px 4px 0 0", position:"relative" }}>
                      <div style={{ position:"absolute",bottom:"100%",left:0,whiteSpace:"nowrap",fontSize:10,color:"#38BDF8",paddingBottom:10 }}>
                        {fmt(p.expected)}
                      </div>
                    </div>
                    <div style={{ width:20, height:`${cPct}%`, background:"#F59E0B", borderRadius:"4px 4px 0 0", position:"relative" }}>
                      <div style={{ position:"absolute",bottom:"100%",right:0,whiteSpace:"nowrap",fontSize:10,fontWeight:700,color:"#F59E0B",paddingBottom:10 }}>
                        {fmt(p.collected)}
                      </div>
                    </div>
                  </>)}
                </div>
                <div style={{ fontSize:10, color:T.muted, marginTop:10, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
              </div>
            );
          })}
        </div>
        {/* Mobile: horizontal bars */}
        <div className="pn-chart-mobile" style={{ display:"none", flexDirection:"column", gap:16 }}>
          {props.map(p => {
            const maxVal = Math.max(...props.map(x=>Math.max(x.expected,x.collected)), 1);
            const ePct = Math.max(3, (p.expected/maxVal)*100);
            const cPct = Math.max(3, (p.collected/maxVal)*100);
            return (
              <div key={p.name+"m"}>
                <div style={{ fontSize:11, color:T.text, fontWeight:600, marginBottom:6 }}>{p.name}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ height:14, width:`${ePct}%`, background:"rgba(56, 189, 248, 0.7)", borderRadius:3, minWidth:20 }} />
                    <span style={{ fontSize:10, color:"#38BDF8", whiteSpace:"nowrap" }}>{fmt(p.expected)}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ height:14, width:`${cPct}%`, background:"#F59E0B", borderRadius:3, minWidth:20 }} />
                    <span style={{ fontSize:10, color:"#F59E0B", fontWeight:600, whiteSpace:"nowrap" }}>{fmt(p.collected)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex",gap:20,justifyContent:"center",marginTop:16 }}>
          <span style={{ display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#38BDF8" }}><span style={{width:10,height:10,borderRadius:2,background:"rgba(56, 189, 248, 0.7)",display:"inline-block"}} /> Expected</span>
          <span style={{ display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#F59E0B" }}><span style={{width:10,height:10,borderRadius:2,background:"#F59E0B",display:"inline-block"}} /> Collected</span>
        </div>
      </div>

      {/* Property cards */}
      <div className="pn-prop-grid" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16, marginBottom:20 }}>
        {props.map(p => {
          const ac = T.prop[p.name] || { accent: T.gold, dim: T.goldDim };
          const pct = p.expected > 0 ? ((p.collected / p.expected) * 100).toFixed(0) : 0;
          const arrears = p.expected - p.collected;
          return (
            <div key={p.name} onClick={() => onSelect(p.name)}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16,
                padding:24, cursor:"pointer", transition:"all .18s", borderLeft:`3px solid ${ac.accent}` }}
              onMouseEnter={e => e.currentTarget.style.background = T.hover}
              onMouseLeave={e => e.currentTarget.style.background = T.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:T.text }}>{p.name}</div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{p.rooms.length} rooms · {p.students} students</div>
                </div>
                <div style={{ background: ac.dim, color: ac.accent, padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700 }}>{pct}%</div>
              </div>
              <Bar pct={Number(pct)} color={ac.accent} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginTop:16 }}>
                {[
                  { label:"Collected", val:fmt(p.collected), c:T.green },
                  { label:"Arrears", val:fmt(arrears), c: arrears>0?T.red:T.green },
                  { label:"Vacant", val:p.vacantBeds, c:p.vacantBeds>0?T.amber:T.green },
                  { label:"Alerts", val:p.overdue.length, c:p.overdue.length>0?T.red:T.green },
                ].map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>{x.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:x.c, fontFamily:"'IBM Plex Mono',monospace" }}>{x.val}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Attention Required */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>⚠ Attention Required</div>
          <div style={{ background:T.redDim, color:T.red, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{totals.overdue} tenants</div>
        </div>
        {/* Desktop table */}
        <div className="pn-attn-table">
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr", gap:8, padding:"10px 24px", background:T.surface, borderBottom:`1px solid ${T.border}` }}>
            {[["Name","name"],["Property","property"],["Rent",""],["Balance","balance"],["Status",""]].map(([h,col]) => (
              <div key={h} onClick={()=>col&&toggleSort(col)} style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.1em",
                fontWeight:600, cursor:col?"pointer":"default" }}>{h}{sortCol===col?(sortDir===1?" ▲":" ▼"):""}</div>
            ))}
          </div>
          <div style={{ maxHeight:260, overflowY:"auto" }}>
            {sorted.length === 0 ? (
              <div style={{ padding:24, textAlign:"center", color:T.muted, fontSize:13 }}>🎉 No outstanding issues!</div>
            ) : sorted.map(s => (
              <div key={s.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr", gap:8, padding:"12px 24px",
                borderBottom:`1px solid ${T.border}20`, alignItems:"center", transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{s.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{s.room}</div>
                </div>
                <div style={{ fontSize:12, color:T.subtle }}>{s.property}</div>
                <div style={{ fontSize:12, color:T.subtle, fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.roomRent)}/mo</div>
                <div style={{ fontSize:12, fontWeight:700, color:T.red, fontFamily:"'IBM Plex Mono',monospace" }}>-{fmt(s.roomRent - s.paid)}</div>
                <Badge status={s.status} />
              </div>
            ))}
          </div>
        </div>
        {/* Mobile card layout */}
        <div className="pn-attn-cards" style={{ display:"none", flexDirection:"column", gap:8, padding:12, maxHeight:320, overflowY:"auto" }}>
          {sorted.length === 0 ? (
            <div style={{ padding:20, textAlign:"center", color:T.muted, fontSize:13 }}>🎉 No outstanding issues!</div>
          ) : sorted.map(s => (
            <div key={s.id+"m"} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{s.name}</div>
                <Badge status={s.status} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:T.muted }}>{s.property} · {s.room}</span>
                <span style={{ color:T.red, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>-{fmt(s.roomRent - s.paid)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
