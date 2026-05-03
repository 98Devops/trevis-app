
/* ═══════════════════════════════════════════════════════════
   AUTH CREDENTIALS
═══════════════════════════════════════════════════════════ */
const USERS = [
  { email:"admin@trevis.co.zw", password:"admin1234", role:"admin" },
  { email:"manager@trevis.co.zw", password:"manager1234", role:"manager" },
];

/* ═══════════════════════════════════════════════════════════
   DATA HELPERS
═══════════════════════════════════════════════════════════ */
const fmt = (n) => "$" + Number(n).toLocaleString();

function buildProps(seed) {
  return Object.entries(seed).map(([name, data]) => {
    let collected = 0, expected = 0, students = 0, totalBeds = 0;
    const overdue = [];
    data.rooms.forEach(r => {
      totalBeds += r.beds;
      const real = r.students.filter(s => s.status !== "VACANT");
      real.forEach(s => {
        students++;
        collected += s.paid;
        expected += r.rent;
        if (s.status !== "PAID") overdue.push({ ...s, room: r.no, roomRent: r.rent, balance: r.rent - s.paid });
      });
    });
    const vacantBeds = totalBeds - students;
    return { name, location: data.location, rooms: data.rooms, collected, expected, students, overdue, totalBeds, vacantBeds };
  });
}

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS — deep slate + amber/gold accent
═══════════════════════════════════════════════════════════ */
const T = {
  bg:"#0D0F14", surface:"#131720", card:"#181D26", border:"#232836",
  hover:"#1E2330", text:"#E8EAF0", muted:"#6B7280", subtle:"#9CA3AF",
  gold:"#F5A623", goldDim:"#F5A62330",
  green:"#22C55E", greenDim:"#22C55E22",
  red:"#EF4444", redDim:"#EF444422",
  amber:"#F59E0B", amberDim:"#F59E0B22",
  blue:"#3B82F6", blueDim:"#3B82F622",
  purple:"#A78BFA", purpleDim:"#A78BFA22",
  prop: {
    "King Fisher": { accent:"#22D3EE", dim:"#22D3EE18" },
    "The Chase":   { accent:"#A78BFA", dim:"#A78BFA18" },
    "Madden":      { accent:"#F59E0B", dim:"#F59E0B18" },
    "Prices":      { accent:"#34D399", dim:"#34D39918" },
  }
};
const font = "'Sora','IBM Plex Mono',sans-serif";

/* ═══════════════════════════════════════════════════════════
   CSS KEYFRAMES (injected once)
═══════════════════════════════════════════════════════════ */
const globalCSS = `
* { box-sizing:border-box; margin:0; padding:0; }
::-webkit-scrollbar { width:4px; height:4px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:4px; }
select option { background:#131720; }
@keyframes pulse-overdue {
  0%,100% { opacity:1; }
  50% { opacity:0.5; }
}
@keyframes slideIn {
  from { transform:translateX(100%); opacity:0; }
  to { transform:translateX(0); opacity:1; }
}
@keyframes fadeIn {
  from { opacity:0; transform:translateY(8px); }
  to { opacity:1; transform:translateY(0); }
}
@media (max-width:768px) {
  .pn-sidebar {
    position:fixed !important; left:0 !important; top:0 !important; bottom:0 !important;
    width:260px !important; z-index:900 !important;
    transform:translateX(-100%) !important; transition:transform .25s ease !important;
  }
  .pn-sidebar.pn-sidebar-open { transform:translateX(0) !important; }
  .pn-sidebar-overlay {
    display:block !important; position:fixed; inset:0; background:rgba(0,0,0,.55);
    z-index:899; opacity:0; pointer-events:none; transition:opacity .25s ease;
  }
  .pn-sidebar-overlay.pn-sidebar-open { opacity:1; pointer-events:auto; }
  .pn-hamburger { display:flex !important; }
  .pn-main { padding:16px 14px !important; padding-top:60px !important; }
  .pn-kpi-grid { grid-template-columns:1fr 1fr !important; gap:10px !important; }
  .pn-prop-grid { grid-template-columns:1fr !important; gap:12px !important; }
  .pn-attn-table { display:none !important; }
  .pn-attn-cards { display:flex !important; }
  .pn-table-scroll { overflow-x:auto !important; -webkit-overflow-scrolling:touch !important; }
  .pn-chart-labels { font-size:8px !important; }
  .pn-modal-inner { width:95vw !important; max-width:95vw !important; max-height:90vh !important; margin:5vh auto !important; }
  .pn-profile-panel { width:100vw !important; }
  .pn-header-row { flex-direction:column !important; gap:12px !important; align-items:flex-start !important; }
  .pn-header-actions { width:100% !important; flex-wrap:wrap !important; }
  .pn-quick-actions { flex-wrap:wrap !important; }
  .pn-quick-actions button { flex:1 !important; min-width:100px !important; }
}
@media (max-width:480px) {
  .pn-kpi-grid { grid-template-columns:1fr !important; }
  .pn-main { padding:12px 10px !important; padding-top:56px !important; }
  .pn-stat-value { font-size:20px !important; }
}
`;

