import { useState, useMemo, useEffect } from "react";
import { AuthProvider, useAuth, DataProvider, useData, isConfigured, addRoomSvc, addStudentSvc, removeStudentSvc, recordPaymentSvc, getPaymentsByStudent, getDataFlags } from "./parts/p1_imports_context.jsx";
import { T, font, globalCSS, fmt, buildProps } from "./parts/p2_helpers.jsx";
import { LoginScreen, NotConfiguredScreen, AddStudentWizard, AddRoomModal, PaymentModal, StudentProfile } from "./parts/p3_modals.jsx";
import { Dashboard } from "./parts/p4_dashboard.jsx";
import { PropertyDetail, Students } from "./parts/p5_views.jsx";
import { Reports } from "./parts/p6_reports.jsx";

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"⬡" },
  { id:"students",  label:"Students",  icon:"◎" },
  { id:"reports",   label:"Reports",   icon:"▦" },
];

/* ═══════════════════════════════════════════════════════════
   FALLBACK SEED (demo mode when Supabase not configured)
═══════════════════════════════════════════════════════════ */
const DEMO_PROPS = [
  { id:"demo-kf", name:"King Fisher", location:"Harare", rooms:[
    { id:"d1",no:"Room 1",beds:4,rent:110,students:[
      {id:"ds1",name:"Bethel Mudavanhu",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
      {id:"ds2",name:"Maitaishe Manatsa",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
      {id:"ds3",name:"Dephen Chakandinakira",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
      {id:"ds4",name:"Chengeto Kanyai",paid:110,status:"PAID",date:"—",notes:"",payHistory:[]},
    ]},
  ], collected:440, expected:440, students:4, overdue:[], totalBeds:4, vacantBeds:0 },
  { id:"demo-tc", name:"The Chase", location:"Harare", rooms:[], collected:0, expected:0, students:0, overdue:[], totalBeds:0, vacantBeds:0 },
  { id:"demo-md", name:"Madden", location:"Harare", rooms:[], collected:0, expected:0, students:0, overdue:[], totalBeds:0, vacantBeds:0 },
  { id:"demo-nh", name:"NEW HOUSE", location:"Harare", rooms:[], collected:0, expected:0, students:0, overdue:[], totalBeds:0, vacantBeds:0 },
];

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

  // Build UI props from raw Supabase data or use demo
  const props = useMemo(() => {
    if (!isConfigured || rawProps.length === 0) return DEMO_PROPS;
    return buildProps(rawProps);
  }, [rawProps]);

  const isAdmin = user?.role === "ADMIN" || user?.role === "admin";
  const isManager = user?.role === "MANAGER" || user?.role === "manager";
  const overdueCount = props.reduce((a,p) => a + p.overdue.length, 0);

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

  const navTo = (v) => { setView(v); setSelProp(null); setSidebarOpen(false); };
  const handleSelect = (name) => { setSelProp(name); setView("property"); setSidebarOpen(false); };
  const handleBack = () => { setSelProp(null); setView("dashboard"); };

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
      await recordPaymentSvc({
        studentId, amount: payment.amount, paymentDate: payment.date,
        paymentMethod: payment.method, receiptNumber: payment.receipt,
        notes: payment.notes, recordedBy: user?.id
      });
      refresh();
    }
  };

  const handleAddRoom = async (propertyId, roomNumber, beds, rent, notes) => {
    if (isConfigured) {
      await addRoomSvc(propertyId, roomNumber, beds, rent, notes);
      refresh();
    }
  };

  const handleExportCSV = () => { setView("reports"); };

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
        <div style={{ fontSize:16, fontWeight:800, color:T.gold }}>Trevis</div>
        <div style={{ width:28, height:28, borderRadius:"50%", background:T.goldDim, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:11, fontWeight:700, color:T.gold }}>{(user.email||"U")[0].toUpperCase()}</div>
      </div>

      <div className={`pn-sidebar-overlay ${sidebarOpen?"pn-sidebar-open":""}`} onClick={()=>setSidebarOpen(false)} style={{ display:"none" }} />

      <div style={{ display:"flex", minHeight:"100vh" }}>
        {/* Sidebar */}
        <div className={`pn-sidebar ${sidebarOpen?"pn-sidebar-open":""}`} style={{ width:220, background:T.surface, borderRight:`1px solid ${T.border}`,
          display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
          <div style={{ padding:"0 22px 28px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:T.gold, letterSpacing:"-0.02em" }}>Trevis</div>
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
                justifyContent:"center", fontSize:12, fontWeight:700, color:T.gold }}>{(user.email||"U")[0].toUpperCase()}</div>
              <div className="pn-label">
                <div style={{ fontSize:11, color:T.text, fontWeight:600 }}>{isAdmin ? "Admin" : "Manager"}</div>
                <div style={{ fontSize:10, color:T.muted }}>{user.email}</div>
              </div>
            </div>
            <button onClick={()=>{ logout ? logout() : setUser(null); }} className="pn-label"
              style={{ width:"100%", background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 0",
                color:T.muted, fontSize:11, cursor:"pointer", fontFamily:font }}>Logout</button>
          </div>
        </div>

        {/* Main */}
        <div className="pn-main" style={{ flex:1, padding:"36px 40px", overflowY:"auto", maxHeight:"100vh" }}>
          {view === "dashboard" && <Dashboard props={visibleProps} onSelect={handleSelect}
            onAddStudent={()=>{if(isAdmin){setAddStudentProp("");setShowAddStudent(true);}}}
            onRecordPayment={()=>{setPaymentProp(null);setShowPayment(true);}}
            onExport={handleExportCSV} />}
          {view === "property" && selProp && <PropertyDetail name={selProp} props={visibleProps} onBack={handleBack}
            onOpenPay={()=>{setPaymentProp(activePropObj);setShowPayment(true);}}
            onAddStudent={()=>{if(isAdmin){setAddStudentProp(selProp);setShowAddStudent(true);}}}
            onAddRoom={()=>{if(isAdmin&&activePropObj){setAddRoomPropId(activePropObj.id);setAddRoomPropName(activePropObj.name);setShowAddRoom(true);}}}
            onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}}
            isAdmin={isAdmin} />}
          {view === "students" && <Students props={visibleProps}
            onAddStudent={()=>{if(isAdmin){setAddStudentProp("");setShowAddStudent(true);}}} />}
          {view === "reports" && <Reports props={visibleProps} dataFlags={dataFlags} isAdmin={isAdmin} />}
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
        onRemove={handleRemoveStudent} isAdmin={isAdmin} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT APP — wrapped with providers
═══════════════════════════════════════════════════════════ */
export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppInner />
      </DataProvider>
    </AuthProvider>
  );
}
