import { useState, useMemo, useEffect } from "react";
import { T, font, fmt, Badge, CoverageBar, Stat, Bar, Btn, isUnassignedRecord, getDisplayName } from "./p2_helpers.jsx";
import { classifyStudent } from "../services/statusClassifier.js";
import * as CoverageDB from "../services/coverageDatabaseService.js";
import { debug } from "../lib/debug.js";

/* ═══════════════════════════════════════════════════════════
   PROPERTY DETAIL VIEW
═══════════════════════════════════════════════════════════ */
export function PropertyDetail({ name, props, onBack, onOpenPay, onAddStudent, onAddRoom, onStudentClick, isAdmin, onExport, onRemoveRoom, sharedCoverageMap, isLoadingCoverage }) {
  const prop = props.find(p => p.name === name);
  const ac = T.prop[name] || { accent: T.gold };
  const [search, setSearch] = useState("");

  // Phase 4C-C: coverage comes from the single app-level store (one fetch shared
  // with the dashboard) instead of a per-property N+1 loop. The store already
  // holds classifyStudent() results keyed by studentId — use it directly.
  const coverageMap = sharedCoverageMap || new Map();

  const pct = prop.expected > 0 ? ((prop.collected / prop.expected)*100).toFixed(1) : "0.0";
  const filtered = prop.rooms.filter(r =>
    !search || r.no.toLowerCase().includes(search.toLowerCase()) ||
    r.students.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div>
      <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:13,padding:0,marginBottom:20,display:"flex",alignItems:"center",gap:6 }}>← Back to Dashboard</button>
      <div className="pn-header-row" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11,color:ac.accent,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600 }}>{prop.location}</div>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:"4px 0 0" }}>{prop.name}</h1>
        </div>
        <div className="pn-header-actions" style={{ display:"flex",gap:10 }}>
          {onExport && <Btn accent={T.muted} onClick={()=>onExport(name)} style={{color:T.text,fontSize:11}}>↓ Export CSV</Btn>}
          {isAdmin && <Btn accent={T.blue} onClick={onAddRoom} style={{color:"#fff"}}>+ Add Room</Btn>}
          <Btn accent={T.green} onClick={onAddStudent}>+ Add Student</Btn>
          <Btn accent={ac.accent} onClick={onOpenPay}>+ Record Payment</Btn>
        </div>
      </div>
      <div className="pn-kpi-grid" style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:24 }}>
        <Stat label="Rooms" value={prop.rooms.length} accent={ac.accent} />
        <Stat label="Students" value={prop.students} accent={T.blue} />
        <Stat label="Collected" value={fmt(prop.collected)} accent={T.green} />
        <Stat label="Vacant Beds" value={prop.vacantBeds} accent={T.amber} />
        <Stat label="Rate" value={`${pct}%`} accent={T.gold} />
      </div>
      <div style={{ position:"relative",marginBottom:16 }}>
        <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:14 }}>⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search rooms or students…"
          style={{ width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px 10px 38px",
            color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:font }} />
      </div>
      {filtered.length === 0 && <div style={{ padding:32,textAlign:"center",color:T.muted,fontSize:13 }}>No rooms match your search</div>}
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {filtered.map(room => <RoomRow key={room.id} room={room} ac={ac} propName={name} onStudentClick={onStudentClick} isAdmin={isAdmin} onRemoveRoom={onRemoveRoom} coverageMap={coverageMap} isLoadingCoverage={isLoadingCoverage} />)}
      </div>
    </div>
  );
}