/* ═══════════════════════════════════════════════════════════
   TINY COMPONENTS
═══════════════════════════════════════════════════════════ */
const Badge = ({ status }) => {
  const cfg = {
    PAID:    { bg: T.greenDim, c: T.green, label:"Paid" },
    PARTIAL: { bg: T.amberDim, c: T.amber, label:"Partial" },
    OVERDUE: { bg: T.redDim,   c: T.red,   label:"Overdue" },
    VACANT:  { bg: T.purpleDim, c: T.purple, label:"Vacant" },
  }[status] || { bg:"#22283620", c:T.muted, label: status };
  const isOverdue = status === "OVERDUE";
  return (
    <span style={{ background:cfg.bg, color:cfg.c, padding:"2px 9px", borderRadius:20,
      fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
      animation: isOverdue ? "pulse-overdue 2s ease-in-out infinite" : "none" }}>
      {cfg.label}
    </span>
  );
};

const Stat = ({ label, value, sub, accent }) => (
  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14,
    padding:"18px 22px", position:"relative", overflow:"hidden" }}>
    <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase",
      letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:24, fontWeight:800, color: accent || T.text,
      fontFamily:"'IBM Plex Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:T.subtle, marginTop:4 }}>{sub}</div>}
    <div style={{ position:"absolute", bottom:0, right:0, width:60, height:60,
      borderRadius:"50%", background: accent ? accent+"11" : "#ffffff06",
      transform:"translate(20px,20px)" }} />
  </div>
);

const Bar = ({ pct, color }) => (
  <div style={{ background:T.border, borderRadius:99, height:5, overflow:"hidden" }}>
    <div style={{ width:`${Math.min(pct,100)}%`, background: color || T.gold, height:"100%",
      borderRadius:99, transition:"width .6s ease" }} />
  </div>
);

const InputField = ({ label, value, onChange, type="text", placeholder="", style:extraStyle={} }) => (
  <div>
    {label && <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>{label}</div>}
    <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder}
      style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13,
        outline:"none", boxSizing:"border-box", fontFamily:font, ...extraStyle }} />
  </div>
);

const SelectField = ({ label, value, onChange, options, style:extraStyle={} }) => (
  <div>
    {label && <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>{label}</div>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13,
        outline:"none", boxSizing:"border-box", fontFamily:font, ...extraStyle }}>
      {options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Btn = ({ children, onClick, accent, disabled, style:s={} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ background: disabled ? T.border : (accent||T.gold), border:"none", borderRadius:9,
      padding:"10px 18px", color: disabled ? T.muted : "#0D0F14", fontWeight:700, fontSize:13,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily:font, transition:"all .15s", ...s }}>
    {children}
  </button>
);
