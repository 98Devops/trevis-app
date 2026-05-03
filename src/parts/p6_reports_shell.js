
/* ═══════════════════════════════════════════════════════════
   REPORTS VIEW
═══════════════════════════════════════════════════════════ */
function Reports({ props }) {
  const [tab, setTab] = useState("income");
  const totals = props.map(p => ({ name:p.name, students:p.students, collected:p.collected, expected:p.expected,
    arrears:p.expected-p.collected, rate:p.expected>0?((p.collected/p.expected)*100).toFixed(1):"0.0", overdue:p.overdue.length,
    totalBeds:p.totalBeds, vacantBeds:p.vacantBeds }));
  const grand = totals.reduce((a,t) => ({ students:a.students+t.students, collected:a.collected+t.collected, expected:a.expected+t.expected,
    arrears:a.arrears+t.arrears, overdue:a.overdue+t.overdue, totalBeds:a.totalBeds+t.totalBeds, vacantBeds:a.vacantBeds+t.vacantBeds }),
    { students:0,collected:0,expected:0,arrears:0,overdue:0,totalBeds:0,vacantBeds:0 });

  const allOutstanding = props.flatMap(p => p.rooms.flatMap(r => r.students.filter(s=>s.status!=="PAID"&&s.status!=="VACANT").map(s=>
    ({...s, property:p.name, room:r.no, rent:r.rent, balance:r.rent-s.paid})
  ))).sort((a,b) => b.balance - a.balance);

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
    a.download = `Trevis_Report_${ts}.csv`; a.click();
  };

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:13,color:T.gold,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600,marginBottom:4 }}>February 2026</h2>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:0 }}>Reports</h1>
        </div>
        <Btn accent={T.gold} style={{background:T.goldDim,color:T.gold,border:`1px solid ${T.gold}40`}} onClick={handleExport}>↓ Export CSV</Btn>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:4,marginBottom:20,background:T.surface,borderRadius:10,padding:3,width:"fit-content" }}>
        {[["income","Income Summary"],["outstanding","Outstanding"],["occupancy","Occupancy"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ background:tab===k?T.gold:"none",border:"none",borderRadius:7,
            padding:"8px 18px",color:tab===k?"#0D0F14":T.muted,fontSize:12,fontWeight:tab===k?700:400,cursor:"pointer",fontFamily:font }}>{l}</button>
        ))}
      </div>

      {tab === "income" && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Property","Students","Expected","Collected","Arrears","Rate"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {totals.map(t => {
            const ac = T.prop[t.name];
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
      )}

      {tab === "outstanding" && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
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
      )}

      {tab === "occupancy" && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Property","Total Beds","Occupied","Vacant","Occupancy"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {totals.map(t => {
            const ac = T.prop[t.name]; const occ = t.totalBeds-t.vacantBeds; const occRate = t.totalBeds>0?((occ/t.totalBeds)*100).toFixed(1):"0";
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
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"⬡" },
  { id:"students",  label:"Students",  icon:"◎" },
  { id:"reports",   label:"Reports",   icon:"▦" },
];

