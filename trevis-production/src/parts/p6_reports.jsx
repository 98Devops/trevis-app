import { useState } from "react";
import { T, font, fmt, Bar, Btn } from "./p2_helpers.jsx";

/* ═══════════════════════════════════════════════════════════
   REPORTS VIEW
═══════════════════════════════════════════════════════════ */
export function Reports({ props, dataFlags, isAdmin, onResolveFlag, onSaveSnapshot, onGenerateObligations }) {
  const [tab, setTab] = useState("income");
  const totals = props.map(p => ({ name:p.name, students:p.students, collected:p.collected, expected:p.expected,
    arrears:p.expected-p.collected, rate:p.expected>0?((p.collected/p.expected)*100).toFixed(1):"0.0", overdue:p.overdue.length,
    totalBeds:p.totalBeds, vacantBeds:p.vacantBeds }));
  const grand = totals.reduce((a,t) => ({ students:a.students+t.students, collected:a.collected+t.collected, expected:a.expected+t.expected,
    arrears:a.arrears+t.arrears, overdue:a.overdue+t.overdue, totalBeds:a.totalBeds+t.totalBeds, vacantBeds:a.vacantBeds+t.vacantBeds }),
    { students:0,collected:0,expected:0,arrears:0,overdue:0,totalBeds:0,vacantBeds:0 });

  const allOutstanding = props.flatMap(p => p.rooms.flatMap(r => r.students.filter(s=>s.status!=="PAID"&&s.status!=="VACANT"&&s.status!=="VACATED").map(s=>
    ({...s, property:p.name, room:r.no, rent:r.rent, balance:r.rent-s.paid})
  ))).sort((a,b) => b.balance - a.balance);

  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month:"long", year:"numeric" });

  const handleExport = () => {
    const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    let csv = "=== MONTHLY INCOME SUMMARY ===\n";
    csv += "Property,Students,Expected,Collected,Arrears,Rate%,Overdue\n";
    totals.forEach(t => csv += `${t.name},${t.students},${t.expected},${t.collected},${t.arrears},${t.rate},${t.overdue}\n`);
    csv += `TOTAL,${grand.students},${grand.expected},${grand.collected},${grand.arrears},${grand.expected>0?((grand.collected/grand.expected)*100).toFixed(1):"0"},${grand.overdue}\n\n`;
    csv += "=== OUTSTANDING BALANCES ===\n";
    csv += "Name,Property,Room,Rent,Paid,Balance,Status,Notes\n";
    allOutstanding.forEach(s => csv += `"${s.name}",${s.property},${s.room},${s.rent},${s.paid},${s.balance},${s.status},"${s.notes||""}"\n`);
    csv += `\n=== OCCUPANCY REPORT ===\n`;
    csv += "Property,Total Beds,Occupied,Vacant,Occupancy%\n";
    totals.forEach(t => csv += `${t.name},${t.totalBeds},${t.totalBeds-t.vacantBeds},${t.vacantBeds},${t.totalBeds>0?((t.totalBeds-t.vacantBeds)/t.totalBeds*100).toFixed(1):"0"}\n`);
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `PropNest_Report_${ts}.csv`; a.click();
  };

  const tabs = [["income","Income Summary"],["outstanding","Outstanding"],["occupancy","Occupancy"]];
  if (isAdmin && dataFlags && dataFlags.length > 0) tabs.push(["quality","Data Quality"]);

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:13,color:T.gold,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600,marginBottom:4 }}>{monthLabel}</h2>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:0 }}>Reports</h1>
        </div>
        <Btn accent={T.gold} style={{background:T.goldDim,color:T.gold,border:`1px solid ${T.gold}40`}} onClick={handleExport}><span className="pn-export-btn">↓ Export CSV</span></Btn>
      </div>

      <div className="pn-report-tabs" style={{ display:"flex",gap:4,marginBottom:20,background:T.surface,borderRadius:10,padding:3,width:"fit-content",flexWrap:"wrap" }}>
        {tabs.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ background:tab===k?T.gold:"none",border:"none",borderRadius:7,
            padding:"8px 18px",color:tab===k?"#0D0F14":T.muted,fontSize:12,fontWeight:tab===k?700:400,cursor:"pointer",fontFamily:font }}>{l}
            {k==="quality" && <span style={{ background:T.red,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:9,fontWeight:700,marginLeft:6 }}>{dataFlags.length}</span>}
          </button>
        ))}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="pn-admin-actions" style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
          {onSaveSnapshot && <Btn accent={T.blue} onClick={onSaveSnapshot} style={{fontSize:11,padding:"7px 14px"}}>📸 Save Monthly Snapshot</Btn>}
          {onGenerateObligations && <Btn accent={T.amber} onClick={onGenerateObligations} style={{fontSize:11,padding:"7px 14px"}}>⚙ Generate Obligations</Btn>}
        </div>
      )}

      {tab === "income" && (
        <>
        {/* Desktop table */}
        <div className="pn-report-table" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div className="pn-report-header" style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Property","Students","Expected","Collected","Arrears","Rate"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {totals.map(t => {
            const ac = T.prop[t.name] || { accent: T.gold };
            return (
              <div key={t.name} style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",padding:"14px 24px",
                borderBottom:`1px solid ${T.border}20`,alignItems:"center",transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:ac.accent }} />
                  <span style={{ fontSize:13,fontWeight:600,color:T.text }}>{t.name}</span>
                </div>
                <div style={{ fontSize:13,color:T.subtle }}>{t.students}</div>
                <div style={{ fontSize:13,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(t.expected)}</div>
                <div style={{ fontSize:13,color:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(t.collected)}</div>
                <div style={{ fontSize:13,color:t.arrears>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(t.arrears)}</div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ flex:1 }}><Bar pct={Number(t.rate)} color={ac.accent} /></div>
                  <span style={{ fontSize:11,color:ac.accent,fontWeight:700,minWidth:36 }}>{t.rate}%</span>
                </div>
              </div>
            );
          })}
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",padding:"14px 24px",background:T.surface }}>
            <div style={{ fontSize:13,fontWeight:800,color:T.text }}>TOTAL</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{grand.students}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(grand.expected)}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(grand.collected)}</div>
            <div style={{ fontSize:13,fontWeight:700,color:grand.arrears>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(grand.arrears)}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.gold }}>{grand.expected>0?((grand.collected/grand.expected)*100).toFixed(1):"0"}%</div>
          </div>
        </div>
        {/* Mobile cards */}
        <div className="pn-report-cards" style={{ display:"none",flexDirection:"column",gap:8 }}>
          {totals.map(t => {
            const ac = T.prop[t.name] || { accent: T.gold };
            const is100 = Number(t.rate) >= 100;
            return (
              <div key={t.name+"m"} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:16,borderLeft:`3px solid ${ac.accent}` }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:ac.accent }} />
                  <span style={{ fontSize:14,fontWeight:700,color:T.text }}>{t.name}</span>
                </div>
                <div style={{ fontSize:12,color:T.subtle,marginBottom:6 }}>{t.students} students</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12 }}>
                  <div><span style={{color:T.muted}}>Expected: </span><span style={{color:T.subtle,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(t.expected)}</span></div>
                  <div><span style={{color:T.muted}}>Collected: </span><span style={{color:T.green,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(t.collected)}{is100?" ✓":""}</span></div>
                  <div><span style={{color:T.muted}}>Arrears: </span><span style={{color:t.arrears>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(t.arrears)}</span></div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{color:T.muted}}>Rate: </span>
                    <div style={{flex:1}}><Bar pct={Number(t.rate)} color={ac.accent} /></div>
                    <span style={{fontSize:11,color:ac.accent,fontWeight:700}}>{t.rate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:14 }}>
            <div style={{ fontSize:13,fontWeight:800,color:T.text,marginBottom:8 }}>TOTAL</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:12 }}>
              <div><span style={{color:T.muted}}>Students: </span><span style={{color:T.text}}>{grand.students}</span></div>
              <div><span style={{color:T.muted}}>Expected: </span><span style={{color:T.text,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(grand.expected)}</span></div>
              <div><span style={{color:T.muted}}>Collected: </span><span style={{color:T.green,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(grand.collected)}</span></div>
              <div><span style={{color:T.muted}}>Arrears: </span><span style={{color:grand.arrears>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(grand.arrears)}</span></div>
            </div>
          </div>
        </div>
        </>
      )}

      {tab === "outstanding" && (
        <>
        <div className="pn-report-table" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div className="pn-report-header" style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Name","Property","Room","Rent","Paid","Balance"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {allOutstanding.length===0 ? (
            <div style={{ padding:32,textAlign:"center",color:T.muted }}>🎉 No outstanding balances!</div>
          ) : allOutstanding.map(s => (
            <div key={s.id} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",
              borderBottom:`1px solid ${T.border}20`,alignItems:"center",transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{s.name}</div>
              <div style={{ fontSize:12,color:T.subtle }}>{s.property}</div>
              <div style={{ fontSize:12,color:T.muted }}>{s.room}</div>
              <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.rent)}</div>
              <div style={{ fontSize:12,color:T.amber,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.paid)}</div>
              <div style={{ fontSize:12,fontWeight:700,color:T.red,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.balance)}</div>
            </div>
          ))}
        </div>
        <div className="pn-report-cards" style={{ display:"none",flexDirection:"column",gap:8 }}>
          {allOutstanding.length===0 ? (
            <div style={{ padding:24,textAlign:"center",color:T.muted,background:T.card,borderRadius:12 }}>🎉 No outstanding balances!</div>
          ) : allOutstanding.map(s => {
            const ac = T.prop[s.property] || { accent: T.gold };
            return (
              <div key={s.id+"m"} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:14,borderLeft:`3px solid ${ac.accent}` }}>
                <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:4 }}>{s.name}</div>
                <div style={{ fontSize:11,color:T.subtle,marginBottom:8 }}>{s.property} · {s.room}</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,fontSize:12 }}>
                  <div><span style={{color:T.muted}}>Rent: </span><span style={{color:T.subtle}}>{fmt(s.rent)}</span></div>
                  <div><span style={{color:T.muted}}>Paid: </span><span style={{color:T.amber}}>{fmt(s.paid)}</span></div>
                  <div><span style={{color:T.muted}}>Bal: </span><span style={{color:T.red,fontWeight:700}}>{fmt(s.balance)}</span></div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {tab === "occupancy" && (
        <>
        <div className="pn-report-table" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div className="pn-report-header" style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Property","Total Beds","Occupied","Vacant","Occupancy"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {totals.map(t => {
            const ac = T.prop[t.name] || { accent: T.gold }; const occ = t.totalBeds-t.vacantBeds; const occRate = t.totalBeds>0?((occ/t.totalBeds)*100).toFixed(1):"0";
            return (
              <div key={t.name} style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",padding:"14px 24px",
                borderBottom:`1px solid ${T.border}20`,alignItems:"center" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:ac.accent }} /><span style={{ fontSize:13,fontWeight:600,color:T.text }}>{t.name}</span>
                </div>
                <div style={{ fontSize:13,color:T.subtle }}>{t.totalBeds}</div>
                <div style={{ fontSize:13,color:T.green }}>{occ}</div>
                <div style={{ fontSize:13,color:t.vacantBeds>0?T.amber:T.green }}>{t.vacantBeds}</div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ flex:1 }}><Bar pct={Number(occRate)} color={ac.accent} /></div>
                  <span style={{ fontSize:11,color:ac.accent,fontWeight:700 }}>{occRate}%</span>
                </div>
              </div>
            );
          })}
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",padding:"14px 24px",background:T.surface }}>
            <div style={{ fontSize:13,fontWeight:800,color:T.text }}>TOTAL</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{grand.totalBeds}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.green }}>{grand.totalBeds-grand.vacantBeds}</div>
            <div style={{ fontSize:13,fontWeight:700,color:grand.vacantBeds>0?T.amber:T.green }}>{grand.vacantBeds}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.gold }}>{grand.totalBeds>0?((grand.totalBeds-grand.vacantBeds)/grand.totalBeds*100).toFixed(1):"0"}%</div>
          </div>
        </div>
        <div className="pn-report-cards" style={{ display:"none",flexDirection:"column",gap:8 }}>
          {totals.map(t => {
            const ac = T.prop[t.name] || { accent: T.gold }; const occ = t.totalBeds-t.vacantBeds; const occRate = t.totalBeds>0?((occ/t.totalBeds)*100).toFixed(1):"0";
            return (
              <div key={t.name+"m"} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:14,borderLeft:`3px solid ${ac.accent}` }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:ac.accent }} />
                  <span style={{ fontSize:14,fontWeight:700,color:T.text }}>{t.name}</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12 }}>
                  <div><span style={{color:T.muted}}>Beds: </span><span style={{color:T.subtle}}>{t.totalBeds}</span></div>
                  <div><span style={{color:T.muted}}>Occupied: </span><span style={{color:T.green}}>{occ}</span></div>
                  <div><span style={{color:T.muted}}>Vacant: </span><span style={{color:t.vacantBeds>0?T.amber:T.green}}>{t.vacantBeds}</span></div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1}}><Bar pct={Number(occRate)} color={ac.accent} /></div>
                    <span style={{fontSize:11,color:ac.accent,fontWeight:700}}>{occRate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {tab === "quality" && isAdmin && (
        <DataQuality flags={dataFlags} onResolve={onResolveFlag} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DATA QUALITY FLAGS (Admin only)
═══════════════════════════════════════════════════════════ */
const FLAG_LABELS = {
  OVER_CAPACITY: { label:"Over-capacity", color:T.red, icon:"🏠" },
  ANONYMOUS_PLACEHOLDER: { label:"Anonymous/Unidentified", color:T.amber, icon:"👤" },
  INVALID_DATE: { label:"Invalid date in source", color:T.purple, icon:"📅" },
  FUTURE_DATE: { label:"Future date (suspicious)", color:T.blue, icon:"⏳" },
  MISSING_PAYMENT: { label:"Missing payment amount", color:T.red, icon:"💰" },
  MISSING_DATE: { label:"Missing date", color:T.muted, icon:"📅" },
  UNCLEAR_NOTE: { label:"Unclear note — needs clarification", color:T.amber, icon:"❓" },
  PARTIAL_UNDERPAYMENT: { label:"Underpayment", color:T.amber, icon:"⚠" },
};

function DataQuality({ flags, onResolve }) {
  return (
    <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
      <div style={{ padding:"18px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div style={{ fontSize:14,fontWeight:700,color:T.text }}>🔍 Data Quality Flags</div>
        <div style={{ background:T.amberDim,color:T.amber,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{flags.length} issues</div>
      </div>
      {flags.map(f => {
        const flagInfo = FLAG_LABELS[f.data_flags] || { label:f.data_flags, color:T.muted, icon:"⚡" };
        const propName = f.rooms?.properties?.name || "—";
        const roomName = f.rooms?.room_number || "—";
        return (
          <div key={f.id} style={{ display:"grid",gridTemplateColumns:"auto 2fr 1fr 1fr 2fr auto",gap:12,padding:"14px 24px",
            borderBottom:`1px solid ${T.border}20`,alignItems:"center" }}>
            <span style={{ fontSize:16 }}>{flagInfo.icon}</span>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{f.full_name}</div>
              <div style={{ fontSize:11,color:T.muted }}>{propName} · {roomName}</div>
            </div>
            <div style={{ fontSize:11,color:flagInfo.color,fontWeight:600 }}>{flagInfo.label}</div>
            <div style={{ fontSize:11,color:T.muted }}>{f.notes || "—"}</div>
            <div style={{ fontSize:11,color:T.subtle,fontStyle:"italic" }}>{f.data_flags}</div>
            <button onClick={()=>onResolve&&onResolve(f)} style={{ background:T.goldDim,border:`1px solid ${T.gold}30`,borderRadius:6,
              padding:"4px 12px",color:T.gold,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:font }}>Resolve</button>
          </div>
        );
      })}
    </div>
  );
}