function RoomRow({ room, ac, propName, onStudentClick, isAdmin, onRemoveRoom, coverageMap, isLoadingCoverage }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Phase 4B.1: Coverage-based room metrics (NOT payment-based)
  // Get real students (exclude vacant placeholders)
  const real = room.students.filter(s=>s.status!=="VACANT"&&s.status!=="VACATED");
  const vacant = room.beds - real.length;
  
  // CRITICAL: Aggregate room coverage from classifyStudent() results
  // DO NOT use s.status (legacy payment status)
  // Safety: Only calculate if coverageMap exists
  const covered = coverageMap ? real.filter(s => {
    const coverage = coverageMap.get(s.id);
    // Covered = CURRENT + EXPIRING_SOON + DUE_TODAY
    return coverage && ['CURRENT', 'EXPIRING_SOON', 'DUE_TODAY'].includes(coverage.status);
  }).length : 0;
  
  const overdue = coverageMap ? real.filter(s => {
    const coverage = coverageMap.get(s.id);
    return coverage && coverage.status === 'OVERDUE';
  }).length : 0;
  
  const expiringSoon = coverageMap ? real.filter(s => {
    const coverage = coverageMap.get(s.id);
    return coverage && coverage.status === 'EXPIRING_SOON';
  }).length : 0;
  
  // Coverage rate = covered / occupied beds * 100
  const coverageRate = real.length > 0 ? Math.round((covered / real.length) * 100) : 0;
  
  // Financial metrics (keep separate, still valid)
  const expected = room.beds * room.rent;
  const collected = real.reduce((sum, s) => sum + (s.paid || 0), 0);
  const outstanding = expected - collected;
  
  // Phase 4B.1: Comprehensive verification logging
  debug(`[Phase4B.1] ${room.no}:`, {
    room: room.no,
    coveredCount: covered,
    overdueCount: overdue,
    expiringSoonCount: expiringSoon,
    dueTodayCount: real.filter(s => {
      const coverage = coverageMap?.get(s.id);
      return coverage && coverage.status === 'DUE_TODAY';
    }).length,
    occupiedBeds: real.length,
    coverageRate: coverageRate,
    // Financial (separate from coverage):
    expected,
    collected,
    outstanding
  });

  const handleRemoveClick = () => {
    if (real.length > 0) {
      alert(`Cannot remove ${room.no} — ${real.length} active students assigned. Remove or relocate students first.`);
      return;
    }
    setConfirmDelete(true);
  };

  const handleConfirmRemove = async () => {
    setIsDeleting(true);
    try {
      if (onRemoveRoom) await onRemoveRoom(room.id);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div style={{ background:T.card,border:`1px solid ${open?ac.accent+"60":T.border}`,borderRadius:12,overflow:"hidden",transition:"border .2s" }}>
      <div onClick={()=>setOpen(o=>!o)} className="pn-room-row" style={{ padding:"14px 20px",cursor:"pointer",display:"grid",
        gridTemplateColumns:"1fr auto auto auto auto auto",gap:12,alignItems:"center" }}>
        <div>
          <div style={{ fontSize:14,fontWeight:700,color:T.text }}>{room.no}</div>
          <div style={{ fontSize:11,color:T.muted,marginTop:2 }}>{room.beds} beds · ${room.rent}/bed · ${expected}/mo</div>
        </div>
        {/* Phase 4B.1: Coverage-based metrics (NOT payment-based) */}
        {isLoadingCoverage ? (
          <div className="pn-room-detail" style={{ fontSize:11,color:T.muted }}>Loading...</div>
        ) : (
          <>
            <div className="pn-room-detail" style={{ fontSize:11,color:T.green }}>{covered} covered</div>
            {overdue>0 && <div className="pn-room-detail" style={{ background:T.redDim,color:T.red,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{overdue} overdue</div>}
            {expiringSoon>0 && <div className="pn-room-detail" style={{ background:T.amberDim,color:T.amber,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{expiringSoon} expiring</div>}
          </>
        )}
        {vacant>0 && <div className="pn-room-detail" style={{ background:T.amberDim,color:T.amber,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{vacant} vacant</div>}
        <div style={{ width:80, display:"flex", alignItems:"center", gap:6 }}>
          <div style={{flex:1}}><Bar pct={coverageRate} color={ac.accent} /></div>
          <span style={{fontSize:10,fontWeight:700,color:ac.accent}}>{coverageRate}%</span>
        </div>
        <span style={{ color:T.muted,fontSize:13 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${T.border}`, paddingBottom:12 }}>
          {room.students.map(s => {
            const displayName = getDisplayName(s);
            const isClickable = s.status!=="VACANT"&&s.status!=="VACATED"&&!isUnassignedRecord(s);
            
            // Phase 4B: Get coverage classification from hydrated map (READ ONLY - no calculations)
            const coverage = coverageMap?.get(s.id);
            const coverageLabel = coverage?.displayLabel || null;
            
            // While loading coverage, don't show status for ACTIVE students (prevents mixed state)
            const showLoading = isLoadingCoverage && s.status !== "VACANT" && s.status !== "VACATED";
            
            return (
              <div key={s.id} onClick={()=>isClickable&&onStudentClick&&onStudentClick(s,room,propName)}
                className="pn-room-students"
                style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:12,padding:"10px 20px",
                  borderBottom:`1px solid ${T.border}20`,alignItems:"center",cursor:isClickable?"pointer":"default",transition:"background .15s" }}
                onMouseEnter={e=>{if(isClickable)e.currentTarget.style.background=T.hover}}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div>
                  <div style={{ fontSize:13,color:s.status==="VACANT"||s.status==="VACATED"||isUnassignedRecord(s)?T.muted:T.text,fontWeight:s.status==="VACANT"||isUnassignedRecord(s)?400:600,fontStyle:s.status==="VACANT"||isUnassignedRecord(s)?"italic":"normal" }}>{displayName}</div>
                  {!showLoading && coverage && <div style={{ marginTop:5 }}><CoverageBar coverage={coverage} /></div>}
                </div>
                <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{s.status==="VACANT"||isUnassignedRecord(s)?"—":`$${s.paid} paid${s.balance>0?` · $${s.balance} bal`:''}`}</div>
                <div style={{ fontSize:11,color:T.muted }}>{s.date||"—"}</div>
                <div style={{ justifySelf: "end", display:"flex", alignItems:"center", gap:8 }}>
                  {/* Phase 4B: Display coverage label + badge from SAME classification source */}
                  {showLoading ? (
                    <span style={{ fontSize:11, color:T.muted }}>Loading...</span>
                  ) : (
                    <>
                      {coverageLabel && (
                        <span style={{ 
                          fontSize:11, 
                          fontWeight:600,
                          color: coverage.status === 'CURRENT' ? '#22C55E' : 
                                 coverage.status === 'EXPIRING_SOON' ? '#F59E0B' : 
                                 coverage.status === 'DUE_TODAY' ? '#F97316' : '#EF4444'
                        }}>
                          {coverageLabel}
                        </span>
                      )}
                      {/* Badge uses coverage status for ACTIVE students, legacy status for VACANT */}
                      <Badge status={coverage?.status || s.status} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ padding:"14px 20px", background:T.surface, borderTop:`1px solid ${T.border}40`, marginTop:4 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:isAdmin?10:0 }}>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }} title="Expected rent for this month">Monthly Expected</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'IBM Plex Mono',monospace" }}>${expected}</div>
              </div>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }} title="Payments received this month">Monthly Collected</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.green, fontFamily:"'IBM Plex Mono',monospace" }}>${collected}</div>
              </div>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }} title={outstanding < 0 ? "Prepaid amount beyond current month" : "Amount still owed this month"}>
                  {outstanding < 0 ? "Monthly Prepaid" : "Monthly Outstanding"}
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:outstanding>0?T.red:outstanding<0?T.blue:T.green, fontFamily:"'IBM Plex Mono',monospace" }}>
                  ${Math.abs(outstanding)}
                </div>
              </div>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }} title="Percentage of occupied beds with valid coverage (not expired)">Coverage Rate</div>
                <div style={{ fontSize:15, fontWeight:700, color:coverageRate===100?T.green:T.amber }}>{coverageRate}%</div>
              </div>
            </div>
            {isAdmin && !confirmDelete && (
              <button onClick={handleRemoveClick} style={{ background:T.redDim, border:`1px solid ${T.red}40`, color:T.red, fontSize:10, fontWeight:700, padding:"5px 10px", borderRadius:6, cursor:"pointer", width:"100%" }}>
                Remove Room
              </button>
            )}
            {isAdmin && confirmDelete && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", background:T.redDim, border:`1px solid ${T.red}40`, padding:10, borderRadius:8 }}>
                <div style={{ fontSize:12, color:T.red, fontWeight:600, textAlign:"center" }}>Delete room? This cannot be undone.</div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => setConfirmDelete(false)} disabled={isDeleting} style={{ flex:1, background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 8px", color:T.text, fontSize:11, cursor:isDeleting?"not-allowed":"pointer" }}>Cancel</button>
                  <button onClick={handleConfirmRemove} disabled={isDeleting} style={{ flex:1, background:isDeleting?T.border:T.red, border:"none", borderRadius:6, padding:"6px 8px", color:isDeleting?T.muted:"#fff", fontSize:11, fontWeight:600, cursor:isDeleting?"not-allowed":"pointer" }}>{isDeleting ? "Deleting..." : "Delete"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENTS GLOBAL LIST
   TD-4 (Stabilization): filter chips, badges, and counts now derive from the
   COVERAGE engine (getAllStudentsCoverage → classifyStudent), replacing the legacy
   PAID/PARTIAL/OVERDUE month-based status from buildProps. The same student who
   reads "Current" in PropertyDetail now reads "Current" here too — one status system
   (Rules 1 & 3). Cash figures (Rent/Paid) are kept — they are legitimate.
═══════════════════════════════════════════════════════════ */
export function Students({ props, onAddStudent, onStudentClick }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showVacated, setShowVacated] = useState(false);

  // TD-4: single coverage fetch (one query), refetched on [props] so it stays live
  // after every payment mutation — same pattern as Dashboard and Finances.
  const [coverageMap, setCoverageMap] = useState(new Map()); // id → classifyStudent result
  const [isLoadingCoverage, setIsLoadingCoverage] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchCoverage() {
      setIsLoadingCoverage(true);
      const students = await CoverageDB.getAllStudentsCoverage();
      if (!cancelled) {
        const m = new Map();
        for (const s of students) {
          m.set(s.id, classifyStudent(s));
        }
        setCoverageMap(m);
        setIsLoadingCoverage(false);
      }
    }
    fetchCoverage();
    return () => { cancelled = true; };
  }, [props]);

  // helper: resolve the status to display for a student row
  const getStatus = (s) => {
    const c = coverageMap.get(s.id);
    // Non-ACTIVE or not-yet-loaded: fall back to the DB status value (VACANT etc.)
    if (!c || c.status === 'EXCLUDED') return s.status;
    return c.status;
  };

  const all = useMemo(() => props.flatMap(p =>
    p.rooms.flatMap(r =>
      r.students
        .filter(s => showVacated ? true : s.status !== "VACANT" && s.status !== "VACATED")
        .map(s => ({ ...s, property: p.name, room: r.no, rent: r.rent }))
    )
  ), [props, showVacated]);

  // Coverage-status filter chips (TD-4) — replaces PAID/PARTIAL/OVERDUE.
  const COVERAGE_FILTERS = ["ALL", "CURRENT", "EXPIRING_SOON", "DUE_TODAY", "OVERDUE"];
  const FILTER_LABELS = { ALL:"All", CURRENT:"Current", EXPIRING_SOON:"Expiring Soon", DUE_TODAY:"Due Today", OVERDUE:"Overdue" };
  const FILTER_COLORS = { ALL:T.muted, CURRENT:T.green, EXPIRING_SOON:T.amber, DUE_TODAY:"#F97316", OVERDUE:T.red };

  const counts = useMemo(() => {
    const c = { ALL: 0 };
    for (const f of COVERAGE_FILTERS.slice(1)) c[f] = 0;
    for (const s of all) {
      c.ALL++;
      const st = getStatus(s);
      if (c[st] !== undefined) c[st]++;
    }
    return c;
  }, [all, coverageMap]);

  const filtered = useMemo(() => all.filter(s => {
    const statusMatch = filter === "ALL" || getStatus(s) === filter;
    const searchMatch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.property.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  }), [all, filter, search, coverageMap]);

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:0 }}>All Students</h1>
          <div style={{ fontSize:13,color:T.muted,marginTop:4 }}>{all.length} students across {props.length} properties</div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <label style={{ fontSize:11,color:T.muted,display:"flex",alignItems:"center",gap:6,cursor:"pointer" }}>
            <input type="checkbox" checked={showVacated} onChange={e=>setShowVacated(e.target.checked)} /> Show vacated
          </label>
          <Btn accent={T.gold} onClick={onAddStudent}>+ Add Student</Btn>
        </div>
      </div>
      <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
        <div style={{ position:"relative",flex:1,minWidth:200 }}>
          <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:T.muted }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or property…"
            style={{ width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 12px 9px 34px",
              color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:font }} />
        </div>
        {COVERAGE_FILTERS.map(f => {
          const color = FILTER_COLORS[f];
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background: active ? `${color}20` : T.card,
                border: `1px solid ${active ? color : T.border}`,
                borderRadius: 9, padding: "9px 16px",
                color: active ? color : T.muted,
                fontWeight: active ? 700 : 400, fontSize: 12,
                cursor: "pointer", fontFamily: font }}>
              {FILTER_LABELS[f]} ({counts[f] || 0})
            </button>
          );
        })}
      </div>
      <>
      <div className="pn-students-table" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden" }}>
        <div className="pn-table-scroll">
          <div style={{ display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr 1fr",padding:"11px 20px",background:T.surface,borderBottom:`1px solid ${T.border}`,minWidth:600 }}>
            {["Name","Property","Room","Rent","Paid","Status"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          <div style={{ maxHeight:520,overflowY:"auto" }}>
            {filtered.length===0 ? (
              <div style={{ padding:32,textAlign:"center",color:T.muted,fontSize:13 }}>No students match your search criteria</div>
            ) : filtered.map(s => {
              const ac = T.prop[s.property] || { accent: T.gold };
              const isClickable = !isUnassignedRecord(s) && s.status !== "VACANT" && s.status !== "VACATED";
              const displayStatus = getStatus(s);
              return (
                <div key={s.id}
                  onClick={() => isClickable && onStudentClick && onStudentClick(s, {no:s.room, rent:s.rent, id:s.room_id}, s.property)}
                  style={{ display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr 1fr",padding:"12px 20px",
                  borderBottom:`1px solid ${T.border}15`,alignItems:"center",transition:"background .15s",minWidth:600,
                  cursor: isClickable ? "pointer" : "default" }}
                  onMouseEnter={e=>{if(isClickable)e.currentTarget.style.background=T.hover}}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{getDisplayName(s)}</div>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:ac.accent }} />
                    <span style={{ fontSize:12,color:T.subtle }}>{s.property}</span>
                  </div>
                  <div style={{ fontSize:12,color:T.muted }}>{s.room}</div>
                  <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.rent)}</div>
                  <div style={{ fontSize:12,fontFamily:"'IBM Plex Mono',monospace",color:s.paid>=s.rent?T.green:T.amber }}>{fmt(s.paid)}</div>
                  {isLoadingCoverage && s.status !== "VACANT" && s.status !== "VACATED"
                    ? <span style={{ fontSize:11,color:T.muted }}>…</span>
                    : <Badge status={displayStatus} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="pn-students-cards" style={{ display:"none",flexDirection:"column",gap:8 }}>
        {filtered.length===0 ? (
          <div style={{ padding:24,textAlign:"center",color:T.muted,background:T.card,borderRadius:12 }}>No students match your search criteria</div>
        ) : filtered.map(s => {
          const ac = T.prop[s.property] || { accent: T.gold };
          const isClickable = !isUnassignedRecord(s) && s.status !== "VACANT" && s.status !== "VACATED";
          const displayStatus = getStatus(s);
          return (
            <div key={s.id+"m"}
              onClick={()=>isClickable&&onStudentClick&&onStudentClick(s,{no:s.room,rent:s.rent,id:s.room_id},s.property)}
              style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:14,borderLeft:`3px solid ${ac.accent}`,cursor:isClickable?"pointer":"default" }}>
              <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:4 }}>{getDisplayName(s)}</div>
              <div style={{ fontSize:12,color:T.subtle,marginBottom:8 }}>{s.property} · {s.room}</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:6,alignItems:"center" }}>
                <div><span style={{color:T.muted,fontSize:11}}>Rent: </span><span style={{color:T.subtle,fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(s.rent)}</span></div>
                <div><span style={{color:T.muted,fontSize:11}}>Paid: </span><span style={{color:s.paid>=s.rent?T.green:T.amber,fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(s.paid)}</span></div>
                <div style={{justifySelf:"end"}}>
                  {isLoadingCoverage && s.status !== "VACANT" && s.status !== "VACATED"
                    ? <span style={{ fontSize:11,color:T.muted }}>…</span>
                    : <Badge status={displayStatus} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
    </div>
  );
}
