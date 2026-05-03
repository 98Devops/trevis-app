
/* ═══════════════════════════════════════════════════════════
   PROPERTY DETAIL VIEW
═══════════════════════════════════════════════════════════ */
function PropertyDetail({ name, props, onBack, onOpenPay, onAddStudent, onStudentClick }) {
  const prop = props.find(p => p.name === name);
  const ac = T.prop[name];
  const [search, setSearch] = useState("");
  const pct = prop.expected > 0 ? ((prop.collected / prop.expected)*100).toFixed(1) : "0.0";
  const filtered = prop.rooms.filter(r =>
    !search || r.no.toLowerCase().includes(search.toLowerCase()) ||
    r.students.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div>
      <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:13,padding:0,marginBottom:20,display:"flex",alignItems:"center",gap:6 }}>← Back to Dashboard</button>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11,color:ac.accent,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600 }}>{prop.location}</div>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:"4px 0 0" }}>{prop.name}</h1>
        </div>
        <div style={{ display:"flex",gap:10 }}>
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
        {filtered.map(room => <RoomRow key={room.id} room={room} ac={ac} propName={name} onStudentClick={onStudentClick} />)}
      </div>
    </div>
  );
}

function RoomRow({ room, ac, propName, onStudentClick }) {
  const [open, setOpen] = useState(false);
  const real = room.students.filter(s=>s.status!=="VACANT");
  const paid = real.filter(s=>s.status==="PAID").length;
  const issues = real.filter(s=>s.status!=="PAID").length;
  const pct = real.length > 0 ? Math.round((paid/real.length)*100) : 0;
  const vacant = room.beds - real.length;
  return (
    <div style={{ background:T.card,border:`1px solid ${open?ac.accent+"60":T.border}`,borderRadius:12,overflow:"hidden",transition:"border .2s" }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"14px 20px",cursor:"pointer",display:"grid",
        gridTemplateColumns:"1fr auto auto auto auto auto",gap:12,alignItems:"center" }}>
        <div>
          <span style={{ fontSize:14,fontWeight:700,color:T.text }}>{room.no}</span>
          <span style={{ fontSize:11,color:T.muted,marginLeft:10 }}>{real.length}/{room.beds} beds · ${room.rent}/bed</span>
        </div>
        <div style={{ fontSize:11,color:T.green }}>{paid} paid</div>
        {issues>0 && <div style={{ background:T.redDim,color:T.red,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{issues} ⚠</div>}
        {vacant>0 && <div style={{ background:T.amberDim,color:T.amber,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{vacant} vacant</div>}
        <div style={{ width:80 }}><Bar pct={pct} color={ac.accent} /></div>
        <span style={{ color:T.muted,fontSize:13 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${T.border}` }}>
          {room.students.map(s => (
            <div key={s.id} onClick={()=>s.status!=="VACANT"&&onStudentClick&&onStudentClick(s,room,propName)}
              style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,padding:"10px 20px",
                borderBottom:`1px solid ${T.border}20`,alignItems:"center",cursor:s.status!=="VACANT"?"pointer":"default",transition:"background .15s" }}
              onMouseEnter={e=>{if(s.status!=="VACANT")e.currentTarget.style.background=T.hover}}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ fontSize:13,color:s.status==="VACANT"?T.muted:T.text,fontWeight:s.status==="VACANT"?400:600,fontStyle:s.status==="VACANT"?"italic":"normal" }}>{s.name}</div>
              <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{s.status==="VACANT"?"\u2014":`$${s.paid} paid`}</div>
              <div style={{ fontSize:11,color:T.muted }}>{s.date||"\u2014"}</div>
              <Badge status={s.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENTS GLOBAL LIST
═══════════════════════════════════════════════════════════ */
function Students({ props, onAddStudent }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const all = useMemo(() => props.flatMap(p =>
    p.rooms.flatMap(r => r.students.filter(s=>s.status!=="VACANT").map(s => ({ ...s, property:p.name, room:r.no, rent:r.rent })))
  ), [props]);
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
          <div style={{ fontSize:13,color:T.muted,marginTop:4 }}>{all.length} students across 4 properties</div>
        </div>
        <Btn accent={T.gold} onClick={onAddStudent}>+ Add Student</Btn>
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
            {f} ({counts[f]})
          </button>
        ))}
      </div>
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden" }}>
        <div style={{ display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr 1fr",padding:"11px 20px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
          {["Name","Property","Room","Rent","Paid","Status"].map(h => (
            <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
          ))}
        </div>
        <div style={{ maxHeight:520,overflowY:"auto" }}>
          {filtered.length===0 ? (
            <div style={{ padding:32,textAlign:"center",color:T.muted,fontSize:13 }}>No students match your search criteria</div>
          ) : filtered.map(s => {
            const ac = T.prop[s.property];
            return (
              <div key={s.id} style={{ display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr 1fr",padding:"12px 20px",
                borderBottom:`1px solid ${T.border}15`,alignItems:"center",transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{s.name}</div>
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
  );
}
