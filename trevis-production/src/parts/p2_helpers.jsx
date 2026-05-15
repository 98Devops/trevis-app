/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS — deep slate + amber/gold accent
   PRESERVED FROM MVP — do not change these values
═══════════════════════════════════════════════════════════ */
export const T = {
  bg:"#0D0F14", surface:"#131720", card:"#181D26", border:"#232836",
  hover:"#1E2330", text:"#E8EAF0", muted:"#6B7280", subtle:"#9CA3AF",
  gold:"#F5A623", goldDim:"#F5A62330",
  green:"#22C55E", greenDim:"#22C55E22",
  red:"#EF4444", redDim:"#EF444422",
  amber:"#F59E0B", amberDim:"#F59E0B22",
  blue:"#3B82F6", blueDim:"#3B82F622",
  purple:"#A78BFA", purpleDim:"#A78BFA22",
  rose:"#FB7185", roseDim:"#FB718522",
  prop: {
    "King Fisher": { accent:"#22D3EE", dim:"#22D3EE18" },
    "The Chase":   { accent:"#A78BFA", dim:"#A78BFA18" },
    "Madden":      { accent:"#F59E0B", dim:"#F59E0B18" },
    "NEW HOUSE":   { accent:"#FB7185", dim:"#FB718518" },
  }
};
export const font = "'Sora','IBM Plex Mono',sans-serif";

/* ═══════════════════════════════════════════════════════════
   CSS KEYFRAMES (injected once)
═══════════════════════════════════════════════════════════ */
export const globalCSS = `
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
@keyframes slideUp {
  from { transform:translateY(100%); opacity:0; }
  to { transform:translateY(0); opacity:1; }
}
@keyframes fadeIn {
  from { opacity:0; transform:translateY(8px); }
  to { opacity:1; transform:translateY(0); }
}

/* ── MOBILE: 768px ── */
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
  .pn-shortcuts { display:none !important; }

  /* KPI grid → 2x2 */
  .pn-kpi-grid { grid-template-columns:1fr 1fr !important; gap:10px !important; }

  /* Property cards → single col */
  .pn-prop-grid { grid-template-columns:1fr !important; gap:12px !important; }

  /* Attention tables → cards */
  .pn-attn-table { display:none !important; }
  .pn-attn-cards { display:flex !important; }

  /* Chart: desktop hidden, mobile shown */
  .pn-chart-desktop { display:none !important; }
  .pn-chart-mobile { display:flex !important; }

  /* Modals full-width */
  .pn-modal-inner { width:95vw !important; max-width:95vw !important; max-height:90vh !important; margin:5vh auto !important; }
  .pn-profile-panel { width:100vw !important; }

  /* Header row stacks */
  .pn-header-row { flex-direction:column !important; gap:12px !important; align-items:flex-start !important; }
  .pn-header-actions { width:100% !important; flex-wrap:wrap !important; display:grid !important; grid-template-columns:1fr 1fr !important; gap:8px !important; }
  .pn-header-actions button { width:100% !important; }

  /* Quick actions wrap */
  .pn-quick-actions { flex-wrap:wrap !important; }
  .pn-quick-actions button { flex:1 !important; min-width:100px !important; }

  /* Report tabs: horizontal scroll strip */
  .pn-report-tabs {
    overflow-x:auto !important; -webkit-overflow-scrolling:touch !important;
    flex-wrap:nowrap !important; scrollbar-width:none !important; width:100% !important;
  }
  .pn-report-tabs::-webkit-scrollbar { display:none !important; }
  .pn-report-tabs button { flex-shrink:0 !important; white-space:nowrap !important; }

  /* Report tables → cards */
  .pn-report-table { display:none !important; }
  .pn-report-cards { display:flex !important; flex-direction:column !important; gap:8px !important; }
  .pn-report-header { display:none !important; }

  /* Students table → cards */
  .pn-students-table { display:none !important; }
  .pn-students-cards { display:flex !important; flex-direction:column !important; gap:8px !important; }

  /* Admin action buttons stack full width */
  .pn-admin-actions { flex-direction:column !important; }
  .pn-admin-actions button { width:100% !important; }

  /* Export button full width */
  .pn-export-btn { width:100% !important; }

  /* Room row grid simplify */
  .pn-room-row { grid-template-columns:1fr auto auto !important; gap:8px !important; }
  .pn-room-detail { display:none !important; }
  .pn-room-students { grid-template-columns:1fr !important; }

  /* Arrears bucket cards stack */
  .pn-arrears-buckets { flex-direction:column !important; }
  .pn-arrears-buckets button { width:100% !important; }

  /* Calendar mobile */
  .pn-calendar-grid { font-size:11px !important; }
  .pn-calendar-cell { padding:4px 2px !important; min-height:36px !important; }
  .pn-day-panel { position:fixed !important; bottom:0 !important; left:0 !important; right:0 !important;
    top:auto !important; max-height:60vh !important; border-radius:16px 16px 0 0 !important;
    animation:slideUp .3s ease !important; }

  /* Settings panel full width on mobile */
  .pn-settings-panel { width:100vw !important; }

  /* Table scroll helper */
  .pn-table-scroll { overflow-x:auto !important; -webkit-overflow-scrolling:touch !important; }

  /* Financial ledger cards */
  .pn-ledger-table { display:none !important; }
  .pn-ledger-cards { display:flex !important; flex-direction:column !important; gap:8px !important; }
}

/* ── MOBILE: 480px ── */
@media (max-width:480px) {
  .pn-kpi-grid { grid-template-columns:1fr !important; }
  .pn-main { padding:12px 10px !important; padding-top:56px !important; }
  .pn-stat-value { font-size:20px !important; }
  .pn-header-actions { grid-template-columns:1fr !important; }
}
`;

