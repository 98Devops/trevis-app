import { useState, useEffect } from "react";
import { T, font, Badge, InputField, SelectField, Btn, fmt, daysSince, daysColor, daysUntilAnniversary, formatMonth } from "./p2_helpers.jsx";
import { supabase, isConfigured as sbConfigured } from "../lib/supabase";
import { useAuth } from "./p1_imports_context.jsx";
import InlineEditField from "../components/InlineEditField.jsx";
import { getAvailableRooms, executeTransfer, getTransferHistory } from "../services/transferService.js";
import { buildCoverageBreakdown } from "../services/coverageBreakdown.js";
import { debug } from "../lib/debug.js";

/* ═══════════════════════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════════════════════ */
export function LoginScreen({ onLogin, isConfigured }) {
  const { authError } = useAuth() || {};
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(authError || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authError) setErr(authError);
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    if (!isConfigured) {
      const demoUsers = [
        { email:"admin@propnest.app", password:"admin1234", role:"ADMIN", full_name:"Admin" },
        { email:"manager@propnest.app", password:"manager1234", role:"MANAGER", full_name:"Manager" },
      ];
      const u = demoUsers.find(u => u.email === email && u.password === pass);
      if (u) onLogin(u);
      else setErr("Invalid email or password");
      setLoading(false);
      return;
    }
    const { data, error } = await onLogin(email, pass);
    if (error) setErr(error.message || "Invalid email or password");
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!sbConfigured || !supabase) return;
    setLoading(true);
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) { setErr(error.message); setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:font }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:40, width:400, animation:"fadeIn .4s ease" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:32, fontWeight:800, color:T.gold, letterSpacing:"-0.02em" }}>PropNest</div>
          <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.15em", marginTop:4 }}>Property Manager</div>
        </div>
        {!isConfigured && (
          <div style={{ background:T.amberDim, border:`1px solid ${T.amber}30`, borderRadius:8, padding:"8px 12px", fontSize:11, color:T.amber, marginBottom:16, textAlign:"center" }}>
            ⚠ Demo Mode — Connect Supabase for production
          </div>
        )}
        {/* Google OAuth */}
        {isConfigured && (
          <>
            <button onClick={handleGoogleLogin} disabled={loading}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px",
                color:T.text, fontSize:13, fontWeight:600, cursor:loading?"wait":"pointer", fontFamily:font,
                transition:"all .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background=T.hover}
              onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:12, margin:"16px 0" }}>
              <div style={{ flex:1, height:1, background:T.border }} />
              <span style={{ fontSize:11, color:T.muted }}>or sign in with email</span>
              <div style={{ flex:1, height:1, background:T.border }} />
            </div>
          </>
        )}
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <InputField label="Email" value={email} onChange={v=>{setEmail(v);setErr("");}} type="email" placeholder="admin@propnest.app" />
          <InputField label="Password" value={pass} onChange={v=>{setPass(v);setErr("");}} type="password" placeholder="••••••••" />
          {err && <div style={{ color:T.red, fontSize:12, background:T.redDim, padding:"8px 12px", borderRadius:8 }}>{err}</div>}
          <Btn accent={T.gold} disabled={loading} style={{ marginTop:8, width:"100%", padding:12, fontSize:14 }}>
            {loading ? "Signing in…" : "Sign In"}
          </Btn>
        </form>
        <div style={{ fontSize:10, color:T.muted, textAlign:"center", marginTop:20, lineHeight:1.6 }}>
          {isConfigured ? "Staff access only — use your PropNest credentials" : "Demo: admin@propnest.app / admin1234"}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NOT CONFIGURED SCREEN
