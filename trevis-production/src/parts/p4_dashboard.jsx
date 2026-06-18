import { useState, useMemo, useEffect } from "react";
import { T, font, fmt, Badge, Stat, Bar, Btn, formatDateLong } from "./p2_helpers.jsx";
import * as CoverageDB from "../services/coverageDatabaseService.js";
import { buildAttentionList, countAttentionByProperty } from "../services/dashboardAttention.js";

/* ═══════════════════════════════════════════════════════════
   DASHBOARD VIEW
═══════════════════════════════════════════════════════════ */
export function Dashboard({ props, onSelect, onAddStudent, onRecordPayment, onExport, onStudentClick, onPropertyCardClick, sharedCoverageStudents, sharedCoverageLoading }) {
  const [timeRange, setTimeRange] = useState("month");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  
  // Phase 4A: Fetch coverage-based KPIs from database service
  // READ ONLY - no calculations, display values from coverageDatabaseService
  const [coverageKPIs, setCoverageKPIs] = useState(null);
  const [isLoadingKPIs, setIsLoadingKPIs] = useState(true);

  // TD-2 (Stabilization): single source of truth for the Attention table,
  // per-row badges, and per-property Alerts count. Fetched ONCE here (one query,
  // not N+1) alongside the KPI strip so every status region on this screen reads
  // from the SAME coverage engine. Refetches on the same [props] dependency, so
  // it stays in sync with mutations (which already change props / invalidate cache).
  const [coverageStudents, setCoverageStudents] = useState(null);

  // Phase 4C-C: the big student dataset (attention list, badges, integrity
  // indicator) comes from the shared app-level coverage store — no second
  // getAllStudentsCoverage() query here (TD-9). We still fetch the lightweight
  // KPI strip via getDashboardKPIs(). Falls back to a self-fetch when the shared
  // store isn't provided (tests / standalone use).
  const useShared = Array.isArray(sharedCoverageStudents);

  useEffect(() => {
    let cancelled = false;
    async function fetchKPIs() {
      setIsLoadingKPIs(true);
      const kpis = await CoverageDB.getDashboardKPIs();
      let students = sharedCoverageStudents;
      if (!useShared) students = await CoverageDB.getAllStudentsCoverage();
      if (!cancelled) {
        setCoverageKPIs(kpis);
        setCoverageStudents(students);
        setIsLoadingKPIs(false);
      }
    }
    fetchKPIs();
    return () => { cancelled = true; };
  }, [props, useShared, sharedCoverageStudents]);

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
  const todayLabel = formatDateLong(now);

  // TD-2: Attention list derived from the COVERAGE engine (single source of truth),
  // not the legacy month-based `p.overdue`. A student needs attention when their
  // coverage classification is OVERDUE / DUE_TODAY / EXPIRING_SOON — the same
  // definition the KPI strip uses, so the count and the list can no longer diverge.
  // Falls back to the legacy month-based list only when coverage data is
  // unavailable (demo/unconfigured/fetch-failed), preserving demo + test behavior.
  const coverageReady = Array.isArray(coverageStudents);

  // Phase 4C-B #6: in-app coverage integrity indicator. Derived from the
  // already-fetched coverageStudents (no extra query): flags the corrupt-range
  // signature (coverage_start > coverage_end) the nightly UTC monitor watches.
  // Surfaces the monitor's HEALTHY/⚠️ state inside the app.
  const integrity = useMemo(() => {
    if (!coverageReady) return null;
    const corrupt = coverageStudents.filter(
      s => s.coverage_start && s.coverage_end && s.coverage_start > s.coverage_end
    ).length;
    return { healthy: corrupt === 0, corrupt };
  }, [coverageReady, coverageStudents]);

  const allOverdue = useMemo(() => {
    if (!coverageReady) {
      // Legacy fallback (demo mode / coverage fetch failed)
      return props.flatMap(p => p.overdue.map(s => ({
        ...s, property: p.name, source: "legacy",
      })));
    }
    return buildAttentionList(coverageStudents);
  }, [coverageReady, coverageStudents, props]);

  const sorted = [...allOverdue].sort((a,b) => {
    if (sortCol==="name") return sortDir * a.name.localeCompare(b.name);
    if (sortCol==="property") return sortDir * a.property.localeCompare(b.property);
    if (sortCol==="balance") {
      const ab = a.source === "coverage" ? a.outstanding : (a.roomRent - a.paid);
      const bb = b.source === "coverage" ? b.outstanding : (b.roomRent - b.paid);
      return sortDir * (ab - bb);
    }
    return 0;
  });
  const toggleSort = (col) => { if(sortCol===col) setSortDir(d=>-d); else { setSortCol(col); setSortDir(1); } };

  // TD-2: per-property attention count, also coverage-derived, for the card "Alerts".
  const attentionByProperty = useMemo(
    () => (coverageReady ? countAttentionByProperty(allOverdue) : {}),
    [coverageReady, allOverdue]
  );
  const attentionCount = coverageReady ? allOverdue.length : props.reduce((a,p)=>a+p.overdue.length,0);

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:13, color:T.gold, textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:600, marginBottom:4 }}>{monthYear}</h2>
        <div style={{ fontSize:11, color:T.subtle, marginBottom:8 }}>{todayLabel}</div>
        <div className="pn-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <h1 style={{ fontSize:28, fontWeight:800, color:T.text, margin:0 }}>Portfolio Overview</h1>
            {integrity && (
              <span
                title={integrity.healthy
                  ? "Coverage data matches the payment ledger"
                  : `${integrity.corrupt} student(s) have a corrupt coverage range — run the repair tool`}
                style={{
                  display:"inline-flex", alignItems:"center", gap:5, fontSize:10, fontWeight:700,
                  textTransform:"uppercase", letterSpacing:"0.06em", padding:"3px 9px", borderRadius:20,
                  background: integrity.healthy ? T.greenDim : T.redDim,
                  color: integrity.healthy ? T.green : T.red,
                }}>
                {integrity.healthy ? "● Coverage healthy" : `▲ ${integrity.corrupt} coverage issue${integrity.corrupt>1?"s":""}`}
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:4, background:T.surface, borderRadius:8, padding:2 }}>
            {[["month","This Month"],["all","All Time"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTimeRange(k)} style={{ background:timeRange===k?T.gold:"none", border:"none", borderRadius:6,
                padding:"6px 14px", color:timeRange===k?"#0D0F14":T.muted, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:font }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip - Phase 4A: Coverage-Based Metrics (READ ONLY) */}
      <div className="pn-kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:20 }}>
        {isLoadingKPIs ? (
          // Loading skeleton - prevents flash of old metrics
          <>
            <Stat label="Total Students" value="—" accent={T.blue} />
            <Stat label="Current" value="—" sub="Loading..." accent="#22C55E" />
            <Stat label="Expiring Soon" value="—" sub="Loading..." accent="#F59E0B" />
            <Stat label="Overdue" value="—" sub="Loading..." accent="#EF4444" />
            <Stat label="Collection Rate" value="—" sub="Loading..." accent={T.gold} />
          </>
        ) : coverageKPIs ? (
          // Coverage-based KPIs (Phase 4A)
          <>
            <Stat 
              label="Total Students" 
              value={coverageKPIs.total_students} 
              accent={T.blue} 
            />
            <Stat 
              label="Current" 
              value={coverageKPIs.current_students} 
              sub="7+ days remaining"
              accent="#22C55E" 
            />
            <Stat 
              label="Expiring Soon" 
              value={coverageKPIs.expiring_soon} 
              sub="1-7 days remaining"
              accent="#F59E0B" 
            />
            <Stat 
              label="Overdue" 
              value={coverageKPIs.overdue_students} 
              sub="Coverage expired"
              accent="#EF4444" 
            />
            <Stat 
              label="Collection Rate" 
              value={`${rate}%`} 
              sub={`${fmt(coverageKPIs.total_overdue_amount)} arrears`}
              accent={T.gold} 
            />
          </>
        ) : (
          // Fallback if KPI fetch fails - show totals only
          <>
            <Stat label="Total Students" value={totals.students} accent={T.blue} />
            <Stat label="Collected" value={fmt(totals.collected)} accent={T.green} />
            <Stat label="Outstanding" value={fmt(totals.expected-totals.collected)} accent={T.red} />
            <Stat label="Collection Rate" value={`${rate}%`} accent={T.gold} />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="pn-quick-actions" style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
        <Btn accent={T.gold} onClick={onAddStudent}>+ Add Student</Btn>
        <Btn accent={T.green} onClick={onRecordPayment}>+ Record Payment</Btn>
        <Btn accent={T.blue} onClick={onExport} style={{color:"#fff"}}>↓ Download Report</Btn>
      </div>

      {/* Collection bar chart — grouped bars */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:4 }}>Collected vs Expected by Property</div>
        <div style={{ fontSize:11, color:T.muted, marginBottom:16 }}>Monthly cash basis (this calendar month) — separate from coverage status</div>
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
                    <div style={{ width:20, height:`${ePct}%`, background:"#38BDF8", borderRadius:"4px 4px 0 0", position:"relative" }}>
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
                    <div style={{ height:14, width:`${ePct}%`, background:"#38BDF8", borderRadius:3, minWidth:20 }} />
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
          <span style={{ display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#38BDF8" }}><span style={{width:10,height:10,borderRadius:2,background:"#38BDF8",display:"inline-block"}} /> Expected</span>
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
            <div key={p.name}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16,
                padding:24, cursor:"pointer", transition:"all .18s", borderLeft:`3px solid ${ac.accent}` }}
              onMouseEnter={e => e.currentTarget.style.background = T.hover}
              onMouseLeave={e => e.currentTarget.style.background = T.card}>
              <div onClick={() => onSelect(p.name)} style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:T.text }}>{p.name}</div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{p.rooms.length} rooms · {p.students} students</div>
                  </div>
                  <div style={{ background: ac.dim, color: ac.accent, padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700 }}>{pct}%</div>
                </div>
              </div>
              <Bar pct={Number(pct)} color={ac.accent} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginTop:16 }}>
                {/* TD-2: "Collected" / "Arrears (mo)" are MONTHLY CASH figures (cash-basis,
                    by design — see Sprint 5.5 separation of concerns), explicitly labelled
                    as monthly so they're not confused with coverage status. "Alerts" is the
                    coverage-derived attention count (same engine as the KPI strip). */}
                {[
                  { label:"Collected (mo)", val:fmt(p.collected), c:T.green, onClick:null },
                  { label:"Arrears (mo)", val:fmt(arrears), c: arrears>0?T.red:T.green, onClick: arrears>0 ? (e)=>{e.stopPropagation();onPropertyCardClick&&onPropertyCardClick(p.name);} : null },
                  { label:"Vacant", val:p.vacantBeds, c:p.vacantBeds>0?T.amber:T.green, onClick:null },
                  (() => {
                    const alerts = coverageReady ? (attentionByProperty[p.name] || 0) : p.overdue.length;
                    return { label:"Alerts", val:alerts, c:alerts>0?T.red:T.green, onClick: alerts>0 ? (e)=>{e.stopPropagation();onPropertyCardClick&&onPropertyCardClick(p.name);} : null };
                  })(),
                ].map(x => (
                  <div key={x.label} onClick={x.onClick} style={{ cursor: x.onClick ? "pointer" : "default" }}>
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
          <div style={{ background:T.redDim, color:T.red, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{attentionCount} tenants</div>
        </div>
        {/* Desktop table */}
        <div className="pn-attn-table">
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr", gap:8, padding:"10px 24px", background:T.surface, borderBottom:`1px solid ${T.border}` }}>
            {[["Name","name"],["Property","property"],["Rent",""],["Outstanding","balance"],["Status",""]].map(([h,col]) => (
              <div key={h} onClick={()=>col&&toggleSort(col)} style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.1em",
                fontWeight:600, cursor:col?"pointer":"default" }}>{h}{sortCol===col?(sortDir===1?" ▲":" ▼"):""}</div>
            ))}
          </div>
          <div style={{ maxHeight:260, overflowY:"auto" }}>
            {sorted.length === 0 ? (
              <div style={{ padding:24, textAlign:"center", color:T.muted, fontSize:13 }}>🎉 No outstanding issues!</div>
            ) : sorted.map(s => (
              <div key={s.id} onClick={()=>onStudentClick&&onStudentClick(s,{no:s.room,rent:s.roomRent},s.property)} style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr", gap:8, padding:"12px 24px",
                borderBottom:`1px solid ${T.border}20`, alignItems:"center", transition:"background .15s", cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{s.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{s.room}{s.source==="coverage" && s.daysLabel ? ` · ${s.daysLabel}` : ""}</div>
                </div>
                <div style={{ fontSize:12, color:T.subtle }}>{s.property}</div>
                <div style={{ fontSize:12, color:T.subtle, fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.roomRent)}/mo</div>
                <div style={{ fontSize:12, fontWeight:700, color:T.red, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {s.source==="coverage" ? (s.outstanding>0 ? `-${fmt(s.outstanding)}` : "—") : `-${fmt(s.roomRent - s.paid)}`}
                </div>
                <Badge status={s.source==="coverage" ? s.coverageStatus : s.status} />
              </div>
            ))}
          </div>
        </div>
        {/* Mobile card layout */}
        <div className="pn-attn-cards" style={{ display:"none", flexDirection:"column", gap:8, padding:12, maxHeight:320, overflowY:"auto" }}>
          {sorted.length === 0 ? (
            <div style={{ padding:20, textAlign:"center", color:T.muted, fontSize:13 }}>🎉 No outstanding issues!</div>
          ) : sorted.map(s => (
            <div key={s.id+"m"} onClick={()=>onStudentClick&&onStudentClick(s,{no:s.room,rent:s.roomRent},s.property)} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:14, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{s.name}</div>
                <Badge status={s.source==="coverage" ? s.coverageStatus : s.status} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:T.muted }}>{s.property} · {s.room}{s.source==="coverage" && s.daysLabel ? ` · ${s.daysLabel}` : ""}</span>
                <span style={{ color:T.red, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {s.source==="coverage" ? (s.outstanding>0 ? `-${fmt(s.outstanding)}` : "—") : `-${fmt(s.roomRent - s.paid)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