/* ═══════════════════════════════════════════════════════════
   DATA HELPERS
═══════════════════════════════════════════════════════════ */
export const fmt = (n) => "$" + Number(n).toLocaleString();

/**
 * Transform Supabase property data into the flat shape the UI expects.
 * Each property gets: name, rooms[], collected, expected, students, overdue[], totalBeds, vacantBeds
 */
export function buildProps(rawProperties) {
  // Current month as YYYY-MM for matching obligations
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const currentMonthDate = `${currentMonth}-01`;

  // Natural sort helper: "Room 3" before "Room 10"
  const roomNum = (name) => {
    const m = name.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };

  return rawProperties.map(prop => {
    const ac = T.prop[prop.name] || { accent: T.gold, dim: T.goldDim };
    let collected = 0, expected = 0, studentCount = 0, totalBeds = 0;
    const overdue = [];

    // Sort rooms numerically
    const sortedRooms = [...(prop.rooms || [])].sort((a, b) => roomNum(a.room_number) - roomNum(b.room_number));

    const rooms = sortedRooms.map(r => {
      totalBeds += r.bed_capacity;
      const students = (r.students || [])
        .filter(s => s.status === 'ACTIVE')
        .map(s => {
          studentCount++;
          const rent = Number(r.rent_per_bed);

          // Get paid amount from monthly_obligations for current month
          let paid = 0;
          const obligations = s.monthly_obligations || [];
          const currentObligation = obligations.find(o => {
            if (!o.month) return false;
            // month could be "2026-05-01" or "2026-05-01T00:00:00"
            return o.month.startsWith(currentMonth);
          });

          if (currentObligation) {
            paid = Number(currentObligation.amount_paid || 0);
          } else {
            // Fallback: sum payments for current month
            const payments = s.payments || [];
            paid = payments
              .filter(p => p.month_year === currentMonth)
              .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          }

          expected += rent;
          collected += paid;

          const status = paid >= rent ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OVERDUE';
          if (status !== 'PAID') {
            overdue.push({ ...s, name: s.full_name, room: r.room_number, roomRent: rent, paid, balance: rent - paid, status });
          }

          // Build payment history from payments records
          const payHistory = (s.payments || []).map(p => ({
            id: p.id, amount: Number(p.amount), date: p.payment_date,
            method: p.payment_method, receipt: p.receipt_number, notes: p.notes
          }));

          return { id: s.id, name: s.full_name, paid, status, date: s.check_in_date || "—", notes: s.notes, dataFlags: s.data_flags, payHistory };
        });
      return { id: r.id, no: r.room_number, beds: r.bed_capacity, rent: Number(r.rent_per_bed), students, notes: r.notes };
    });

    const vacantBeds = Math.max(0, totalBeds - studentCount);
    return { id: prop.id, name: prop.name, location: prop.location || 'Harare', color: ac.accent, rooms, collected, expected, students: studentCount, overdue, totalBeds, vacantBeds };
  });
}

/* ═══════════════════════════════════════════════════════════
   TINY COMPONENTS
═══════════════════════════════════════════════════════════ */
export const Badge = ({ status }) => {
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

export const Stat = ({ label, value, sub, accent }) => (
  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14,
    padding:"18px 22px", position:"relative", overflow:"hidden" }}>
    <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase",
      letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
    <div className="pn-stat-value" style={{ fontSize:24, fontWeight:800, color: accent || T.text,
      fontFamily:"'IBM Plex Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:T.subtle, marginTop:4 }}>{sub}</div>}
    <div style={{ position:"absolute", bottom:0, right:0, width:60, height:60,
      borderRadius:"50%", background: accent ? accent+"11" : "#ffffff06",
      transform:"translate(20px,20px)" }} />
  </div>
);

export const Bar = ({ pct, color }) => (
  <div style={{ background:T.border, borderRadius:99, height:5, overflow:"hidden" }}>
    <div style={{ width:`${Math.min(pct,100)}%`, background: color || T.gold, height:"100%",
      borderRadius:99, transition:"width .6s ease" }} />
  </div>
);

export const InputField = ({ label, value, onChange, type="text", placeholder="", style:extraStyle={} }) => (
  <div>
    {label && <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>{label}</div>}
    <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder}
      style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13,
        outline:"none", boxSizing:"border-box", fontFamily:font, ...extraStyle }} />
  </div>
);

export const SelectField = ({ label, value, onChange, options, style:extraStyle={} }) => (
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

export const Btn = ({ children, onClick, accent, disabled, style:s={} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ background: disabled ? T.border : (accent||T.gold), border:"none", borderRadius:9,
      padding:"10px 18px", color: disabled ? T.muted : "#0D0F14", fontWeight:700, fontSize:13,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily:font, transition:"all .15s", ...s }}>
    {children}
  </button>
);