═══════════════════════════════════════════════════════════ */
export function NotConfiguredScreen() {
  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:font }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:48, width:500, textAlign:"center", animation:"fadeIn .4s ease" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔌</div>
        <div style={{ fontSize:24, fontWeight:800, color:T.gold, marginBottom:8 }}>Connect Your Database</div>
        <div style={{ fontSize:13, color:T.muted, lineHeight:1.7, marginBottom:24 }}>
          PropNest needs a Supabase backend to run in production mode.<br/>
          Add your credentials to <code style={{ color:T.amber }}>.env</code> and restart.
        </div>
        <div style={{ background:T.bg, borderRadius:10, padding:16, textAlign:"left", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:T.subtle, lineHeight:1.8 }}>
          VITE_SUPABASE_URL=https://xxx.supabase.co<br/>
          VITE_SUPABASE_ANON_KEY=eyJhbGci...
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD STUDENT WIZARD (Multi-step modal)
═══════════════════════════════════════════════════════════ */
export function AddStudentWizard({ open, onClose, properties, defaultProp, onAdd, user }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name:"", phone:"", idNumber:"", emergName:"", emergPhone:"",
    property: defaultProp || "", room:"", rent:0,
    checkIn:"", payPlan:"Monthly", notes:""
  });
  const upd = (k,v) => setForm(f => ({...f, [k]:v}));

  if (!open) return null;

  const selProp = properties.find(p => p.name === form.property);
  const availRooms = selProp ? selProp.rooms.filter(r => {
    const active = r.students.filter(s => s.status !== "VACANT" && s.status !== "VACATED").length;
    return active < r.beds;
  }) : [];
  const selRoom = selProp ? selProp.rooms.find(r => r.id === form.room) : null;
  const canNext = step === 1 ? form.name.trim() : step === 2 ? form.property && form.room : true;

  const handleConfirm = () => {
    onAdd(form.property, form.room, {
      full_name: form.name, phone: form.phone, national_id: form.idNumber,
      emergency_contact_name: form.emergName, emergency_contact_phone: form.emergPhone,
      room_id: form.room, check_in_date: form.checkIn || null,
      payment_plan: form.payPlan, notes: form.notes, status: 'ACTIVE'
    });
    setStep(1);
    setForm({ name:"",phone:"",idNumber:"",emergName:"",emergPhone:"",property:defaultProp||"",room:"",rent:0,checkIn:"",payPlan:"Monthly",notes:"" });
    onClose();
  };

  const steps = ["Personal","Room","Tenancy","Confirm"];

  return (
    <div style={{ position:"fixed",inset:0,background:"#000000cc",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div className="pn-modal-inner" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:500,maxHeight:"90vh",overflow:"auto",padding:0,position:"relative",animation:"fadeIn .3s ease" }}>
        <div style={{ display:"flex",borderBottom:`1px solid ${T.border}` }}>
          {steps.map((s,i) => (
            <div key={s} style={{ flex:1,padding:"14px 0",textAlign:"center",fontSize:11,fontWeight:step===i+1?700:400,
              color:step===i+1?T.gold:i+1<step?T.green:T.muted,borderBottom:step===i+1?`2px solid ${T.gold}`:"2px solid transparent",
              background:i+1<step?T.greenDim:"none",transition:"all .2s" }}>
              {i+1}. {s}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ position:"absolute",top:14,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18,zIndex:2 }}>✕</button>
        <div style={{ padding:28 }}>
          {step === 1 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 8px" }}>Personal Details</h3>
              <InputField label="Full Name *" value={form.name} onChange={v=>upd("name",v)} placeholder="Student full name" />
              <InputField label="Phone Number" value={form.phone} onChange={v=>upd("phone",v)} placeholder="+263..." />
              <InputField label="National/Student ID" value={form.idNumber} onChange={v=>upd("idNumber",v)} placeholder="ID Number" />
              <InputField label="Emergency Contact Name" value={form.emergName} onChange={v=>upd("emergName",v)} />
              <InputField label="Emergency Contact Phone" value={form.emergPhone} onChange={v=>upd("emergPhone",v)} />
            </div>
          )}
          {step === 2 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 8px" }}>Room Assignment</h3>
              <SelectField label="Property" value={form.property} onChange={v=>{upd("property",v);upd("room","");}}
                options={[{value:"",label:"— Select property —"},...properties.map(p=>({value:p.name,label:p.name}))]} />
              {form.property && (
                <SelectField label="Room" value={form.room} onChange={v=>{upd("room",v); const rm=selProp?.rooms.find(r=>r.id===v); if(rm) upd("rent",rm.rent);}}
                  options={[{value:"",label:"— Select room —"},...availRooms.map(r=>{
                    const occ=r.students.filter(s=>s.status!=="VACANT"&&s.status!=="VACATED").length;
                    return {value:r.id,label:`${r.no} — ${r.beds-occ} bed(s) free — $${r.rent}/bed`};
                  })]} />
              )}
              {selRoom && <div style={{ fontSize:12,color:T.green,background:T.greenDim,padding:"8px 12px",borderRadius:8 }}>Rent: ${selRoom.rent}/month per bed</div>}
              {form.property && availRooms.length === 0 && <div style={{ fontSize:12,color:T.amber,background:T.amberDim,padding:"8px 12px",borderRadius:8 }}>No vacant beds in this property</div>}
            </div>
          )}
          {step === 3 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 8px" }}>Tenancy Details</h3>
              <InputField label="Check-in Date" value={form.checkIn} onChange={v=>upd("checkIn",v)} type="date" />
              <SelectField label="Payment Plan" value={form.payPlan} onChange={v=>upd("payPlan",v)} options={["Monthly","Semester","Annual"]} />
              <InputField label="Notes" value={form.notes} onChange={v=>upd("notes",v)} placeholder="Optional notes..." />
            </div>
          )}
          {step === 4 && (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 12px" }}>Confirm & Add Student</h3>
              {[["Name",form.name],["Phone",form.phone||"—"],["ID",form.idNumber||"—"],
                ["Property",form.property],["Room",selRoom?.no||"—"],["Rent",`$${form.rent}`],
                ["Check-in",form.checkIn||"—"],["Plan",form.payPlan],["Notes",form.notes||"—"]
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}20` }}>
                  <span style={{ fontSize:12,color:T.muted }}>{k}</span>
                  <span style={{ fontSize:12,color:T.text,fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:24,gap:12 }}>
            {step > 1 ? <Btn accent={T.border} style={{color:T.text}} onClick={()=>setStep(s=>s-1)}>← Back</Btn> : <div/>}
            {step < 4 ? <Btn accent={T.gold} disabled={!canNext} onClick={()=>setStep(s=>s+1)}>Next →</Btn>
              : <Btn accent={T.green} onClick={handleConfirm}>✓ Confirm & Add</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD ROOM MODAL (Admin only)
═══════════════════════════════════════════════════════════ */
export function AddRoomModal({ open, onClose, propertyId, propertyName, commonRent, onAdd }) {
  const [form, setForm] = useState({ number:"", beds:"", rent: commonRent || "", notes:"" });
  const [loading, setLoading] = useState(false);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  if (!open) return null;

  const handleSubmit = async () => {
    setLoading(true);
    await onAdd(propertyId, form.number, Number(form.beds), Number(form.rent), form.notes);
    setForm({ number:"", beds:"", rent: commonRent || "", notes:"" });
    setLoading(false);
    onClose();
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"#000000bb",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div className="pn-modal-inner" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:420,padding:28,position:"relative",animation:"fadeIn .3s ease" }}>
        <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18 }}>✕</button>
        <h3 style={{ margin:"0 0 20px",color:T.text,fontSize:16 }}>Add Room — {propertyName}</h3>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <InputField label="Room Number *" value={form.number} onChange={v=>upd("number",v)} placeholder="e.g. Room 22" />
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <InputField label="Bed Capacity *" value={form.beds} onChange={v=>upd("beds",v)} type="number" placeholder="e.g. 3" />
            <InputField label="Rent Per Bed ($) *" value={form.rent} onChange={v=>upd("rent",v)} type="number" placeholder="e.g. 130" />
          </div>
          <InputField label="Notes" value={form.notes} onChange={v=>upd("notes",v)} placeholder="Optional" />
          <Btn accent={T.green} disabled={!form.number||!form.beds||!form.rent||loading} onClick={handleSubmit}
            style={{ marginTop:4,width:"100%" }}>{loading ? "Adding…" : "Add Room"}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT RECORDING MODAL
═══════════════════════════════════════════════════════════ */
export function PaymentModal({ open, onClose, prop, onRecord, user, allProps }) {
  const [form, setForm] = useState({ student:"",amount:"",method:"Cash",notes:"",receipt:"",date:new Date().toISOString().split("T")[0],property:"" });
  const [done, setDone] = useState(false);
  // TD-6: in-flight guard to prevent duplicate payment submission on double-click.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  if (!open) return null;

  const isGlobal = !prop;
  const activeProp = isGlobal ? allProps?.find(p=>p.name===form.property) : prop;
  const activeAc = activeProp ? (T.prop[activeProp.name] || { accent:T.gold }) : { accent:T.gold };

  const allStudents = activeProp ? activeProp.rooms.flatMap(r => r.students.filter(s=>s.status!=="VACANT"&&s.status!=="VACATED").map(s => ({ ...s, room: r.no, roomId:r.id, roomRent:r.rent }))) : [];
  const outstanding = allStudents.filter(s => s.status !== "PAID");

  // Check if selected date is in a past month
  const selectedDate = new Date(form.date);
  const today = new Date();
  const isBackdated = selectedDate.getFullYear() < today.getFullYear() || 
    (selectedDate.getFullYear() === today.getFullYear() && selectedDate.getMonth() < today.getMonth());
  const backdatedMonth = isBackdated ? formatMonth(form.date) : null;

  const handleSubmit = async () => {
    // TD-6: ignore re-entrant clicks while a submission is already in flight.
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onRecord(activeProp.name, form.student, {
        amount: Number(form.amount), date: form.date, method: form.method,
        receipt: form.receipt, notes: form.notes, recordedBy: user?.email || "system"
      });
      setDone(true);
      setTimeout(() => { onClose(); setDone(false); setIsSubmitting(false); setForm({ student:"",amount:"",method:"Cash",notes:"",receipt:"",date:new Date().toISOString().split("T")[0],property:"" }); }, 1500);
    } catch (err) {
      // onRecord normally surfaces its own errors; release the lock so the user can retry.
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"#000000bb",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div className="pn-modal-inner" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:440,padding:28,position:"relative",animation:"fadeIn .3s ease" }}>
        <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18 }}>✕</button>
        {done ? (
          <div style={{ textAlign:"center",padding:"24px 0" }}>
            <div style={{ fontSize:36,marginBottom:12 }}>✅</div>
            <div style={{ color:T.green,fontWeight:700,fontSize:15 }}>Payment Recorded!</div>
          </div>
        ) : (
          <>
            <h3 style={{ margin:"0 0 20px",color:T.text,fontSize:16 }}>Record Payment{activeProp ? ` — ${activeProp.name}` : ""}</h3>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {isGlobal && <SelectField label="Property" value={form.property} onChange={v=>{upd("property",v);upd("student","");}}
                options={[{value:"",label:"— Select property —"},...(allProps||[]).map(p=>({value:p.name,label:p.name}))]} />}
              <SelectField label="Student" value={form.student} onChange={v=>upd("student",v)}
                options={[{value:"",label:"— Select student —"},
                  ...outstanding.map(s=>({value:s.id,label:`${s.name} (${s.room}) — owes ${fmt(s.roomRent-s.paid)}`})),
                  ...allStudents.filter(s=>s.status==="PAID").map(s=>({value:s.id,label:`${s.name} (${s.room}) ✓`}))
                ]} />
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <InputField label="Amount ($)" value={form.amount} onChange={v=>upd("amount",v)} type="number" placeholder="e.g. 130" />
                <InputField label="Date" value={form.date} onChange={v=>upd("date",v)} type="date" />
              </div>
              {isBackdated && (
                <div style={{ background:T.amberDim,border:`1px solid ${T.amber}40`,borderRadius:8,padding:"10px 12px",fontSize:12,color:T.amber,display:"flex",alignItems:"center",gap:8 }}>
                  <span>⚠</span>
                  <span>Recording payment for <strong>{backdatedMonth}</strong> — historical records will update</span>
                </div>
              )}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <SelectField label="Method" value={form.method} onChange={v=>upd("method",v)}
                  options={["Cash","EcoCash","Bank Transfer","Zipit","Swipe"]} />
                <InputField label="Receipt #" value={form.receipt} onChange={v=>upd("receipt",v)} placeholder="Optional" />
              </div>
              <InputField label="Notes" value={form.notes} onChange={v=>upd("notes",v)} placeholder="Optional note…" />
              <Btn accent={activeAc.accent||T.gold} disabled={!form.student||!form.amount||isSubmitting} onClick={handleSubmit}
                style={{ marginTop:4,width:"100%" }}>{isSubmitting ? "Recording…" : "Confirm Payment"}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENT PROFILE PANEL (slide-in)
═══════════════════════════════════════════════════════════ */
export function StudentProfile({ student, room, propName, onClose, onRecordPay, onRemove, isAdmin, user, refresh, setCoverageCache, setCoverageCacheTimestamp }) {
  if (!student) return null;
  const ac = T.prop[propName] || { accent:T.gold };
  const balance = room.rent - student.paid;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // TD-6: in-flight guard so a double-click on Delete cannot fire deletePayment twice.
  const [isDeleting, setIsDeleting] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);

  // Fetch payment history on mount
  useEffect(() => {
    const fetchPayments = async () => {
      if (!student.id) return;
      setLoadingPayments(true);
      const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
      const { data } = await getPaymentsByStudent(student.id);
      setPaymentHistory(data || []);
      setLoadingPayments(false);
    };
    
    const fetchTransferHistory = async () => {
      if (!student.id) return;
      setLoadingTransfers(true);
      const { data } = await getTransferHistory(student.id);
      setTransferHistory(data || []);
      setLoadingTransfers(false);
    };
    
    fetchPayments();
    fetchTransferHistory();
  }, [student.id]);

  const handleEditPayment = async (paymentId, field, value) => {
    const { updatePayment } = await import('./p1_imports_context.jsx');
    const updates = { [field]: value };
    const { error, rebuildError } = await updatePayment(paymentId, updates, user?.email || 'system');
    if (!error) {
      // Phase 4B.11: Invalidate coverage cache after payment edit
      if (setCoverageCache && setCoverageCacheTimestamp) {
        debug('[Phase4B.11] Invalidating coverage cache after payment edit');
        setCoverageCache(new Map());
        setCoverageCacheTimestamp(Date.now());
      }
      // Refresh payment history
      const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
      const { data } = await getPaymentsByStudent(student.id);
      setPaymentHistory(data || []);
      setEditingPayment(null);
      // Trigger full app refresh to update UI
      if (refresh) refresh();
      // TD-5: surface coverage rebuild failure instead of reporting a clean success
      if (rebuildError) {
        alert('Payment saved, but the coverage update failed. Coverage may be out of date — please use "Repair coverage" or try again.\n\nDetails: ' + (rebuildError.message || 'Unknown error'));
      }
    } else {
      alert('Failed to save payment: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeletePayment = async (paymentId) => {
    // TD-6: ignore re-entrant clicks while a delete is already in flight.
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const { deletePayment } = await import('./p1_imports_context.jsx');
      const { error, rebuildError } = await deletePayment(paymentId);
      if (error) throw error;
      // Phase 4B.3: deletePayment now calls rebuildStudentCoverage automatically
      // Phase 4B.11: Invalidate coverage cache after payment delete
      if (setCoverageCache && setCoverageCacheTimestamp) {
        debug('[Phase4B.11] Invalidating coverage cache after payment delete');
        setCoverageCache(new Map());
        setCoverageCacheTimestamp(Date.now());
      }
      // Refresh payment history
      const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
      const { data } = await getPaymentsByStudent(student.id);
      setPaymentHistory(data || []);
      setConfirmDelete(null);
      // Trigger full app refresh to update UI
      if (refresh) refresh();
      // TD-5: surface coverage rebuild failure instead of reporting a clean success
      if (rebuildError) {
        alert('Payment deleted, but the coverage update failed. Coverage may be out of date — please use "Repair coverage" or try again.\n\nDetails: ' + (rebuildError.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Delete payment failed:', err);
      alert('Failed to delete payment: ' + (err.message || 'Unknown error'));
      setConfirmDelete(null);
    } finally {
      // TD-6: always release the in-flight lock.
      setIsDeleting(false);
    }
  };

  const handlePrintStatement = () => {
    const now = new Date();
    const monthLabel = now.toLocaleString("en-US", { month:"long", year:"numeric" });
    const printDiv = document.createElement('div');
    printDiv.id = 'propnest-statement';
    printDiv.innerHTML = `
      <style>
        @media print { body > *:not(#propnest-statement) { display:none !important; } #propnest-statement { display:block !important; } }
        #propnest-statement { font-family:Arial,sans-serif; color:#222; padding:32px; max-width:600px; margin:0 auto; }
        #propnest-statement table { width:100%; border-collapse:collapse; margin:12px 0; font-size:12px; }
        #propnest-statement th,#propnest-statement td { padding:6px 10px; border:1px solid #ddd; text-align:left; }
        #propnest-statement th { background:#f5f5f5; font-weight:600; }
        #propnest-statement .footer { margin-top:24px; font-size:10px; color:#999; border-top:1px solid #ddd; padding-top:8px; }
      </style>
      <h2 style="margin:0 0 4px">PropNest Property Management</h2>
      <div style="font-size:12px;color:#666;margin-bottom:20px">Tenant Statement — ${monthLabel}</div>
      <table><tbody>
        <tr><th>Tenant</th><td>${student.name}</td></tr>
        <tr><th>Property</th><td>${propName}</td></tr>
        <tr><th>Room</th><td>${room.no}</td></tr>
        <tr><th>Monthly Rent</th><td>$${room.rent}</td></tr>
        <tr><th>Amount Paid</th><td>$${student.paid}</td></tr>
        <tr><th>Balance</th><td style="font-weight:700;color:${balance>0?'#c00':'#090'}">$${balance}</td></tr>
        <tr><th>Status</th><td>${student.status}</td></tr>
        ${student.date ? `<tr><th>Check-in</th><td>${student.date}</td></tr>` : ''}
      </tbody></table>
      ${student.payHistory && student.payHistory.length > 0 ? `
        <h3 style="margin:20px 0 8px;font-size:14px">Payment History</h3>
        <table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt</th></tr></thead>
        <tbody>${student.payHistory.map(p=>`<tr><td>${p.date}</td><td>$${p.amount}</td><td>${p.method}</td><td>${p.receipt||'—'}</td></tr>`).join('')}</tbody></table>
      ` : ''}
      <div class="footer">Generated ${now.toLocaleString()} — PropNest</div>
    `;
    document.body.appendChild(printDiv);
    window.print();
    setTimeout(() => document.body.removeChild(printDiv), 1000);
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:997 }} />
      <div className="pn-profile-panel" style={{ position:"fixed",top:0,right:0,bottom:0,width:420,background:T.card,borderLeft:`1px solid ${T.border}`,
        zIndex:998,padding:28,overflowY:"auto",animation:"slideIn .3s ease",boxShadow:"-4px 0 20px #00000060" }}>
        <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18 }}>✕</button>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11,color:ac.accent,textTransform:"uppercase",letterSpacing:"0.12em" }}>{propName} · {room.no}</div>
          {isAdmin ? (
            <InlineEditField
              value={student.name}
              type="text"
              onSave={async (newValue) => {
                const { updateStudentField } = await import('../services/paymentService.js');
                const result = await updateStudentField(student.id, 'full_name', newValue, user?.email || 'system');
                if (result.success && refresh) refresh();
                return result;
              }}
              style={{ fontSize:20, fontWeight:800, color:T.text, margin:"6px 0" }}
            />
          ) : (
            <h2 style={{ fontSize:20,fontWeight:800,color:T.text,margin:"6px 0" }}>{student.name}</h2>
          )}
          <Badge status={student.status} />
        </div>

        {/* Info grid */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20 }}>
          <div style={{ background:T.bg,borderRadius:10,padding:14 }}>
            <div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>Rent</div>
            <div style={{ fontSize:18,fontWeight:700,color:T.text,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(room.rent)}</div>
          </div>
          <div style={{ background:T.bg,borderRadius:10,padding:14 }}>
            <div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>Balance</div>
            <div style={{ fontSize:18,fontWeight:700,color:balance>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(balance)}</div>
          </div>
        </div>

        {/* Contact & details */}
        <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:20 }}>
          {student.phone ? (
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12 }}>
              <span style={{ color:T.muted }}>Phone</span>
              <InlineEditField
                value={student.phone}
                type="phone"
                onSave={async (newValue) => {
                  const { updateStudentField } = await import('../services/paymentService.js');
                  const result = await updateStudentField(student.id, 'phone', newValue, user?.email || 'system');
                  if (result.success && refresh) refresh();
                  return result;
                }}
                style={{ fontSize:12, color:T.text, minWidth:120 }}
                disabled={!isAdmin}
              />
            </div>
          ) : isAdmin && (
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12 }}>
              <span style={{ color:T.muted }}>Phone</span>
              <InlineEditField
                value=""
                type="phone"
                placeholder="Add phone number"
                onSave={async (newValue) => {
                  const { updateStudentField } = await import('../services/paymentService.js');
                  const result = await updateStudentField(student.id, 'phone', newValue, user?.email || 'system');
                  if (result.success && refresh) refresh();
                  return result;
                }}
                style={{ fontSize:12, color:T.text, minWidth:120 }}
              />
            </div>
          )}
          {student.date ? (
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,marginBottom:4 }}>
                <span style={{ color:T.muted }}>Check-in</span>
                <InlineEditField
                  value={student.date}
                  type="date"
                  onSave={async (newValue) => {
                    const { updateStudentField } = await import('../services/paymentService.js');
                    const result = await updateStudentField(student.id, 'check_in_date', newValue, user?.email || 'system');
                    if (result.success && refresh) refresh();
                    return result;
                  }}
                  style={{ fontSize:12, color:T.text, minWidth:100 }}
                  disabled={!isAdmin}
                />
              </div>
              {(() => {
                const daysToAnniversary = daysUntilAnniversary(student.date);
                return daysToAnniversary !== null && (
                  <div style={{ fontSize:10,color:T.gold,fontWeight:600 }}>
                    📅 Lease anniversary in {daysToAnniversary} days
                  </div>
                );
              })()}
            </div>
          ) : isAdmin && (
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12 }}>
              <span style={{ color:T.muted }}>Check-in</span>
              <InlineEditField
                value=""
                type="date"
                placeholder="Add check-in date"
                onSave={async (newValue) => {
                  const { updateStudentField } = await import('../services/paymentService.js');
                  const result = await updateStudentField(student.id, 'check_in_date', newValue, user?.email || 'system');
                  if (result.success && refresh) refresh();
                  return result;
                }}
                style={{ fontSize:12, color:T.text, minWidth:100 }}
              />
            </div>
          )}
          {student.idNumber ? (
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12 }}>
              <span style={{ color:T.muted }}>ID</span>
              <InlineEditField
                value={student.idNumber}
                type="text"
                onSave={async (newValue) => {
                  const { updateStudentField } = await import('../services/paymentService.js');
                  const result = await updateStudentField(student.id, 'national_id', newValue, user?.email || 'system');
                  if (result.success && refresh) refresh();
                  return result;
                }}
                style={{ fontSize:12, color:T.text, minWidth:120 }}
                disabled={!isAdmin}
              />
            </div>
          ) : isAdmin && (
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12 }}>
              <span style={{ color:T.muted }}>ID</span>
              <InlineEditField
                value=""
                type="text"
                placeholder="Add ID number"
                onSave={async (newValue) => {
                  const { updateStudentField } = await import('../services/paymentService.js');
                  const result = await updateStudentField(student.id, 'national_id', newValue, user?.email || 'system');
                  if (result.success && refresh) refresh();
                  return result;
                }}
                style={{ fontSize:12, color:T.text, minWidth:120 }}
              />
            </div>
          )}
        </div>

        {student.notes ? (
          <div style={{ background:T.amberDim,border:`1px solid ${T.amber}30`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.amber,marginBottom:16 }}>
            📝 {isAdmin ? (
              <InlineEditField
                value={student.notes}
                type="textarea"
                onSave={async (newValue) => {
                  const { updateStudentField } = await import('../services/paymentService.js');
                  const result = await updateStudentField(student.id, 'notes', newValue, user?.email || 'system');
                  if (result.success && refresh) refresh();
                  return result;
                }}
                style={{ fontSize:12, color:T.amber, background:'transparent', border:'none' }}
              />
            ) : student.notes}
          </div>
        ) : isAdmin && (
          <div style={{ background:T.amberDim,border:`1px solid ${T.amber}30`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.amber,marginBottom:16 }}>
            📝 <InlineEditField
              value=""
              type="textarea"
              placeholder="Add notes..."
              onSave={async (newValue) => {
                const { updateStudentField } = await import('../services/paymentService.js');
                const result = await updateStudentField(student.id, 'notes', newValue, user?.email || 'system');
                if (result.success && refresh) refresh();
                return result;
              }}
              style={{ fontSize:12, color:T.amber, background:'transparent', border:'none' }}
            />
          </div>
        )}

        {/* Coverage breakdown — explains how coverage_end / days-remaining was reached.
            Display-only: replays the ledger through the SAME engine the writer uses. */}
        {!loadingPayments && paymentHistory.length > 0 && room?.rent > 0 && (() => {
          const bd = buildCoverageBreakdown(paymentHistory, room.rent);
          if (!bd.chains.length || !bd.coverageEnd) return null;
          const today = new Date(); today.setHours(0,0,0,0);
          const end = new Date(bd.coverageEnd); end.setHours(0,0,0,0);
          const daysLeft = Math.round((end - today) / (1000*60*60*24));
          const remainLabel = daysLeft >= 0 ? `${daysLeft} days remaining` : `${Math.abs(daysLeft)} days overdue`;
          const remainColor = daysLeft > 7 ? T.green : daysLeft >= 0 ? T.gold : T.red;
          // Render each coverage CHAIN as its own block. Previous (expired)
          // chains are dimmed + [lapsed]; the current chain is highlighted.
          // This answers "why is a 2025 payment affecting today?" → it's a
          // separate, expired chain, not part of the current coverage.
          const stepRow = (s, i, dim) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:8,fontSize:12,padding:"3px 0",color: dim ? T.muted : T.text }}>
              <span style={{ color:T.muted,minWidth:96 }}>${s.amount} · {s.dateLabel}</span>
              <span style={{ color: dim ? T.muted : (s.isEarly ? T.blue : T.text), fontWeight:600 }}>
                {s.isEarly ? "+" : ""}{s.days}d
              </span>
              <span style={{ color:T.muted }}>→ {s.endLabel}</span>
              {s.isEarly && !dim && (
                <span style={{ fontSize:10,color:T.blue,background:"rgba(80,130,255,0.12)",borderRadius:4,padding:"1px 6px" }}>
                  early · stacked{s.prepaidDaysPreserved ? ` · kept ${s.prepaidDaysPreserved}d` : ""}
                </span>
              )}
            </div>
          );
          return (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:10 }}>Coverage breakdown</div>

              {/* Previous (expired) chains — dimmed */}
              {bd.chains.filter(c => !c.isCurrent).map((c, ci) => (
                <div key={`prev-${ci}`} style={{ background:T.bg,borderRadius:8,padding:"10px 14px",marginBottom:8,opacity:0.7 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6 }}>
                    <div style={{ fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600 }}>
                      Previous coverage (expired)
                    </div>
                    <span style={{ fontSize:10,color:T.muted,background:"rgba(120,120,120,0.15)",borderRadius:4,padding:"1px 6px" }}>
                      lapsed · {c.startLabel} → {c.endLabel}
                    </span>
                  </div>
                  {c.steps.map((s, i) => stepRow(s, i, true))}
                </div>
              ))}

              {/* Current chain — highlighted */}
              {bd.chains.filter(c => c.isCurrent).map((c, ci) => (
                <div key={`cur-${ci}`} style={{ background:T.bg,borderRadius:8,padding:"12px 14px",border:`1px solid ${remainColor}33` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8 }}>
                    <div style={{ fontSize:11,color:ac.accent,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700 }}>
                      Current coverage chain
                    </div>
                    <div style={{ fontSize:12,fontWeight:700,color:remainColor }}>{remainLabel}</div>
                  </div>
                  {c.steps.map((s, i) => stepRow(s, i, false))}
                  <div style={{ borderTop:`1px solid ${T.border}`,marginTop:8,paddingTop:8,fontSize:12,color:T.muted }}>
                    Covered <span style={{ color:T.text,fontWeight:600 }}>{c.startLabel} → {c.endLabel}</span>
                    <span> · {c.days} days in this chain</span>
                    {bd.chains.length > 1 && <span> · {bd.totalDays} days paid all-time</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Payment timeline */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontSize:13,fontWeight:700,color:T.text }}>Payment History</div>
            {(() => {
              const lastPayment = paymentHistory[0];
              if (lastPayment) {
                const days = daysSince(lastPayment.payment_date || lastPayment.date);
                const color = daysColor(days);
                return (
                  <div style={{ fontSize:11,color,fontWeight:600 }}>
                    Last paid {days} days ago
                  </div>
                );
              }
              return null;
            })()}
          </div>
          {loadingPayments ? (
            <div style={{ color:T.muted,fontSize:12,fontStyle:"italic" }}>Loading payments...</div>
          ) : paymentHistory.length === 0 ? (
            <div style={{ color:T.muted,fontSize:12,fontStyle:"italic" }}>No payments recorded</div>
          ) : (
            <>
              {(() => {
                // Group payments by month
                const grouped = {};
                paymentHistory.forEach(p => {
                  const date = new Date(p.payment_date);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  if (!grouped[monthKey]) {
                    grouped[monthKey] = {
                      label: formatMonth(p.payment_date),
                      payments: []
                    };
                  }
                  grouped[monthKey].payments.push(p);
                });

                // Sort months descending (most recent first)
                const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

                return sortedMonths.map(monthKey => {
                  const group = grouped[monthKey];
                  const monthTotal = group.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                  
                  return (
                    <div key={monthKey} style={{ marginBottom: 16 }}>
                      {/* Month header */}
                      <div style={{ 
                        background: T.bg, 
                        borderRadius: 8, 
                        padding: "8px 12px", 
                        marginBottom: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{group.label}</div>
                        <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>{fmt(monthTotal)}</div>
                      </div>

                      {/* Payments in this month */}
                      {group.payments.map((p) => (
                        <div key={p.id} style={{ borderLeft:`2px solid ${ac.accent}`,paddingLeft:12,marginBottom:12,position:"relative" }}>
                          {editingPayment === p.id ? (
                            <EditPaymentInline 
                              payment={p} 
                              onSave={async (updated) => {
                                try {
                                  const { updatePayment } = await import('./p1_imports_context.jsx');
                                  const { error: updateError, rebuildError } = await updatePayment(p.id, updated, user?.email || 'system');
                                  if (updateError) throw updateError;
                                  // Phase 4B.3: updatePayment now calls rebuildStudentCoverage automatically
                                  // Phase 4B.11: Invalidate coverage cache after payment edit
                                  if (setCoverageCache && setCoverageCacheTimestamp) {
                                    setCoverageCache(new Map());
                                    setCoverageCacheTimestamp(Date.now());
                                  }
                                  // Refresh payment history
                                  const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
                                  const { data } = await getPaymentsByStudent(student.id);
                                  setPaymentHistory(data || []);
                                  setEditingPayment(null);
                                  // Trigger full app refresh to update UI
                                  if (refresh) refresh();
                                  // TD-5: surface coverage rebuild failure instead of reporting clean success
                                  if (rebuildError) {
                                    alert('Payment saved, but the coverage update failed. Coverage may be out of date — please use "Repair coverage" or try again.\n\nDetails: ' + (rebuildError.message || 'Unknown error'));
                                  }
                                } catch (err) {
                                  console.error('Edit payment failed:', err);
                                  alert('Failed to save payment: ' + (err.message || 'Unknown error'));
                                }
                              }}
                              onCancel={() => setEditingPayment(null)}
                            />
                          ) : confirmDelete === p.id ? (
                            <div style={{ background:T.redDim,border:`1px solid ${T.red}40`,borderRadius:8,padding:10 }}>
                              <div style={{ fontSize:12,color:T.red,fontWeight:600,marginBottom:8 }}>Delete payment of {fmt(p.amount)}?</div>
                              <div style={{ display:"flex",gap:6 }}>
                                <button onClick={()=>setConfirmDelete(null)} disabled={isDeleting} style={{ flex:1,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",color:T.text,fontSize:11,cursor:isDeleting?"not-allowed":"pointer",fontFamily:font }}>Cancel</button>
                                <button onClick={()=>handleDeletePayment(p.id)} disabled={isDeleting} style={{ flex:1,background:isDeleting?T.border:T.red,border:"none",borderRadius:6,padding:"4px 8px",color:isDeleting?T.muted:"#fff",fontSize:11,fontWeight:600,cursor:isDeleting?"not-allowed":"pointer",fontFamily:font }}>{isDeleting?"Deleting…":"Delete"}</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                                <span style={{ fontSize:13,fontWeight:700,color:T.green }}>
                                  {isAdmin ? (
                                    <InlineEditField
                                      value={p.amount}
                                      type="number"
                                      onSave={async (newValue) => {
                                        try {
                                          const { updatePayment } = await import('./p1_imports_context.jsx');
                                          const { error: updateError, rebuildError } = await updatePayment(p.id, { amount: Number(newValue) }, user?.email || 'system');
                                          if (updateError) throw updateError;
                                          // Phase 4B.3: updatePayment now calls rebuildStudentCoverage automatically
                                          // Phase 4B.11: Invalidate coverage cache after payment edit
                                          if (setCoverageCache && setCoverageCacheTimestamp) {
                                            setCoverageCache(new Map());
                                            setCoverageCacheTimestamp(Date.now());
                                          }
                                          const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
                                          const { data } = await getPaymentsByStudent(student.id);
                                          setPaymentHistory(data || []);
                                          if (refresh) refresh();
                                          // TD-5: value saved; warn if coverage rebuild failed (do not revert the saved value)
                                          if (rebuildError) {
                                            alert('Amount saved, but the coverage update failed. Coverage may be out of date — please use "Repair coverage" or try again.\n\nDetails: ' + (rebuildError.message || 'Unknown error'));
                                          }
                                          return { success: true };
                                        } catch (err) {
                                          return { success: false, error: err.message };
                                        }
                                      }}
                                      style={{ fontSize:13, fontWeight:700, color:T.green }}
                                    />
                                  ) : (
                                    fmt(p.amount)
                                  )}
                                </span>
                                <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                                  <span style={{ fontSize:11,color:T.muted }}>
                                    {isAdmin ? (
                                      <InlineEditField
                                        value={p.payment_date ? p.payment_date.split('T')[0] : ''}
                                        type="date"
                                        onSave={async (newValue) => {
                                          try {
                                            const { updatePayment } = await import('./p1_imports_context.jsx');
                                            const { error: updateError, rebuildError } = await updatePayment(p.id, { payment_date: newValue }, user?.email || 'system');
                                            if (updateError) throw updateError;
                                            // Phase 4B.3: updatePayment now calls rebuildStudentCoverage automatically
                                            // Phase 4B.11: Invalidate coverage cache after payment edit
                                            if (setCoverageCache && setCoverageCacheTimestamp) {
                                              setCoverageCache(new Map());
                                              setCoverageCacheTimestamp(Date.now());
                                            }
                                            const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
                                            const { data } = await getPaymentsByStudent(student.id);
                                            setPaymentHistory(data || []);
                                            if (refresh) refresh();
                                            // TD-5: value saved; warn if coverage rebuild failed (do not revert the saved value)
                                            if (rebuildError) {
                                              alert('Date saved, but the coverage update failed. Coverage may be out of date — please use "Repair coverage" or try again.\n\nDetails: ' + (rebuildError.message || 'Unknown error'));
                                            }
                                            return { success: true };
                                          } catch (err) {
                                            return { success: false, error: err.message };
                                          }
                                        }}
                                        style={{ fontSize:11, color:T.muted }}
                                      />
                                    ) : (
                                      new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                    )}
                                  </span>
                                  {isAdmin && (
                                    <div style={{ display:"flex",gap:4 }}>
                                      <button onClick={()=>setEditingPayment(p.id)} style={{ background:"none",border:"none",cursor:"pointer",color:T.blue,fontSize:12,padding:2 }} title="Edit">✏️</button>
                                      <button onClick={()=>setConfirmDelete(p.id)} style={{ background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:12,padding:2 }} title="Delete">🗑️</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize:11,color:T.subtle }}>
                                {isAdmin ? (
                                  <InlineEditField
                                    value={p.payment_method}
                                    type="select"
                                    options={[
                                      { value: 'Cash', label: 'Cash' },
                                      { value: 'EcoCash', label: 'EcoCash' },
                                      { value: 'Bank Transfer', label: 'Bank Transfer' },
                                      { value: 'Zipit', label: 'Zipit' },
                                      { value: 'Swipe', label: 'Swipe' }
                                    ]}
                                    onSave={async (newValue) => {
                                      try {
                                        const { updatePayment } = await import('./p1_imports_context.jsx');
                                        const { error: updateError } = await updatePayment(p.id, { payment_method: newValue }, user?.email || 'system');
                                        if (updateError) throw updateError;
                                        const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
                                        const { data } = await getPaymentsByStudent(student.id);
                                        setPaymentHistory(data || []);
                                        return { success: true };
                                      } catch (err) {
                                        return { success: false, error: err.message };
                                      }
                                    }}
                                    style={{ fontSize:11, color:T.subtle, display:'inline' }}
                                  />
                                ) : (
                                  p.payment_method
                                )}
                                {p.receipt_number && (
                                  <>
                                    {' · #'}
                                    {isAdmin ? (
                                      <InlineEditField
                                        value={p.receipt_number}
                                        type="text"
                                        onSave={async (newValue) => {
                                          try {
                                            const { updatePayment } = await import('./p1_imports_context.jsx');
                                            const { error: updateError } = await updatePayment(p.id, { receipt_number: newValue }, user?.email || 'system');
                                            if (updateError) throw updateError;
                                            const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
                                            const { data } = await getPaymentsByStudent(student.id);
                                            setPaymentHistory(data || []);
                                            return { success: true };
                                          } catch (err) {
                                            return { success: false, error: err.message };
                                          }
                                        }}
                                        style={{ fontSize:11, color:T.subtle, display:'inline' }}
                                      />
                                    ) : (
                                      p.receipt_number
                                    )}
                                  </>
                                )}
                              </div>
                              {p.notes && (
                                <div style={{ fontSize:11,color:T.muted,fontStyle:"italic" }}>
                                  {isAdmin ? (
                                    <InlineEditField
                                      value={p.notes}
                                      type="text"
                                      onSave={async (newValue) => {
                                        try {
                                          const { updatePayment } = await import('./p1_imports_context.jsx');
                                          const { error: updateError } = await updatePayment(p.id, { notes: newValue }, user?.email || 'system');
                                          if (updateError) throw updateError;
                                          const { getPaymentsByStudent } = await import('./p1_imports_context.jsx');
                                          const { data } = await getPaymentsByStudent(student.id);
                                          setPaymentHistory(data || []);
                                          return { success: true };
                                        } catch (err) {
                                          return { success: false, error: err.message };
                                        }
                                      }}
                                      style={{ fontSize:11, color:T.muted, fontStyle:'italic' }}
                                    />
                                  ) : (
                                    p.notes
                                  )}
                                </div>
                              )}
                              <div style={{ fontSize:10,color:T.muted }}>by {p.recorded_by}</div>
                              {p.edited_by && <div style={{ fontSize:10,color:T.amber }}>edited by {p.edited_by}</div>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
              <div style={{ fontSize:11,color:T.muted,marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}30` }}>
                Total paid all time: {fmt(paymentHistory.reduce((sum,p)=>sum+(p.amount||0),0))} across {paymentHistory.length} payment{paymentHistory.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>

        {/* Transfer History */}
        {transferHistory.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>Transfer History</div>
            {transferHistory.map((transfer) => (
              <div key={transfer.id} style={{ borderLeft:`2px solid ${T.blue}`,paddingLeft:12,marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <span style={{ fontSize:12,fontWeight:600,color:T.text }}>
                    {transfer.fromPropertyName} {transfer.fromRoomNumber} → {transfer.toPropertyName} {transfer.toRoomNumber}
                  </span>
                  <span style={{ fontSize:11,color:T.muted }}>
                    {new Date(transfer.transferDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {transfer.reason && <div style={{ fontSize:11,color:T.muted,fontStyle:"italic" }}>{transfer.reason}</div>}
                <div style={{ fontSize:10,color:T.muted }}>by {transfer.performedByName || transfer.performedBy}</div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons — all staff actions */}
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          <Btn accent={ac.accent} onClick={onRecordPay} style={{ width:"100%" }}>+ Record Payment</Btn>
          {isAdmin && (
            <Btn accent={T.blue} onClick={() => setShowTransferModal(true)} style={{ width:"100%", color:"#fff" }}>
              🔄 Transfer Room
            </Btn>
          )}
          <div style={{ display:"flex",gap:8 }}>
            <Btn accent={T.blue} onClick={handlePrintStatement} style={{ width:"100%",fontSize:12,color:"#fff" }}>
              🖨 Print Statement
            </Btn>
          </div>
          {isAdmin && !confirmRemove && (
            <Btn accent={T.red} onClick={()=>setConfirmRemove(true)} style={{ width:"100%",background:T.redDim,color:T.red,border:`1px solid ${T.red}40` }}>
              Remove Student
            </Btn>
          )}
          {isAdmin && confirmRemove && (
            <div style={{ background:T.redDim,border:`1px solid ${T.red}40`,borderRadius:10,padding:16,textAlign:"center" }}>
              <div style={{ fontSize:13,color:T.red,fontWeight:600,marginBottom:12 }}>Remove {student.name} from {room.no}?</div>
              <div style={{ fontSize:11,color:T.muted,marginBottom:12 }}>Payment history is preserved.</div>
              <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
                <Btn accent={T.border} style={{color:T.text}} onClick={()=>setConfirmRemove(false)}>Cancel</Btn>
                <Btn accent={T.red} onClick={()=>{onRemove(student.id);onClose();}}>Confirm Remove</Btn>
              </div>
            </div>
          )}
        </div>
        
        {/* Transfer Modal */}
        {showTransferModal && (
          <TransferModal 
            open={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            student={student}
            currentRoom={room}
            currentProperty={propName}
            user={user}
            onTransferComplete={() => {
              setShowTransferModal(false);
              if (refresh) refresh();
            }}
          />
        )}
      </div>
    </>
  );
}


/* ═══════════════════════════════════════════════════════════
   EDIT PAYMENT INLINE (for StudentProfile)
═══════════════════════════════════════════════════════════ */
function EditPaymentInline({ payment, onSave, onCancel }) {
  const [amount, setAmount] = useState(payment.amount);
  const [method, setMethod] = useState(payment.payment_method || 'Cash');
  const [receipt, setReceipt] = useState(payment.receipt_number || '');
  const [notes, setNotes] = useState(payment.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ amount: Number(amount), payment_method: method, receipt_number: receipt, notes });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 12, color: T.blue, fontWeight: 600, marginBottom: 8 }}>Edit Payment</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input 
          type="number" 
          value={amount} 
          onChange={e => setAmount(e.target.value)}
          style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: font }}
          placeholder="Amount"
        />
        <select 
          value={method} 
          onChange={e => setMethod(e.target.value)}
          style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: font }}>
          <option>Cash</option>
          <option>EcoCash</option>
          <option>Bank Transfer</option>
          <option>Zipit</option>
          <option>Swipe</option>
        </select>
        <input 
          type="text" 
          value={receipt} 
          onChange={e => setReceipt(e.target.value)}
          style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: font }}
          placeholder="Receipt #"
        />
        <input 
          type="text" 
          value={notes} 
          onChange={e => setNotes(e.target.value)}
          style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: font }}
          placeholder="Notes"
        />
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", color: T.text, fontSize: 11, cursor: saving ? "not-allowed" : "pointer", fontFamily: font }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: saving ? T.border : T.blue, border: "none", borderRadius: 6, padding: "6px 8px", color: saving ? T.muted : "#fff", fontSize: 11, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: font }}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   TRANSFER MODAL (Multi-step room transfer)
═══════════════════════════════════════════════════════════ */
function TransferModal({ open, onClose, student, currentRoom, currentProperty, user, onTransferComplete }) {
  const [step, setStep] = useState(1);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [reason, setReason] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Fetch properties on mount
  useEffect(() => {
    const fetchProperties = async () => {
      if (!open) return;
      setLoading(true);
      try {
        // Try without is_active filter first, then add it if column exists
        const { data, error } = await supabase
          .from('properties')
          .select('id, name')
          .order('name');
        
        if (error) {
          console.error('Error fetching properties:', error);
          // Try alternative query without is_active
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('properties')
            .select('*')
            .order('name');
          
          if (!fallbackError) {
            debug('Fetched properties (fallback):', fallbackData);
            setProperties(fallbackData || []);
          }
        } else {
          debug('Fetched properties:', data);
          setProperties(data || []);
        }
      } catch (err) {
        console.error('Exception fetching properties:', err);
      }
      setLoading(false);
    };
    
    fetchProperties();
  }, [open]);

  // Fetch available rooms when property is selected
  useEffect(() => {
    const fetchRooms = async () => {
      if (!selectedProperty) {
        setAvailableRooms([]);
        return;
      }
      
      setLoading(true);
      try {
        const property = properties.find(p => p.name === selectedProperty);
        if (property) {
          // For same-property transfers, pass student ID to exclude from occupancy count
          const excludeStudentId = selectedProperty === currentProperty ? student.id : null;
          const { data } = await getAvailableRooms(property.id, excludeStudentId);
          // For same-property transfers, exclude the current room
          const filteredRooms = selectedProperty === currentProperty 
            ? (data || []).filter(room => room.id !== currentRoom.id)
            : (data || []);
          setAvailableRooms(filteredRooms);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
      }
      setLoading(false);
    };
    
    fetchRooms();
  }, [selectedProperty, properties, currentProperty, currentRoom.id]);

  const handleTransfer = async () => {
    if (!selectedRoom || !student.id) return;
    
    setTransferring(true);
    try {
      const transferRequest = {
        studentId: student.id,
        fromRoomId: currentRoom.id,
        toRoomId: selectedRoom,
        transferDate: new Date().toISOString().split('T')[0],
        reason: reason.trim() || null,
        performedBy: user?.id || null
      };
      
      const result = await executeTransfer(transferRequest);
      
      if (result.success) {
        onTransferComplete();
      } else {
        alert('Transfer failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Transfer error:', err);
      alert('Transfer failed: ' + (err.message || 'Unknown error'));
    }
    setTransferring(false);
  };

  if (!open) return null;

  const selectedRoomData = availableRooms.find(r => r.id === selectedRoom);
  const steps = ["Property", "Room", "Confirm"];
  const canNext = step === 1 ? selectedProperty : step === 2 ? selectedRoom : true;

  return (
    <div style={{ position:"fixed",inset:0,background:"#000000cc",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div className="pn-modal-inner" style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:500,maxHeight:"90vh",overflow:"auto",padding:0,position:"relative",animation:"fadeIn .3s ease" }}>
        <div style={{ display:"flex",borderBottom:`1px solid ${T.border}` }}>
          {steps.map((s,i) => (
            <div key={s} style={{ flex:1,padding:"14px 0",textAlign:"center",fontSize:11,fontWeight:step===i+1?700:400,
              color:step===i+1?T.blue:i+1<step?T.green:T.muted,borderBottom:step===i+1?`2px solid ${T.blue}`:"2px solid transparent",
              background:i+1<step?T.greenDim:"none",transition:"all .2s" }}>
              {i+1}. {s}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ position:"absolute",top:14,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18,zIndex:2 }}>✕</button>
        <div style={{ padding:28 }}>
          <h3 style={{ color:T.text,fontSize:16,margin:"0 0 8px" }}>Transfer {student.name}</h3>
          <div style={{ fontSize:12,color:T.muted,marginBottom:20 }}>
            Current: {currentProperty} · {currentRoom.no}
          </div>

          {step === 1 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:8 }}>Select Target Property</div>
              {loading ? (
                <div style={{ color:T.muted,fontSize:12,fontStyle:"italic" }}>Loading properties...</div>
              ) : properties.length === 0 ? (
                <div style={{ color:T.red,fontSize:12,background:T.redDim,padding:"8px 12px",borderRadius:8 }}>
                  No properties found. Check database connection.
                </div>
              ) : (
                <>
                  <div style={{ fontSize:11,color:T.muted,marginBottom:4 }}>
                    Found {properties.length} properties
                  </div>
                  <SelectField 
                    label="Property" 
                    value={selectedProperty} 
                    onChange={v => {setSelectedProperty(v); setSelectedRoom('');}}
                    options={[
                      {value:"",label:"— Select property —"},
                      {value:currentProperty,label:`${currentProperty} (same property)`},
                      ...properties.filter(p => p.name !== currentProperty).map(p => ({value:p.name,label:p.name}))
                    ]} 
                  />
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:8 }}>Select Target Room</div>
              <div style={{ fontSize:12,color:T.muted,marginBottom:12 }}>
                Property: {selectedProperty}
              </div>
              {loading ? (
                <div style={{ color:T.muted,fontSize:12,fontStyle:"italic" }}>Loading rooms...</div>
              ) : availableRooms.length === 0 ? (
                <div style={{ color:T.amber,fontSize:12,background:T.amberDim,padding:"8px 12px",borderRadius:8 }}>
                  No available rooms in {selectedProperty}
                </div>
              ) : (
                <SelectField 
                  label="Room" 
                  value={selectedRoom} 
                  onChange={setSelectedRoom}
                  options={[
                    {value:"",label:"— Select room —"},
                    ...availableRooms.map(r => ({
                      value: r.id,
                      label: `${r.roomNumber} — ${r.availableBeds} bed(s) free — $${r.rentPerBed}/bed`
                    }))
                  ]} 
                />
              )}
              <InputField 
                label="Reason (optional)" 
                value={reason} 
                onChange={setReason}
                placeholder="e.g. Student request, maintenance, etc."
              />
            </div>
          )}

          {step === 3 && (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:12 }}>Confirm Transfer</div>
              {[
                ["Student", student.name],
                ["From", `${currentProperty} · ${currentRoom.no}`],
                ["To", `${selectedProperty} · ${selectedRoomData?.roomNumber}`],
                ["New Rent", `$${selectedRoomData?.rentPerBed}/month`],
                ["Reason", reason || "—"]
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}20` }}>
                  <span style={{ fontSize:12,color:T.muted }}>{k}</span>
                  <span style={{ fontSize:12,color:T.text,fontWeight:600 }}>{v}</span>
                </div>
              ))}
              {selectedRoomData && selectedRoomData.rentPerBed !== currentRoom.rent && (
                <div style={{ background:T.amberDim,border:`1px solid ${T.amber}40`,borderRadius:8,padding:"10px 12px",fontSize:12,color:T.amber,marginTop:8 }}>
                  ⚠ Rent will change from ${currentRoom.rent} to ${selectedRoomData.rentPerBed} — current month obligation will be updated
                </div>
              )}
            </div>
          )}

          <div style={{ display:"flex",justifyContent:"space-between",marginTop:24,gap:12 }}>
            {step > 1 ? <Btn accent={T.border} style={{color:T.text}} onClick={()=>setStep(s=>s-1)}>← Back</Btn> : <div/>}
            {step < 3 ? <Btn accent={T.blue} disabled={!canNext || loading} onClick={()=>setStep(s=>s+1)}>Next →</Btn>
              : <Btn accent={T.green} disabled={transferring} onClick={handleTransfer}>
                  {transferring ? "Transferring..." : "✓ Confirm Transfer"}
                </Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}