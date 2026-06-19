import { useState, useMemo } from "react";
import { T, font, fmt } from "./p2_helpers.jsx";
import { debug } from "../lib/debug.js";

export function Calendar({ props, onStudentClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [paymentDots, setPaymentDots] = useState({});
  const [obligationDots, setObligationDots] = useState({});
  const [checkinDots, setCheckinDots] = useState({});
  const [dayData, setDayData] = useState({ payments: [], obligations: [] });

  // Build calendar data from props
  const calendarData = useMemo(() => {
    // Defensive programming: ensure props is an array
    if (!props || !Array.isArray(props)) {
      console.warn('Calendar: props is not an array:', props);
      return { cells: [] };
    }

    debug('Calendar: Processing calendar data for', props.length, 'properties');

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    // Reset dots
    const newPaymentDots = {};
    const newObligationDots = {};
    const newCheckinDots = {};

    try {
      // Process all properties for calendar events
      props.forEach(property => {
        if (!property || !property.rooms || !Array.isArray(property.rooms)) {
          console.warn('Calendar: Invalid property structure:', property);
          return;
        }
        
        property.rooms.forEach(room => {
          if (!room || !room.students || !Array.isArray(room.students)) {
            console.warn('Calendar: Invalid room structure:', room);
            return;
          }
          
          room.students.forEach(student => {
            if (!student || student.status === "VACANT" || student.status === "VACATED") return;

            // Check-ins
            if (student.date && student.date !== "—") {
              try {
                // Handle different date formats that might come from the database
                let checkinDate;
                if (typeof student.date === 'string') {
                  // Try parsing ISO date first, then fallback to other formats
                  checkinDate = new Date(student.date);
                  if (isNaN(checkinDate.getTime())) {
                    // Try parsing as YYYY-MM-DD format
                    const parts = student.date.split('-');
                    if (parts.length === 3) {
                      checkinDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                  }
                } else {
                  checkinDate = new Date(student.date);
                }
                
                if (!isNaN(checkinDate.getTime()) && checkinDate.getFullYear() === year && checkinDate.getMonth() === month) {
                  const dayKey = checkinDate.getDate();
                  if (dayKey >= 1 && dayKey <= 31) { // Validate day is in valid range
                    if (!newCheckinDots[dayKey]) newCheckinDots[dayKey] = [];
                    newCheckinDots[dayKey].push({
                      student: student.name || 'Unknown Student',
                      property: property.name || 'Unknown Property',
                      room: room.no || 'Unknown Room',
                      date: student.date
                    });
                  }
                }
              } catch (e) {
                console.warn('Calendar: Invalid check-in date:', student.date, e);
              }
            }

            // Payment history
            if (student.payHistory && Array.isArray(student.payHistory) && student.payHistory.length > 0) {
              student.payHistory.forEach(payment => {
                if (!payment || !payment.date) return;
                
                try {
                  // Handle different date formats that might come from the database
                  let payDate;
                  if (typeof payment.date === 'string') {
                    // Try parsing ISO date first, then fallback to other formats
                    payDate = new Date(payment.date);
                    if (isNaN(payDate.getTime())) {
                      // Try parsing as YYYY-MM-DD format
                      const parts = payment.date.split('-');
                      if (parts.length === 3) {
                        payDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                      }
                    }
                  } else {
                    payDate = new Date(payment.date);
                  }
                  
                  if (!isNaN(payDate.getTime()) && payDate.getFullYear() === year && payDate.getMonth() === month) {
                    const dayKey = payDate.getDate();
                    if (dayKey >= 1 && dayKey <= 31) { // Validate day is in valid range
                      if (!newPaymentDots[dayKey]) newPaymentDots[dayKey] = [];
                      newPaymentDots[dayKey].push({
                        student: student.name || 'Unknown Student',
                        property: property.name || 'Unknown Property',
                        room: room.no || 'Unknown Room',
                        amount: payment.amount || 0,
                        method: payment.method || "Cash",
                        date: payment.date
                      });
                    }
                  }
                } catch (e) {
                  console.warn('Calendar: Invalid payment date:', payment.date, e);
                }
              });
            }

            // Obligations (unpaid balances)
            const balance = (room.rent || 0) - (student.paid || 0);
            if (balance > 0) {
              // Show obligations on the 1st of the month
              if (!newObligationDots[1]) newObligationDots[1] = [];
              newObligationDots[1].push({
                student: student.name || 'Unknown Student',
                property: property.name || 'Unknown Property',
                room: room.no || 'Unknown Room',
                amount: balance,
                status: student.status || 'UNKNOWN'
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Calendar: Error processing calendar data:', error);
    }

    // Build 42-cell grid (6 weeks × 7 days)
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startDay + 1;
      const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
      const date = isCurrentMonth ? new Date(year, month, dayNum) : null;
      const isToday = date && date.toDateString() === new Date().toDateString();

      cells.push({
        index: i,
        dayNum: isCurrentMonth ? dayNum : null,
        date,
        isToday,
        hasPayments: newPaymentDots[dayNum]?.length > 0,
        hasCheckins: newCheckinDots[dayNum]?.length > 0,
        hasObligations: newObligationDots[dayNum]?.length > 0,
        paymentCount: newPaymentDots[dayNum]?.length || 0,
        checkinCount: newCheckinDots[dayNum]?.length || 0,
        obligationCount: newObligationDots[dayNum]?.length || 0
      });
    }

    setPaymentDots(newPaymentDots);
    setObligationDots(newObligationDots);
    setCheckinDots(newCheckinDots);

    return { cells };
  }, [currentDate, props]);

  // Navigation
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const today = () => setCurrentDate(new Date());

  const monthLabel = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Handle day click
  const handleDayClick = (cell) => {
    if (!cell.dayNum) return;
    
    const dayPayments = paymentDots[cell.dayNum] || [];
    const dayObligations = obligationDots[cell.dayNum] || [];
    const dayCheckins = checkinDots[cell.dayNum] || [];
    
    setDayData({
      date: cell.date,
      payments: dayPayments,
      obligations: dayObligations,
      checkins: dayCheckins
    });
    setSelectedDay(cell);
  };

  // Upcoming events (next 7 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const events = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      
      if (date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()) {
        const dayNum = date.getDate();
        const payments = paymentDots[dayNum] || [];
        const obligations = obligationDots[dayNum] || [];
        const checkins = checkinDots[dayNum] || [];
        
        if (payments.length > 0 || obligations.length > 0 || checkins.length > 0) {
          events.push({
            date,
            dayOffset: i,
            payments,
            obligations,
            checkins
          });
        }
      }
    }
    
    return events;
  }, [currentDate, paymentDots, obligationDots, checkinDots]);

  // Handle loading and empty states
  if (!props || !Array.isArray(props)) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Calendar</div>
        <div style={{ fontSize: 13, color: T.muted }}>Loading calendar data...</div>
      </div>
    );
  }

  if (props.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Calendar</div>
        <div style={{ fontSize: 13, color: T.muted }}>No properties available to display calendar events.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, color: T.gold, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 4 }}>
          {monthLabel}
        </h2>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>Calendar</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={prevMonth} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: T.text, fontFamily: font, fontSize: 13, fontWeight: 600 }}>
              ← Prev
            </button>
            <button onClick={today} style={{ background: T.goldDim, border: `1px solid ${T.gold}40`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: T.gold, fontFamily: font, fontSize: 13, fontWeight: 600 }}>
              Today
            </button>
            <button onClick={nextMonth} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: T.text, fontFamily: font, fontSize: 13, fontWeight: 600 }}>
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.subtle }}>
          <span style={{ color: T.green, fontSize: 12 }}>●</span>
          Payments
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.subtle }}>
          <span style={{ color: T.red, fontSize: 12 }}>●</span>
          Overdue
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.subtle }}>
          <span style={{ color: T.gold, fontSize: 12 }}>●</span>
          Check-ins
        </div>
      </div>

      {/* Calendar Grid - Desktop */}
      <div className="pn-calendar-desktop" style={{ 
        background: T.card, 
        border: `1px solid ${T.border}`, 
        borderRadius: 16, 
        overflow: "hidden", 
        marginBottom: 20,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility"
      }}>
        {/* Week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          {weekDays.map(day => (
            <div key={day} style={{ padding: "12px 8px", textAlign: "center", fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar cells */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(7, 1fr)",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale"
        }}>
          {calendarData.cells && calendarData.cells.length > 0 ? calendarData.cells.map(cell => (
            <div key={cell.index} onClick={() => handleDayClick(cell)}
              style={{ 
                minHeight: 90, 
                padding: 8, 
                border: `1px solid ${T.border}20`, 
                cursor: cell.dayNum ? "pointer" : "default",
                background: cell.isToday ? `${T.gold}15` : 
                           (cell.hasPayments || cell.hasCheckins || cell.hasObligations) ? `${T.blue}08` :
                           cell.dayNum ? T.card : T.surface,
                borderLeft: cell.isToday ? `3px solid ${T.gold}` : `1px solid ${T.border}20`,
                transition: "all .15s",
                position: "relative"
              }}
              onMouseEnter={e => cell.dayNum && (e.currentTarget.style.background = cell.isToday ? `${T.gold}20` : T.hover)}
              onMouseLeave={e => cell.dayNum && (e.currentTarget.style.background = 
                cell.isToday ? `${T.gold}15` : 
                (cell.hasPayments || cell.hasCheckins || cell.hasObligations) ? `${T.blue}08` : T.card
              )}>
              
              {cell.dayNum && (
                <>
                  {/* Day number */}
                  <div style={{ 
                    fontSize: 13, 
                    fontWeight: cell.isToday ? 700 : 600, 
                    color: cell.isToday ? T.gold : T.text, 
                    marginBottom: 6 
                  }}>
                    {cell.dayNum}
                  </div>
                  
                  {/* Event dots */}
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", position: "absolute", bottom: 6, left: 6 }}>
                    {cell.hasPayments && (
                      <div style={{ 
                        width: 6, height: 6, borderRadius: "50%", background: T.green,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }} title={`${cell.paymentCount} payments`} />
                    )}
                    {cell.hasObligations && (
                      <div style={{ 
                        width: 6, height: 6, borderRadius: "50%", background: T.red,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }} title={`${cell.obligationCount} overdue`} />
                    )}
                    {cell.hasCheckins && (
                      <div style={{ 
                        width: 6, height: 6, borderRadius: "50%", background: T.gold,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }} title={`${cell.checkinCount} check-ins`} />
                    )}
                  </div>
                </>
              )}
            </div>
          )) : (
            // Fallback: render empty calendar grid if no cells
            Array.from({ length: 42 }, (_, i) => (
              <div key={`empty-desktop-${i}`} style={{ 
                minHeight: 90, 
                padding: 8, 
                border: `1px solid ${T.border}20`, 
                background: T.surface 
              }} />
            ))
          )}
        </div>
      </div>

      {/* Calendar Mobile - Full Grid (Identical to Desktop) */}
      <div className="pn-calendar-mobile" style={{ 
        display: "none", 
        background: T.card, 
        border: `1px solid ${T.border}`, 
        borderRadius: 16, 
        overflow: "hidden", 
        marginBottom: 20,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility"
      }}>
        {/* Week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          {weekDays.map(day => (
            <div key={day} style={{ padding: "8px 4px", textAlign: "center", fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar cells - Mobile responsive */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(7, 1fr)",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale"
        }}>
          {calendarData.cells && calendarData.cells.length > 0 ? calendarData.cells.map(cell => (
            <div key={cell.index + "m"} onClick={() => handleDayClick(cell)}
              style={{ 
                minHeight: 44, // Touch target minimum
                padding: 4, 
                border: `1px solid ${T.border}20`, 
                cursor: cell.dayNum ? "pointer" : "default",
                background: cell.isToday ? `${T.gold}15` : 
                           (cell.hasPayments || cell.hasCheckins || cell.hasObligations) ? `${T.blue}08` :
                           cell.dayNum ? T.card : T.surface,
                borderLeft: cell.isToday ? `3px solid ${T.gold}` : `1px solid ${T.border}20`,
                transition: "all .15s",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
              onTouchStart={e => cell.dayNum && (e.currentTarget.style.background = cell.isToday ? `${T.gold}20` : T.hover)}
              onTouchEnd={e => cell.dayNum && (e.currentTarget.style.background = 
                cell.isToday ? `${T.gold}15` : 
                (cell.hasPayments || cell.hasCheckins || cell.hasObligations) ? `${T.blue}08` : T.card
              )}>
              
              {cell.dayNum && (
                <>
                  {/* Day number */}
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: cell.isToday ? 700 : 600, 
                    color: cell.isToday ? T.gold : T.text, 
                    textAlign: "center",
                    lineHeight: 1
                  }}>
                    {cell.dayNum}
                  </div>
                  
                  {/* Event dots - Mobile sized */}
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end", flex: 1 }}>
                    {cell.hasPayments && (
                      <div style={{ 
                        width: 5, height: 5, borderRadius: "50%", background: T.green
                      }} title={`${cell.paymentCount} payments`} />
                    )}
                    {cell.hasObligations && (
                      <div style={{ 
                        width: 5, height: 5, borderRadius: "50%", background: T.red
                      }} title={`${cell.obligationCount} overdue`} />
                    )}
                    {cell.hasCheckins && (
                      <div style={{ 
                        width: 5, height: 5, borderRadius: "50%", background: T.gold
                      }} title={`${cell.checkinCount} check-ins`} />
                    )}
                  </div>
                </>
              )}
            </div>
          )) : (
            // Fallback: render empty calendar grid if no cells
            Array.from({ length: 42 }, (_, i) => (
              <div key={`empty-mobile-${i}`} style={{ 
                minHeight: 44, 
                padding: 4, 
                border: `1px solid ${T.border}20`, 
                background: T.surface 
              }} />
            ))
          )}
        </div>
      </div>
      {/* Upcoming Events Strip */}
      {upcomingEvents.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>📅 Upcoming (Next 7 Days)</div>
          <div className="pn-upcoming-desktop" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {upcomingEvents.map((event, i) => (
              <div key={i} onClick={() => handleDayClick({ dayNum: event.date.getDate(), date: event.date })}
                style={{ 
                  minWidth: 140, 
                  background: T.surface, 
                  border: `1px solid ${T.border}`, 
                  borderRadius: 10, 
                  padding: 12, 
                  cursor: "pointer",
                  transition: "background .15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.hover}
                onMouseLeave={e => e.currentTarget.style.background = T.surface}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  {event.dayOffset === 0 ? "TODAY" : `+${event.dayOffset}`} {event.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </div>
                <div style={{ fontSize: 10, color: T.subtle }}>
                  {event.payments.length > 0 && `${event.payments.length} payments`}
                  {event.payments.length > 0 && event.obligations.length > 0 && " · "}
                  {event.obligations.length > 0 && `${event.obligations.length} overdue`}
                  {(event.payments.length > 0 || event.obligations.length > 0) && event.checkins.length > 0 && " · "}
                  {event.checkins.length > 0 && `${event.checkins.length} check-ins`}
                </div>
              </div>
            ))}
          </div>
          
          {/* Mobile upcoming - vertical list */}
          <div className="pn-upcoming-mobile" style={{ display: "none", flexDirection: "column", gap: 8 }}>
            {upcomingEvents.map((event, i) => (
              <div key={i + "m"} onClick={() => handleDayClick({ dayNum: event.date.getDate(), date: event.date })}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < upcomingEvents.length - 1 ? `1px solid ${T.border}20` : "none", cursor: "pointer" }}>
                <div style={{ fontSize: 12, color: T.text }}>
                  {event.dayOffset === 0 ? "TODAY" : `+${event.dayOffset}`} {event.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </div>
                <div style={{ fontSize: 10, color: T.subtle }}>
                  {event.payments.length + event.obligations.length + event.checkins.length} events
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Panel */}
      {selectedDay && (
        <DayPanel 
          dayData={dayData} 
          onClose={() => setSelectedDay(null)} 
          onStudentClick={onStudentClick}
        />
      )}

      {/* Mobile Day Panel - Bottom Sheet */}
      {selectedDay && (
        <MobileDayPanel 
          dayData={dayData} 
          onClose={() => setSelectedDay(null)} 
          onStudentClick={onStudentClick}
        />
      )}

      {/* Responsive CSS */}
      <style>{`
        /* Desktop calendar visible by default */
        .pn-calendar-desktop { display: block; }
        .pn-calendar-mobile { display: none !important; }
        .pn-day-panel-wrapper { display: flex !important; }
        .pn-mobile-day-panel-wrapper { display: none !important; }
        .pn-day-panel-inner { display: block; }
        .pn-mobile-day-panel { display: none !important; }
        .pn-upcoming-desktop { display: flex; }
        .pn-upcoming-mobile { display: none !important; }

        /* Mobile breakpoint: ≤768px */
        @media (max-width: 768px) {
          .pn-calendar-desktop { display: none !important; }
          .pn-calendar-mobile { display: block !important; }
          .pn-day-panel-wrapper { display: none !important; }
          .pn-mobile-day-panel-wrapper { display: flex !important; }
          .pn-day-panel-inner { display: none !important; }
          .pn-mobile-day-panel { display: block !important; }
          .pn-upcoming-desktop { display: none !important; }
          .pn-upcoming-mobile { display: flex !important; }
        }

        /* Tablet breakpoint: 769px-1024px */
        @media (min-width: 769px) and (max-width: 1024px) {
          .pn-calendar-desktop { display: block; }
          .pn-calendar-mobile { display: none !important; }
          .pn-day-panel-wrapper { display: flex !important; }
          .pn-mobile-day-panel-wrapper { display: none !important; }
          .pn-day-panel-inner { display: block; }
          .pn-mobile-day-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* Day Panel Component */
function DayPanel({ dayData, onClose, onStudentClick }) {
  const dateLabel = dayData.date?.toLocaleDateString("en-US", { 
    weekday: "long", 
    month: "long", 
    day: "numeric", 
    year: "numeric" 
  });
  
  const totalPayments = dayData.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalObligations = dayData.obligations.length;
  const paidObligations = dayData.obligations.filter(o => o.status === "PAID").length;
  const unpaidObligations = totalObligations - paidObligations;

  return (
    <div 
      onClick={onClose} 
      className="pn-day-panel-wrapper"
      style={{ 
        position: "fixed", 
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.9)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        zIndex: 9999,
        padding: "20px"
      }}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        className="pn-day-panel-inner"
        style={{ 
          backgroundColor: "#181D26",
          border: "3px solid #F5A623", 
          borderRadius: "20px", 
          padding: "40px", 
          width: "500px", 
          maxWidth: "95vw", 
          maxHeight: "85vh", 
          overflowY: "auto",
          boxShadow: "0 30px 100px rgba(0,0,0,0.8)",
          position: "relative"
        }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#E8EAF0", marginBottom: 8 }}>{dateLabel}</div>
            <div style={{ fontSize: 14, color: "#9CA3AF" }}>
              {dayData.payments.length} payments · {dayData.checkins.length} check-ins · {dayData.obligations.length} obligations
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: "none", 
              border: "2px solid #F5A623", 
              borderRadius: "8px",
              color: "#F5A623", 
              cursor: "pointer", 
              fontSize: 18,
              padding: "8px 12px",
              fontWeight: "bold"
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Payments */}
        {dayData.payments.length > 0 && (
          <div style={{ marginBottom: 25 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#22C55E", marginBottom: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <span>💰 PAYMENTS RECORDED ({dayData.payments.length})</span>
              {totalPayments > 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>({fmt(totalPayments)} total)</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {dayData.payments.map((payment, i) => (
                <div key={i} style={{ backgroundColor: "#131720", border: "2px solid #232836", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>● {payment.student}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#22C55E", fontFamily: "'IBM Plex Mono',monospace" }}>
                      {fmt(payment.amount)} {payment.method}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>{payment.property} — {payment.room}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Obligations */}
        {dayData.obligations.length > 0 && (
          <div style={{ marginBottom: 25 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#EF4444", marginBottom: 15 }}>
              ⚠ OBLIGATIONS DUE ({totalObligations})
            </div>
            <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 15 }}>
              {paidObligations} paid · {unpaidObligations} overdue
              <button style={{ 
                marginLeft: 15, 
                backgroundColor: "#F5A62330", 
                border: "2px solid #F5A623", 
                borderRadius: 8, 
                padding: "6px 12px", 
                color: "#F5A623", 
                fontSize: 12, 
                cursor: "pointer", 
                fontFamily: font,
                fontWeight: "600"
              }}>
                View in Finances →
              </button>
            </div>
          </div>
        )}

        {/* Check-ins */}
        {dayData.checkins.length > 0 && (
          <div style={{ marginBottom: 25 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F5A623", marginBottom: 15 }}>🏠 CHECK-INS ({dayData.checkins.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {dayData.checkins.map((checkin, i) => (
                <div key={i} 
                  onClick={() => onStudentClick && onStudentClick(
                    { name: checkin.student, date: checkin.date }, 
                    { no: checkin.room }, 
                    checkin.property
                  )}
                  style={{ 
                    backgroundColor: "#131720", 
                    border: "2px solid #232836", 
                    borderRadius: 12, 
                    padding: 16, 
                    cursor: "pointer", 
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#1E2330"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "#131720"}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0", marginBottom: 4 }}>● {checkin.student}</div>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>{checkin.property} — {checkin.room}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {dayData.payments.length === 0 && dayData.checkins.length === 0 && dayData.obligations.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>
            No events on this date.
          </div>
        )}
      </div>
    </div>
  );
}

/* Mobile Day Panel Component - Bottom Sheet */
function MobileDayPanel({ dayData, onClose, onStudentClick }) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dateLabel = dayData.date?.toLocaleDateString("en-US", { 
    weekday: "long", 
    month: "long", 
    day: "numeric" 
  });

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const deltaY = currentY - startY;
    
    // Close if swiped down more than 100px
    if (deltaY > 100) {
      onClose();
    }
    
    setIsDragging(false);
    setStartY(0);
    setCurrentY(0);
  };

  const totalPayments = dayData.payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div onClick={onClose} className="pn-mobile-day-panel-wrapper" style={{ 
      position: "fixed", 
      inset: 0, 
      background: "rgba(0,0,0,.85)", 
      display: "flex", 
      alignItems: "flex-end", 
      justifyContent: "center", 
      zIndex: 1000
    }}>
      <div 
        onClick={e => e.stopPropagation()} 
        className="pn-mobile-day-panel"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          backgroundColor: "#181D26", 
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `2px solid #F5A623`,
          width: "100%", 
          height: "70vh",
          overflowY: "auto",
          transform: isDragging ? `translateY(${Math.max(0, currentY - startY)}px)` : 'translateY(0)',
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          animation: 'slideUp 0.3s ease-out',
          boxShadow: "0 -15px 50px rgba(0,0,0,.8)"
        }}>
        
        {/* Drag Handle */}
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          padding: "12px 0 8px 0",
          borderBottom: `1px solid #232836`
        }}>
          <div style={{ 
            width: 40, 
            height: 4, 
            backgroundColor: "#9CA3AF", 
            borderRadius: 2 
          }} />
        </div>

        <div style={{ padding: "16px 20px" }}>
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#E8EAF0", marginBottom: 4 }}>{dateLabel}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
              {dayData.payments.length} payments · {dayData.checkins.length} check-ins · {dayData.obligations.length} obligations
            </div>
          </div>

          {/* Payments */}
          {dayData.payments.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>💰 PAYMENTS ({dayData.payments.length})</span>
                {totalPayments > 0 && <span style={{ fontSize: 11, color: "#9CA3AF" }}>({fmt(totalPayments)})</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dayData.payments.map((payment, i) => (
                  <div key={i} style={{ backgroundColor: "#131720", border: `2px solid #232836`, borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>{payment.student}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#22C55E", fontFamily: "'IBM Plex Mono',monospace" }}>
                        {fmt(payment.amount)}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{payment.property} — Room {payment.room}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{payment.method}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Check-ins */}
          {dayData.checkins.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F5A623", marginBottom: 12 }}>🏠 CHECK-INS ({dayData.checkins.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dayData.checkins.map((checkin, i) => (
                  <div key={i} 
                    onClick={() => onStudentClick && onStudentClick(
                      { name: checkin.student, date: checkin.date }, 
                      { no: checkin.room }, 
                      checkin.property
                    )}
                    style={{ 
                      backgroundColor: "#131720", 
                      border: `2px solid #232836`, 
                      borderRadius: 12, 
                      padding: 14, 
                      cursor: "pointer",
                      minHeight: 44 // Touch target
                    }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0", marginBottom: 4 }}>{checkin.student}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{checkin.property} — Room {checkin.room}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Obligations */}
          {dayData.obligations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444", marginBottom: 12 }}>
                ⚠ OBLIGATIONS ({dayData.obligations.length})
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
                Monthly rent obligations due
              </div>
            </div>
          )}

          {/* Empty state */}
          {dayData.payments.length === 0 && dayData.checkins.length === 0 && dayData.obligations.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              No events on this date.
            </div>
          )}
        </div>

        {/* Slide up animation */}
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}