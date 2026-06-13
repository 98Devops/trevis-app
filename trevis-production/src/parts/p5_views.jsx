import { useState, useMemo, useEffect } from "react";
import { T, font, fmt, Badge, Stat, Bar, Btn, DateRangeFilter, isUnassignedRecord, filterUnassignedRecords, countOccupiedBeds, getDisplayName } from "./p2_helpers.jsx";
import { classifyStudent, getStatusBadgeConfig } from "../services/statusClassifier.js";
import * as CoverageDB from "../services/coverageDatabaseService.js";

/* ═══════════════════════════════════════════════════════════
   PROPERTY DETAIL VIEW
═══════════════════════════════════════════════════════════ */
export function PropertyDetail({ name, props, onBack, onOpenPay, onAddStudent, onAddRoom, onStudentClick, isAdmin, onExport, onRemoveRoom }) {
  const prop = props.find(p => p.name === name);
  const ac = T.prop[name] || { accent: T.gold };
  const [search, setSearch] = useState("");
  
  // Phase 4B: Fetch coverage data for all students in this property
  // READ ONLY - no calculations, enriches students with coverage classification
  const [studentsWithCoverage, setStudentsWithCoverage] = useState(new Map());
  
  useEffect(() => {
    async function fetchCoverage() {
      const coverageMap = new Map();
      
      // Get all student IDs from this property
      const allStudents = prop.rooms.flatMap(r => r.students);
      
      for (const student of allStudents) {
        // Fetch coverage for all students (not just ACTIVE - let classifier decide)
        if (student.id) {
          try {
            const coverageData = await CoverageDB.getStudentCoverageData(student.id);
            if (coverageData && coverageData.status === 'ACTIVE') {
              // Use statusClassifier to get coverage status - NO CALCULATIONS HERE
              const classification = classifyStudent(coverageData);
              coverageMap.set(student.id, classification);
              console.log(`Coverage for ${student.id}:`, classification); // Debug log
            }
          } catch (err) {
            console.error(`Failed to fetch coverage for student ${student.id}:`, err);
          }
        }
      }
      
      console.log(`Fetched coverage for ${coverageMap.size} students`); // Debug log
      setStudentsWithCoverage(coverageMap);
    }
    
    if (prop) {
      fetchCoverage();
    }
  }, [prop]);
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
        {filtered.map(room => <RoomRow key={room.id} room={room} ac={ac} propName={name} onStudentClick={onStudentClick} isAdmin={isAdmin} onRemoveRoom={onRemoveRoom} studentsWithCoverage={studentsWithCoverage} />)}
      </div>
    </div>
  );
}

