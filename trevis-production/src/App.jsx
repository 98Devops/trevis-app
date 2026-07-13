import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth, useData, isConfigured, addRoomSvc, addStudentSvc, removeStudentSvc, getDataFlags, saveMonthlySnapshot, generateObligations, removeRoom } from "./parts/p1_imports_context.jsx";
import { T, font, globalCSS, buildProps } from "./parts/p2_helpers.jsx";
import { LoginScreen, AddStudentWizard, AddRoomModal, PaymentModal, StudentProfile } from "./parts/p3_modals.jsx";
import { Dashboard } from "./parts/p4_dashboard.jsx";
import { PropertyDetail, Students } from "./parts/p5_views.jsx";
import { Reports } from "./parts/p6_reports.jsx";
import { Finances } from "./parts/p7_arrears.jsx";
import { Calendar } from "./parts/p8_calendar.jsx";
import { SettingsPanel } from "./parts/p9_settings.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useCoverageStore } from "./hooks/useCoverageStore.js";
import { debug } from "./lib/debug.js";

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"⬡" },
  { id:"students",  label:"Students",  icon:"◎" },
  { id:"calendar",  label:"Calendar",  icon:"📅" },
  { id:"finances",  label:"Finances",  icon:"◈" },
  { id:"reports",   label:"Reports",   icon:"▦" },
];

