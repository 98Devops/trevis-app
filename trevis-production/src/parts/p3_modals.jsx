import { useState } from "react";
import { T, font, Badge, InputField, SelectField, Btn, fmt } from "./p2_helpers.jsx";

/* ═══════════════════════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════════════════════ */
export function LoginScreen({ onLogin, isConfigured }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    if (!isConfigured) {
      // Demo mode fallback
      const demoUsers = [
        { email:"admin@trevis.co.zw", password:"admin1234", role:"ADMIN", full_name:"Admin" },
        { email:"manager@trevis.co.zw", password:"manager1234", role:"MANAGER", full_name:"Manager" },
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

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:font }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:40, width:400, animation:"fadeIn .4s ease" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:32, fontWeight:800, color:T.gold, letterSpacing:"-0.02em" }}>Trevis</div>
          <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.15em", marginTop:4 }}>Property Manager</div>
        </div>
        {!isConfigured && (
          <div style={{ background:T.amberDim, border:`1px solid ${T.amber}30`, borderRadius:8, padding:"8px 12px", fontSize:11, color:T.amber, marginBottom:16, textAlign:"center" }}>
            ⚠ Demo Mode — Connect Supabase for production
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <InputField label="Email" value={email} onChange={v=>{setEmail(v);setErr("");}} type="email" placeholder="admin@trevis.co.zw" />
          <InputField label="Password" value={pass} onChange={v=>{setPass(v);setErr("");}} type="password" placeholder="••••••••" />
          {err && <div style={{ color:T.red, fontSize:12, background:T.redDim, padding:"8px 12px", borderRadius:8 }}>{err}</div>}
          <Btn accent={T.gold} disabled={loading} style={{ marginTop:8, width:"100%", padding:12, fontSize:14 }}>
            {loading ? "Signing in…" : "Sign In"}
          </Btn>
        </form>
        <div style={{ fontSize:10, color:T.muted, textAlign:"center", marginTop:20, lineHeight:1.6 }}>
          {isConfigured ? "Use your Trevis credentials" : "Demo: admin@trevis.co.zw / admin1234"}
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
          Trevis needs a Supabase backend to run in production mode.<br/>
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
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  if (!open) return null;

  const isGlobal = !prop;
  const activeProp = isGlobal ? allProps?.find(p=>p.name===form.property) : prop;
  const activeAc = activeProp ? (T.prop[activeProp.name] || { accent:T.gold }) : { accent:T.gold };

  const allStudents = activeProp ? activeProp.rooms.flatMap(r => r.students.filter(s=>s.status!=="VACANT"&&s.status!=="VACATED").map(s => ({ ...s, room: r.no, roomId:r.id, roomRent:r.rent }))) : [];
  const outstanding = allStudents.filter(s => s.status !== "PAID");

  const handleSubmit = async () => {
    await onRecord(activeProp.name, form.student, {
      amount: Number(form.amount), date: form.date, method: form.method,
      receipt: form.receipt, notes: form.notes, recordedBy: user?.email || "system"
    });
    setDone(true);
    setTimeout(() => { onClose(); setDone(false); setForm({ student:"",amount:"",method:"Cash",notes:"",receipt:"",date:new Date().toISOString().split("T")[0],property:"" }); }, 1500);
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
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <SelectField label="Method" value={form.method} onChange={v=>upd("method",v)}
                  options={["Cash","EcoCash","Bank Transfer","Zipit","Swipe"]} />
                <InputField label="Receipt #" value={form.receipt} onChange={v=>upd("receipt",v)} placeholder="Optional" />
              </div>
              <InputField label="Notes" value={form.notes} onChange={v=>upd("notes",v)} placeholder="Optional note…" />
              <Btn accent={activeAc.accent||T.gold} disabled={!form.student||!form.amount} onClick={handleSubmit}
                style={{ marginTop:4,width:"100%" }}>Confirm Payment</Btn>
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
export function StudentProfile({ student, room, propName, onClose, onRecordPay, onRemove, isAdmin }) {
  if (!student) return null;
  const ac = T.prop[propName] || { accent:T.gold };
  const balance = room.rent - student.paid;
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div className="pn-profile-panel" style={{ position:"fixed",top:0,right:0,bottom:0,width:420,background:T.card,borderLeft:`1px solid ${T.border}`,
      zIndex:998,padding:28,overflowY:"auto",animation:"slideIn .3s ease",boxShadow:"-4px 0 20px #00000060" }}>
      <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18 }}>✕</button>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11,color:ac.accent,textTransform:"uppercase",letterSpacing:"0.12em" }}>{propName} · {room.no}</div>
        <h2 style={{ fontSize:20,fontWeight:800,color:T.text,margin:"6px 0" }}>{student.name}</h2>
        <Badge status={student.status} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24 }}>
        <div style={{ background:T.bg,borderRadius:10,padding:14 }}>
          <div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>Rent</div>
          <div style={{ fontSize:18,fontWeight:700,color:T.text,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(room.rent)}</div>
        </div>
        <div style={{ background:T.bg,borderRadius:10,padding:14 }}>
          <div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>Balance</div>
          <div style={{ fontSize:18,fontWeight:700,color:balance>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(balance)}</div>
        </div>
      </div>
      {student.notes && <div style={{ background:T.amberDim,border:`1px solid ${T.amber}30`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.amber,marginBottom:16 }}>📝 {student.notes}</div>}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>Payment History</div>
        {(!student.payHistory || student.payHistory.length === 0) ? (
          <div style={{ color:T.muted,fontSize:12,fontStyle:"italic" }}>No payment history recorded yet</div>
        ) : student.payHistory.map((p,i) => (
          <div key={i} style={{ borderLeft:`2px solid ${ac.accent}`,paddingLeft:12,marginBottom:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ fontSize:13,fontWeight:700,color:T.green }}>{fmt(p.amount)}</span>
              <span style={{ fontSize:11,color:T.muted }}>{p.date}</span>
            </div>
            <div style={{ fontSize:11,color:T.subtle }}>{p.method}{p.receipt ? ` · #${p.receipt}` : ""}</div>
            {p.notes && <div style={{ fontSize:11,color:T.muted,fontStyle:"italic" }}>{p.notes}</div>}
            <div style={{ fontSize:10,color:T.muted }}>by {p.recordedBy}</div>
          </div>
        ))}
      </div>
      <Btn accent={ac.accent} onClick={onRecordPay} style={{ width:"100%", marginBottom:12 }}>+ Record Payment</Btn>
      {isAdmin && !confirmRemove && (
        <Btn accent={T.red} onClick={()=>setConfirmRemove(true)} style={{ width:"100%",background:T.redDim,color:T.red,border:`1px solid ${T.red}40` }}>
          Remove Student
        </Btn>
      )}
      {isAdmin && confirmRemove && (
        <div style={{ background:T.redDim,border:`1px solid ${T.red}40`,borderRadius:10,padding:16,textAlign:"center" }}>
          <div style={{ fontSize:13,color:T.red,fontWeight:600,marginBottom:12 }}>Remove {student.name} from {room.no}?</div>
          <div style={{ fontSize:11,color:T.muted,marginBottom:12 }}>This will not delete their payment history.</div>
          <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
            <Btn accent={T.border} style={{color:T.text}} onClick={()=>setConfirmRemove(false)}>Cancel</Btn>
            <Btn accent={T.red} onClick={()=>{onRemove(student.id);onClose();}}>Confirm Remove</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