/* ═══════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selProp, setSelProp] = useState(null);
  const [data, setData] = useState(JSON.parse(JSON.stringify(SEED)));
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addStudentProp, setAddStudentProp] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentProp, setPaymentProp] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);
  const [profileRoom, setProfileRoom] = useState(null);
  const [profilePropName, setProfilePropName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const props = useMemo(() => buildProps(data), [data]);
  const overdueCount = props.reduce((a,p) => a + p.overdue.length, 0);

  const navTo = (v) => { setView(v); setSelProp(null); setSidebarOpen(false); };
  const handleSelect = (name) => { setSelProp(name); setView("property"); setSidebarOpen(false); };
  const handleBack = () => { setSelProp(null); setView("dashboard"); };

  const handleAddStudent = (propName, roomId, student) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const room = next[propName].rooms.find(r => r.id === roomId);
      if (room) room.students.push(student);
      return next;
    });
  };

  const handleRecordPayment = (propName, studentId, payment) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const room of next[propName].rooms) {
        const s = room.students.find(st => st.id === studentId);
        if (s) {
          s.paid += payment.amount;
          if (!s.payHistory) s.payHistory = [];
          s.payHistory.push(payment);
          if (s.paid >= room.rent) s.status = "PAID";
          else if (s.paid > 0) s.status = "PARTIAL";
          break;
        }
      }
      return next;
    });
  };

  const handleExportCSV = () => { setView("reports"); };
  const isManager = user?.role === "manager";

  if (!user) return <LoginScreen onLogin={setUser} />;

  const activePropObj = selProp ? props.find(p=>p.name===selProp) : null;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:font, color:T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{globalCSS}</style>

      {/* Mobile top bar */}
      <div className="pn-hamburger" style={{ display:"none", position:"fixed", top:0, left:0, right:0, height:52,
        background:T.surface, borderBottom:`1px solid ${T.border}`, zIndex:850, alignItems:"center", padding:"0 16px", justifyContent:"space-between" }}>
        <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", color:T.gold, fontSize:22, padding:4 }}>
          {sidebarOpen ? "✕" : "☰"}
        </button>
        <div style={{ fontSize:16, fontWeight:800, color:T.gold }}>Trevis</div>
        <div style={{ width:28, height:28, borderRadius:"50%", background:T.goldDim, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:11, fontWeight:700, color:T.gold }}>{user.email[0].toUpperCase()}</div>
      </div>

      {/* Sidebar overlay */}
      <div className={`pn-sidebar-overlay ${sidebarOpen?"pn-sidebar-open":""}`} onClick={()=>setSidebarOpen(false)} style={{ display:"none" }} />

      <div style={{ display:"flex", minHeight:"100vh" }}>
        {/* Sidebar */}
        <div className={`pn-sidebar ${sidebarOpen?"pn-sidebar-open":""}`} style={{ width:220, background:T.surface, borderRight:`1px solid ${T.border}`,
          display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
          <div style={{ padding:"0 22px 28px" }}>
            <div className="pn-logo-text" style={{ fontSize:20, fontWeight:800, color:T.gold, letterSpacing:"-0.02em" }}>Trevis</div>
            <div className="pn-logo-sub" style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.15em", marginTop:2 }}>Property Manager</div>
          </div>
          <div style={{ flex:1 }}>
            {NAV.map(n => {
              const active = view === n.id || (n.id==="dashboard" && view==="property");
              return (
                <button key={n.id} onClick={() => navTo(n.id)}
                  style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"11px 22px",
                    background: active ? T.goldDim : "none", border:"none",
                    borderLeft: active ? `3px solid ${T.gold}` : "3px solid transparent",
                    color: active ? T.gold : T.muted, cursor:"pointer", fontSize:13,
                    fontWeight: active ? 700 : 400, fontFamily:font, transition:"all .15s", textAlign:"left", position:"relative" }}>
                  <span style={{ fontSize:16 }}>{n.icon}</span>
                  <span className="pn-label">{n.label}</span>
                  {n.id==="dashboard" && overdueCount > 0 && (
                    <span style={{ position:"absolute", right:16, background:T.red, color:"#fff", borderRadius:10,
                      padding:"1px 6px", fontSize:9, fontWeight:700, minWidth:16, textAlign:"center" }}>{overdueCount}</span>
                  )}
                </button>
              );
            })}
            <div style={{ padding:"20px 22px 8px", fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.12em" }}><span className="pn-label">Properties</span></div>
            {props.map(p => {
              const ac = T.prop[p.name]; const active = selProp === p.name;
              return (
                <button key={p.name} onClick={() => handleSelect(p.name)}
                  style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 22px",
                    background: active ? ac.dim : "none", border:"none", color: active ? ac.accent : T.subtle,
                    cursor:"pointer", fontSize:12, fontWeight: active ? 700 : 400, fontFamily:font, textAlign:"left",
                    borderLeft:`3px solid ${active ? ac.accent : "transparent"}`, transition:"all .15s" }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background: ac.accent, opacity: active ? 1 : 0.4 }} />
                  <span className="pn-label">{p.name}</span>
                </button>
              );
            })}
          </div>
          {/* User badge */}
          <div style={{ padding:"16px 22px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:T.goldDim, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:12, fontWeight:700, color:T.gold }}>{user.email[0].toUpperCase()}</div>
              <div className="pn-label">
                <div style={{ fontSize:11, color:T.text, fontWeight:600 }}>{user.role === "admin" ? "Admin" : "Manager"}</div>
                <div style={{ fontSize:10, color:T.muted }}>{user.email}</div>
              </div>
            </div>
            <button onClick={() => setUser(null)} className="pn-label"
              style={{ width:"100%", background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 0",
                color:T.muted, fontSize:11, cursor:"pointer", fontFamily:font, transition:"all .15s" }}>Logout</button>
          </div>
        </div>

        {/* Main */}
        <div className="pn-main" style={{ flex:1, padding:"36px 40px", overflowY:"auto", maxHeight:"100vh" }}>
          {view === "dashboard" && <Dashboard props={props} onSelect={handleSelect}
            onAddStudent={()=>{if(!isManager){setAddStudentProp("");setShowAddStudent(true);}}}
            onRecordPayment={()=>{setPaymentProp(null);setShowPayment(true);}}
            onExport={handleExportCSV} />}
          {view === "property" && selProp && <PropertyDetail name={selProp} props={props} onBack={handleBack}
            onOpenPay={()=>{setPaymentProp(activePropObj);setShowPayment(true);}}
            onAddStudent={()=>{if(!isManager){setAddStudentProp(selProp);setShowAddStudent(true);}}}
            onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}} />}
          {view === "students" && <Students props={props}
            onAddStudent={()=>{if(!isManager){setAddStudentProp("");setShowAddStudent(true);}}} />}
          {view === "reports" && <Reports props={props} />}
        </div>
      </div>

      {/* Modals */}
      {!isManager && <AddStudentWizard open={showAddStudent} onClose={()=>setShowAddStudent(false)}
        properties={props} defaultProp={addStudentProp} onAdd={handleAddStudent} user={user} />}
      <PaymentModal open={showPayment} onClose={()=>setShowPayment(false)}
        prop={paymentProp} ac={paymentProp?T.prop[paymentProp.name]:null}
        onRecord={handleRecordPayment} user={user} allProps={props} />
      {profileStudent && <StudentProfile student={profileStudent} room={profileRoom} propName={profilePropName}
        onClose={()=>setProfileStudent(null)}
        onRecordPay={()=>{setPaymentProp(props.find(p=>p.name===profilePropName));setShowPayment(true);setProfileStudent(null);}} />}
    </div>
  );
}