function RoomRow({ room, ac, propName, onStudentClick, isAdmin, onRemoveRoom, studentsWithCoverage }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const real = room.students.filter(s=>s.status!=="VACANT"&&s.status!=="VACATED");
  const paid = real.filter(s=>s.status==="PAID").length;
  const issues = real.filter(s=>s.status!=="PAID").length;
  const pct = real.length > 0 ? Math.round((paid/real.length)*100) : 0;
  const vacant = room.beds - real.length;
  
  const expected = room.beds * room.rent;
  const collected = real.reduce((sum, s) => sum + (s.paid || 0), 0);
  const outstanding = expected - collected;

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
        <div className="pn-room-detail" style={{ fontSize:11,color:T.green }}>{paid} paid</div>
        {issues>0 && <div className="pn-room-detail" style={{ background:T.redDim,color:T.red,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{issues} ⚠</div>}
        {vacant>0 && <div className="pn-room-detail" style={{ background:T.amberDim,color:T.amber,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{vacant} vacant</div>}
        <div style={{ width:80, display:"flex", alignItems:"center", gap:6 }}>
          <div style={{flex:1}}><Bar pct={pct} color={ac.accent} /></div>
          <span style={{fontSize:10,fontWeight:700,color:ac.accent}}>{pct}%</span>
        </div>
        <span style={{ color:T.muted,fontSize:13 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${T.border}`, paddingBottom:12 }}>
          {room.students.map(s => {
            const displayName = getDisplayName(s);
            const isClickable = s.status!=="VACANT"&&s.status!=="VACATED"&&!isUnassignedRecord(s);
            
            // Phase 4B: Get coverage classification from service (READ ONLY - no calculations)
            const coverage = studentsWithCoverage?.get(s.id);
            const coverageLabel = coverage?.displayLabel || null;
            
            return (
              <div key={s.id} onClick={()=>isClickable&&onStudentClick&&onStudentClick(s,room,propName)}
                className="pn-room-students"
                style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:12,padding:"10px 20px",
                  borderBottom:`1px solid ${T.border}20`,alignItems:"center",cursor:isClickable?"pointer":"default",transition:"background .15s" }}
                onMouseEnter={e=>{if(isClickable)e.currentTarget.style.background=T.hover}}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ fontSize:13,color:s.status==="VACANT"||s.status==="VACATED"||isUnassignedRecord(s)?T.muted:T.text,fontWeight:s.status==="VACANT"||isUnassignedRecord(s)?400:600,fontStyle:s.status==="VACANT"||isUnassignedRecord(s)?"italic":"normal" }}>{displayName}</div>
                <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{s.status==="VACANT"||isUnassignedRecord(s)?"—":`$${s.paid} paid${s.balance>0?` · $${s.balance} bal`:''}`}</div>
                <div style={{ fontSize:11,color:T.muted }}>{s.date||"—"}</div>
                <div style={{ justifySelf: "end", display:"flex", alignItems:"center", gap:8 }}>
                  {/* Phase 4B: Display coverage label next to status badge (DISPLAY ONLY) */}
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
                  <Badge status={s.status} />
                </div>
              </div>
            );
          })}
          <div style={{ padding:"14px 20px", background:T.surface, borderTop:`1px solid ${T.border}40`, marginTop:4 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:isAdmin?10:0 }}>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Expected</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'IBM Plex Mono',monospace" }}>${expected}</div>
              </div>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Collected</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.green, fontFamily:"'IBM Plex Mono',monospace" }}>${collected}</div>
              </div>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Outstanding</div>
                <div style={{ fontSize:15, fontWeight:700, color:outstanding>0?T.red:T.green, fontFamily:"'IBM Plex Mono',monospace" }}>${outstanding}</div>
              </div>
              <div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Rate</div>
                <div style={{ fontSize:15, fontWeight:700, color:pct===100?T.green:T.amber }}>{pct}%</div>
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
═══════════════════════════════════════════════════════════ */
export function Students({ props, onAddStudent, onStudentClick }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showVacated, setShowVacated] = useState(false);
  const all = useMemo(() => props.flatMap(p =>
    p.rooms.flatMap(r => r.students.filter(s=> showVacated ? true : s.status!=="VACANT"&&s.status!=="VACATED").map(s => ({ ...s, property:p.name, room:r.no, rent:r.rent })))
  ), [props, showVacated]);
  const filtered = all.filter(s =>
    (filter==="ALL"||s.status===filter) &&
    (!search||s.name.toLowerCase().includes(search.toLowerCase())||s.property.toLowerCase().includes(search.toLowerCase()))
  );
  const counts = { ALL:all.length, PAID:all.filter(s=>s.status==="PAID").length, PARTIAL:all.filter(s=>s.status==="PARTIAL").length, OVERDUE:all.filter(s=>s.status==="OVERDUE").length };
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
        {["ALL","PAID","PARTIAL","OVERDUE"].map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.gold:T.card, border:`1px solid ${filter===f?T.gold:T.border}`,
            borderRadius:9, padding:"9px 16px", color:filter===f?"#0D0F14":T.muted, fontWeight:filter===f?700:400, fontSize:12, cursor:"pointer", fontFamily:font }}>
            {f} ({counts[f]||0})
          </button>
        ))}
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
                  <Badge status={s.status} />
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
          return (
            <div key={s.id+"m"} 
              onClick={()=>isClickable&&onStudentClick&&onStudentClick(s,{no:s.room,rent:s.rent,id:s.room_id},s.property)} 
              style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:14,borderLeft:`3px solid ${ac.accent}`,cursor:isClickable?"pointer":"default" }}>
              <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:4 }}>{getDisplayName(s)}</div>
              <div style={{ fontSize:12,color:T.subtle,marginBottom:8 }}>{s.property} · {s.room}</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:6,alignItems:"center" }}>
                <div><span style={{color:T.muted,fontSize:11}}>Rent: </span><span style={{color:T.subtle,fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(s.rent)}</span></div>
                <div><span style={{color:T.muted,fontSize:11}}>Paid: </span><span style={{color:s.paid>=s.rent?T.green:T.amber,fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(s.paid)}</span></div>
                <div style={{justifySelf:"end"}}><Badge status={s.status} /></div>
              </div>
            </div>
          );
        })}
      </div>
      </>
    </div>
  );
}