/* ═══════════════════════════════════════════════════════════
   FALLBACK SEED (demo mode when Supabase not configured)
═══════════════════════════════════════════════════════════ */
const DEMO_PROPS = [
  { id:"demo-mc", name:"Maple Court", location:"Riverside", rooms:[
    { id:"d1",no:"Room 1",beds:4,rent:110,students:[
      {id:"ds1",name:"James Carter",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
      {id:"ds2",name:"Emily Brooks",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
      {id:"ds3",name:"Daniel Okafor",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
      {id:"ds4",name:"Chloe Bennett",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
    ]},
  ], collected:440, expected:440, students:4, overdue:[], totalBeds:4, vacantBeds:0 },
  { id:"demo-ow", name:"Oakwood", location:"Riverside", rooms:[], collected:0, expected:0, students:0, overdue:[], totalBeds:0, vacantBeds:0 },
  { id:"demo-bg", name:"Birchgate", location:"Riverside", rooms:[], collected:0, expected:0, students:0, overdue:[], totalBeds:0, vacantBeds:0 },
  { id:"demo-ch", name:"Cedar House", location:"Riverside", rooms:[], collected:0, expected:0, students:0, overdue:[], totalBeds:0, vacantBeds:0 },
];

/* ═══════════════════════════════════════════════════════════
   LOADING SKELETON COMPONENTS (Phase 4B.6)
═══════════════════════════════════════════════════════════ */
function DashboardSkeleton() {
  const now = new Date();
  const monthYear = now.toLocaleString("en-US", { month:"long", year:"numeric" });
  
  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:13, color:T.gold, textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:600, marginBottom:4 }}>{monthYear}</h2>
        <div style={{ fontSize:11, color:T.subtle, marginBottom:8 }}>Loading...</div>
        <div className="pn-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h1 style={{ fontSize:28, fontWeight:800, color:T.text, margin:0 }}>Portfolio Overview</h1>
        </div>
      </div>

      {/* KPI strip skeleton */}
      <div className="pn-kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:20 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px" }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>—</div>
            <div style={{ fontSize:24, fontWeight:800, color:T.subtle }}>—</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>Loading...</div>
          </div>
        ))}
      </div>

      {/* Properties grid skeleton */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16, marginTop:24 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:20 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:T.surface, marginBottom:12 }} />
            <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:4 }}>—</div>
            <div style={{ fontSize:11, color:T.muted }}>Loading...</div>
            <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}`, display:"flex", gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:T.muted }}>Rooms</div>
                <div style={{ fontSize:16, fontWeight:700, color:T.text }}>—</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:T.muted }}>Students</div>
                <div style={{ fontSize:16, fontWeight:700, color:T.text }}>—</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INNER APP (needs auth + data contexts)
═══════════════════════════════════════════════════════════ */
function AppInner() {
  const { user, setUser, login, logout, loading: authLoading } = useAuth();
  const { properties: rawProps, loading: dataLoading, refresh } = useData();

  const [view, setView] = useState("dashboard");
  const [selProp, setSelProp] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addStudentProp, setAddStudentProp] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentProp, setPaymentProp] = useState(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [addRoomPropId, setAddRoomPropId] = useState(null);
  const [addRoomPropName, setAddRoomPropName] = useState("");
  const [profileStudent, setProfileStudent] = useState(null);
  const [profileRoom, setProfileRoom] = useState(null);
  const [profilePropName, setProfilePropName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataFlags, setDataFlags] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [toast, setToast] = useState(null);
  const [financesFilter, setFinancesFilter] = useState("ALL");
  const [showSettings, setShowSettings] = useState(false);
  
  // Phase 4C-C: single app-level coverage store (one fetch shared by dashboard +
  // property views), replacing the per-property N+1 cache. refresh() after any
  // mutation re-syncs everything (no scattered `new Map()` invalidations).
  const coverage = useCoverageStore(isConfigured);
  // Back-compat shim: existing handlers call setCoverageCache(new Map()) to
  // invalidate. Route that to a single store refresh so we don't have to touch
  // every call site. (setCoverageCacheTimestamp becomes a no-op.)
  const setCoverageCache = useCallback(() => coverage.refresh(), [coverage]);
  const setCoverageCacheTimestamp = useCallback(() => {}, []);

  // Build UI props from raw Supabase data or use demo
  const props = useMemo(() => {
    if (!isConfigured || rawProps.length === 0) return DEMO_PROPS;
    return buildProps(rawProps);
  }, [rawProps]);

  const isAdmin = user?.role === "ADMIN" || user?.role === "admin";
  const isManager = user?.role === "MANAGER" || user?.role === "manager";
  const overdueCount = props.reduce((a,p) => a + p.overdue.length, 0);
  const financesCount = props.reduce((a,p) => a + p.overdue.length, 0);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Escape') {
        setShowAddStudent(false); setShowPayment(false); setShowAddRoom(false);
        setProfileStudent(null); setShowReportModal(false);
      }
      if (e.key === 'd' || e.key === 'D') { setView('dashboard'); setSelProp(null); }
      if (e.key === 'r' || e.key === 'R') { setView('reports'); setSelProp(null); }
      if (e.key === 'n' || e.key === 'N') { if(isAdmin){setAddStudentProp('');setShowAddStudent(true);} }
      if (e.key === 'p' || e.key === 'P') { setPaymentProp(null); setShowPayment(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAdmin]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const showToast = (msg, type='success') => setToast({ msg, type });

  // Load data flags for admin
  useEffect(() => {
    if (isAdmin && isConfigured) {
      getDataFlags().then(({ data }) => setDataFlags(data || []));
    }
  }, [isAdmin, rawProps]);

  // Filter props for manager
  const visibleProps = useMemo(() => {
    if (isAdmin || !user?.property_id) return props;
    return props.filter(p => p.id === user.property_id);
  }, [props, user, isAdmin]);

  const navTo = (v) => { setView(v); setSelProp(null); setSidebarOpen(false); if (v !== "finances") setFinancesFilter("ALL"); };
  const handleSelect = (name) => { setSelProp(name); setView("property"); setSidebarOpen(false); };
  const handleBack = () => { setSelProp(null); setView("dashboard"); };
  const handlePropertyCardClick = (propName) => { setFinancesFilter(propName); setView("finances"); setSidebarOpen(false); };

  const handleAddStudent = async (propName, roomId, student) => {
    if (isConfigured) {
      await addStudentSvc(student);
      refresh();
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (isConfigured) {
      await removeStudentSvc(studentId);
      refresh();
    }
  };

  const handleRecordPayment = async (propName, studentId, payment) => {
    if (isConfigured) {
      // Phase 4B.2: Use new coverage-aware payment recording
      const { recordPaymentWithCoverage } = await import('./services/coverageDatabaseService.js');
      const { rebuildError } = await recordPaymentWithCoverage({
        studentId,
        amount: payment.amount,
        paymentDate: payment.date,
        paymentMethod: payment.method,
        receiptNumber: payment.receipt,
        notes: payment.notes,
        recordedBy: user?.id
      });

      // Phase 4B.9: Invalidate coverage cache on payment (data changed)
      debug('[Phase4B.9] Invalidating coverage cache after payment');
      setCoverageCache(new Map());
      setCoverageCacheTimestamp(Date.now());

      // No need to recalculate balances - recordPaymentWithCoverage handles everything
      refresh();

      // TD-5: surface coverage rebuild failure instead of reporting a clean success.
      // The payment row was recorded, but coverage may be stale until repaired.
      if (rebuildError) {
        showToast('Payment recorded, but coverage update failed — coverage may be out of date. Try again or run repair.', 'error');
      }
    }
  };

  const handleAddRoom = async (propertyId, roomNumber, beds, rent, notes) => {
    if (isConfigured) {
      await addRoomSvc(propertyId, roomNumber, beds, rent, notes);
      refresh();
    }
  };

  const handleRemoveRoom = async (roomId) => {
    if (isConfigured) {
      const { data, error } = await removeRoom(roomId, user?.id);
      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('Room removed successfully');
        refresh();
      }
    }
  };

  const handleExportCSV = () => { setShowReportModal(true); };

  // Per-property CSV export
  const handlePropertyExport = (propName) => {
    const p = visibleProps.find(x => x.name === propName);
    if (!p) return;
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    let csv = `Property,Room,Student,Rent Due,Amount Paid,Balance,Status,Check-in Date,Notes\n`;
    p.rooms.forEach(r => r.students.filter(s=>s.status!=='VACANT'&&s.status!=='VACATED').forEach(s => {
      csv += `"${p.name}","${r.no}","${s.name}",${r.rent},${s.paid},${r.rent-s.paid},${s.status},"${s.date||''}","${(s.notes||'').replace(/"/g,"''")}"\n`;
    }));
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `PropNest_${propName.replace(/\s+/g,'_')}_${ts}.csv`; a.click();
  };

  const handleLogin = async (emailOrUser, password) => {
    if (!isConfigured) { setUser(emailOrUser); return { data: emailOrUser, error: null }; }
    return await login(emailOrUser, password);
  };

  if (authLoading) return (
    <div style={{ minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font }}>
      <div style={{ color:T.gold,fontSize:18,fontWeight:700 }}>Loading...</div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin} isConfigured={isConfigured} />;

  const activePropObj = selProp ? visibleProps.find(p=>p.name===selProp) : null;

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
        <div style={{ fontSize:16, fontWeight:800, color:T.gold }}>PropNest</div>
        <div style={{ width:28, height:28, borderRadius:"50%", background:T.goldDim, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:11, fontWeight:700, color:T.gold, flexShrink:0 }}>{(user.email||"U")[0].toUpperCase()}</div>
      </div>

      <div className={`pn-sidebar-overlay ${sidebarOpen?"pn-sidebar-open":""}`} onClick={()=>setSidebarOpen(false)} style={{ display:"none" }} />

      <div style={{ display:"flex", minHeight:"100vh" }}>
        {/* Sidebar */}
        <div className={`pn-sidebar ${sidebarOpen?"pn-sidebar-open":""}`} style={{ width:220, background:T.surface, borderRight:`1px solid ${T.border}`,
          display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
          <div style={{ padding:"0 22px 28px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:T.gold, letterSpacing:"-0.02em" }}>PropNest</div>
            <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.15em", marginTop:2 }}>Property Manager</div>
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
                  {n.id==="finances" && financesCount > 0 && (
                    <span style={{ position:"absolute", right:16, background:T.red, color:"#fff", borderRadius:10,
                      padding:"1px 6px", fontSize:9, fontWeight:700, minWidth:16, textAlign:"center" }}>{financesCount}</span>
                  )}
                </button>
              );
            })}
            <div style={{ padding:"20px 22px 8px", fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.12em" }}><span className="pn-label">Properties</span></div>
            {visibleProps.map(p => {
              const ac = T.prop[p.name] || { accent: T.gold, dim: T.goldDim }; const active = selProp === p.name;
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
          <div style={{ padding:"16px 22px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:T.goldDim, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:12, fontWeight:700, color:T.gold, flexShrink:0 }}>{(user.email||"U")[0].toUpperCase()}</div>
              <div className="pn-label">
                <div style={{ fontSize:11, color:T.text, fontWeight:600 }}>{isAdmin ? "Admin" : "Manager"}</div>
                <div style={{ fontSize:10, color:T.muted }}>{user.email}</div>
              </div>
              {isAdmin && (
                <button onClick={() => setShowSettings(true)} style={{ 
                  background: "none", 
                  border: "none", 
                  color: T.muted, 
                  cursor: "pointer", 
                  fontSize: 16,
                  padding: 4
                }} title="Settings">⚙️</button>
              )}
            </div>
            <button onClick={()=>{ logout ? logout() : setUser(null); }} className="pn-label"
              style={{ width:"100%", background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 0",
                color:T.muted, fontSize:11, cursor:"pointer", fontFamily:font }}>Logout</button>
          </div>
        </div>

        {/* Main */}
        <div className="pn-main" style={{ flex:1, padding:"36px 40px", overflowY:"auto", maxHeight:"100vh" }}>
          {/* Phase 4B.6: Show loading skeleton while data is fetching - prevents flicker */}
          {dataLoading && view === "dashboard" ? (
            <ErrorBoundary componentName="Dashboard">
              <DashboardSkeleton />
            </ErrorBoundary>
          ) : view === "dashboard" && (
            <ErrorBoundary componentName="Dashboard">
              <Dashboard props={visibleProps} onSelect={handleSelect}
                onAddStudent={()=>{if(isAdmin){setAddStudentProp("");setShowAddStudent(true);}}}
                onRecordPayment={()=>{setPaymentProp(null);setShowPayment(true);}}
                onExport={handleExportCSV}
                onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}}
                sharedCoverageStudents={coverage.students}
                sharedCoverageLoading={coverage.loading}
                onPropertyCardClick={handlePropertyCardClick} />
            </ErrorBoundary>
          )}
          {view === "property" && selProp && (
            <ErrorBoundary componentName="PropertyDetail">
              <PropertyDetail name={selProp} props={visibleProps} onBack={handleBack}
                onOpenPay={()=>{setPaymentProp(activePropObj);setShowPayment(true);}}
                onAddStudent={()=>{if(isAdmin){setAddStudentProp(selProp);setShowAddStudent(true);}}}
                onAddRoom={()=>{if(isAdmin&&activePropObj){setAddRoomPropId(activePropObj.id);setAddRoomPropName(activePropObj.name);setShowAddRoom(true);}}}
                onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}}
                onExport={handlePropertyExport}
                onRemoveRoom={handleRemoveRoom}
                sharedCoverageMap={coverage.coverageMap}
                isLoadingCoverage={coverage.loading}
                isAdmin={isAdmin} />
            </ErrorBoundary>
          )}
          {view === "students" && (
            <ErrorBoundary componentName="Students">
              <Students props={visibleProps}
                onAddStudent={()=>{if(isAdmin){setAddStudentProp("");setShowAddStudent(true);}}}
                onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}} />
            </ErrorBoundary>
          )}
          {view === "calendar" && (
            <ErrorBoundary componentName="Calendar">
              <Calendar props={visibleProps}
                onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}} />
            </ErrorBoundary>
          )}
          {view === "finances" && (
            <ErrorBoundary componentName="Finances">
              <Finances props={visibleProps}
                onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}}
                initialPropFilter={financesFilter} />
            </ErrorBoundary>
          )}
          {view === "reports" && (
            <ErrorBoundary componentName="Reports">
              <Reports props={visibleProps} dataFlags={dataFlags} isAdmin={isAdmin}
                onSaveSnapshot={async ()=>{
                  const d = new Date(); const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
                  const {data,error}=await saveMonthlySnapshot(month);
                  if(error) showToast('Error: '+error.message,'error');
                  else showToast(`Snapshot saved for ${data} properties`);
                }}
                onGenerateObligations={async ()=>{
                  const d = new Date(); const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
                  const {data,error}=await generateObligations(month);
                  if(error) showToast('Error: '+error.message,'error');
                  else showToast(`Generated obligations for ${data} students`);
                }} />
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Modals */}
      {isAdmin && <AddStudentWizard open={showAddStudent} onClose={()=>setShowAddStudent(false)}
        properties={visibleProps} defaultProp={addStudentProp} onAdd={handleAddStudent} user={user} />}
      {isAdmin && <AddRoomModal open={showAddRoom} onClose={()=>setShowAddRoom(false)}
        propertyId={addRoomPropId} propertyName={addRoomPropName} onAdd={handleAddRoom} />}
      <PaymentModal open={showPayment} onClose={()=>setShowPayment(false)}
        prop={paymentProp} onRecord={handleRecordPayment} user={user} allProps={visibleProps} />
      {profileStudent && <StudentProfile student={profileStudent} room={profileRoom} propName={profilePropName}
        onClose={()=>setProfileStudent(null)}
        onRecordPay={()=>{setPaymentProp(visibleProps.find(p=>p.name===profilePropName));setShowPayment(true);setProfileStudent(null);}}
        onRemove={handleRemoveStudent} isAdmin={isAdmin} user={user} refresh={refresh}
        setCoverageCache={setCoverageCache} setCoverageCacheTimestamp={setCoverageCacheTimestamp} />}

      {/* Report download modal */}
      {showReportModal && <ReportDownloadModal props={visibleProps} user={user}
        onClose={()=>setShowReportModal(false)} />}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel 
          onClose={() => setShowSettings(false)} 
          isAdmin={isAdmin} 
          user={user} 
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:toast.type==='error'?T.redDim:T.greenDim,
          border:`1px solid ${toast.type==='error'?T.red:T.green}`, borderRadius:10, padding:'12px 20px',
          color:toast.type==='error'?T.red:T.green, fontSize:13, fontWeight:600, fontFamily:font, zIndex:1100,
          animation:'fadeIn .3s ease', boxShadow:'0 4px 20px rgba(0,0,0,.3)' }}>
          {toast.type==='error'?'✕':'✓'} {toast.msg}
        </div>
      )}

      {/* Keyboard shortcut bar — desktop only */}
      {showShortcuts && user && (
        <div className="pn-shortcuts" style={{ position:'fixed', bottom:0, left:220, right:0, background:T.surface,
          borderTop:`1px solid ${T.border}`, padding:'6px 20px', display:'flex', alignItems:'center', gap:16, zIndex:800 }}>
          <span style={{ fontSize:10, color:T.muted }}>Shortcuts:</span>
          {[['D','Dashboard'],['R','Reports'],['N','Add Student'],['P','Record Payment'],['Esc','Close']].map(([k,l])=>(
            <span key={k} style={{ fontSize:10, color:T.subtle, display:'flex', alignItems:'center', gap:4 }}>
              <kbd style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:3, padding:'1px 5px',
                fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:T.gold }}>{k}</kbd> {l}
            </span>
          ))}
          <button onClick={()=>setShowShortcuts(false)} style={{ marginLeft:'auto', background:'none', border:'none',
            color:T.muted, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   REPORT DOWNLOAD MODAL — CSV or PDF print
═══════════════════════════════════════════════════════════ */
function ReportDownloadModal({ props, user, onClose }) {
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month:"long", year:"numeric" });
  const grand = props.reduce((a,p) => ({
    students:a.students+p.students, collected:a.collected+p.collected,
    expected:a.expected+p.expected, rooms:a.rooms+p.rooms.length
  }), { students:0, collected:0, expected:0, rooms:0 });

  const handleCSV = () => {
    const ts = now.toISOString().replace(/[:.]/g,'-').slice(0,19);
    let csv = "Property,Rooms,Students,Expected,Collected,Arrears,Rate%\n";
    props.forEach(p => {
      const arr = p.expected-p.collected;
      const rate = p.expected>0?((p.collected/p.expected)*100).toFixed(1):"0";
      csv += `"${p.name}",${p.rooms.length},${p.students},${p.expected},${p.collected},${arr},${rate}\n`;
    });
    csv += `TOTAL,${grand.rooms},${grand.students},${grand.expected},${grand.collected},${grand.expected-grand.collected},${grand.expected>0?((grand.collected/grand.expected)*100).toFixed(1):"0"}\n\n`;
    csv += "Student,Property,Room,Rent,Paid,Balance,Status\n";
    props.forEach(p => p.rooms.forEach(r => r.students.filter(s=>s.status!=='VACANT'&&s.status!=='VACATED').forEach(s => {
      csv += `"${s.name}","${p.name}","${r.no}",${r.rent},${s.paid},${r.rent-s.paid},${s.status}\n`;
    })));
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `PropNest_Report_${ts}.csv`; a.click();
    onClose();
  };

  const handlePDF = () => {
    const outstanding = props.flatMap(p => p.rooms.flatMap(r =>
      r.students.filter(s=>s.status!=='PAID'&&s.status!=='VACANT'&&s.status!=='VACATED')
        .map(s => ({ name:s.name, property:p.name, room:r.no, balance:r.rent-s.paid }))
    )).filter(s=>s.balance>0);

    const printDiv = document.createElement('div');
    printDiv.id = 'propnest-print-report';
    printDiv.innerHTML = `
      <style>
        @media print {
          body > *:not(#propnest-print-report) { display:none !important; }
          #propnest-print-report { display:block !important; }
        }
        #propnest-print-report { font-family:Arial,sans-serif; color:#222; padding:32px; max-width:800px; margin:0 auto; }
        #propnest-print-report h1 { font-size:22px; margin:0 0 4px; }
        #propnest-print-report .subtitle { font-size:12px; color:#666; margin-bottom:24px; }
        #propnest-print-report table { width:100%; border-collapse:collapse; margin:16px 0; font-size:12px; }
        #propnest-print-report th { background:#f5f5f5; text-align:left; padding:8px 10px; border:1px solid #ddd; font-weight:600; }
        #propnest-print-report td { padding:7px 10px; border:1px solid #ddd; }
        #propnest-print-report tr:nth-child(even) td { background:#fafafa; }
        #propnest-print-report .total-row td { font-weight:700; background:#f0f0f0 !important; }
        #propnest-print-report .section { margin-top:24px; }
        #propnest-print-report .footer { margin-top:32px; font-size:10px; color:#999; border-top:1px solid #ddd; padding-top:8px; }
      </style>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h1>PropNest</h1><div class="subtitle">Monthly Report — ${monthLabel}</div></div>
        <div style="text-align:right;font-size:11px;color:#666">Generated: ${now.toLocaleString()}</div>
      </div>
      <table>
        <thead><tr><th>Property</th><th>Rooms</th><th>Students</th><th>Expected</th><th>Collected</th><th>Arrears</th><th>Rate</th></tr></thead>
        <tbody>
          ${props.map(p => {const arr=p.expected-p.collected;const rate=p.expected>0?((p.collected/p.expected)*100).toFixed(1):'0';
            return `<tr><td>${p.name}</td><td>${p.rooms.length}</td><td>${p.students}</td><td>$${p.expected.toLocaleString()}</td><td>$${p.collected.toLocaleString()}</td><td>$${arr.toLocaleString()}</td><td>${rate}%</td></tr>`;
          }).join('')}
          <tr class="total-row"><td>TOTAL</td><td>${grand.rooms}</td><td>${grand.students}</td><td>$${grand.expected.toLocaleString()}</td><td>$${grand.collected.toLocaleString()}</td><td>$${(grand.expected-grand.collected).toLocaleString()}</td><td>${grand.expected>0?((grand.collected/grand.expected)*100).toFixed(1):'0'}%</td></tr>
        </tbody>
      </table>
      ${outstanding.length > 0 ? `
        <div class="section"><h3>Outstanding Balances (${outstanding.length} students)</h3>
        <table><thead><tr><th>Student</th><th>Property</th><th>Room</th><th>Balance</th></tr></thead>
        <tbody>${outstanding.map(s=>`<tr><td>${s.name}</td><td>${s.property}</td><td>${s.room}</td><td>$${s.balance.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
      ` : '<div class="section"><p>✓ No outstanding balances</p></div>'}
      <div class="footer">Generated by PropNest</div>
    `;
    document.body.appendChild(printDiv);
    window.print();
    setTimeout(() => document.body.removeChild(printDiv), 1000);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div onClick={e=>e.stopPropagation()} className="pn-modal-inner"
        style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:32, width:380, animation:'fadeIn .3s ease' }}>
        <div style={{ fontSize:18, fontWeight:800, color:T.text, marginBottom:4 }}>Download Report</div>
        <div style={{ fontSize:12, color:T.muted, marginBottom:24 }}>{monthLabel} — Portfolio Summary</div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <button onClick={handleCSV} style={{ display:'flex', alignItems:'center', gap:12, background:T.surface,
            border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px', cursor:'pointer', fontFamily:font,
            transition:'all .15s', textAlign:'left' }}
            onMouseEnter={e=>e.currentTarget.style.background=T.hover}
            onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
            <span style={{ fontSize:20 }}>📊</span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>Download CSV</div>
              <div style={{ fontSize:11, color:T.muted }}>Spreadsheet format — open in Excel</div>
            </div>
          </button>
          <button onClick={handlePDF} style={{ display:'flex', alignItems:'center', gap:12, background:T.surface,
            border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px', cursor:'pointer', fontFamily:font,
            transition:'all .15s', textAlign:'left' }}
            onMouseEnter={e=>e.currentTarget.style.background=T.hover}
            onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
            <span style={{ fontSize:20 }}>📄</span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>Print PDF Summary</div>
              <div style={{ fontSize:11, color:T.muted }}>Formatted report — save as PDF via print</div>
            </div>
          </button>
        </div>
        <button onClick={onClose} style={{ width:'100%', marginTop:16, background:'none', border:`1px solid ${T.border}`,
          borderRadius:8, padding:'8px 0', color:T.muted, fontSize:12, cursor:'pointer', fontFamily:font }}>Cancel</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT APP — wrapped with providers
═══════════════════════════════════════════════════════════ */
export default function App() {
  // Providers are now hoisted to src/main.jsx. The new PropNest shell is the
  // default; this legacy App is reachable via /?legacy=1 as a fallback for
  // features not yet fused (inline edits, payment edit/delete, etc.).
  return <AppInner />;
}
