# Design Document: Sprint 4 — Mobile Experience Overhaul, Financial Intelligence & Calendar

## Overview

Sprint 4 transforms the Trevis student accommodation management system into a mobile-first, financially intelligent platform with comprehensive calendar functionality. This sprint addresses three critical areas: (1) responsive mobile layouts for all views using CSS injection, (2) enhanced financial tracking with payment ledgers, filtering, and tenant statements, and (3) a calendar view for visualizing payments and obligations over time. The design maintains the existing React 19 + Vite + Supabase architecture while introducing new components (Calendar, Settings, enhanced StudentProfile) and database schema changes (rooms.is_active, settings table). All features are designed mobile-first with progressive enhancement for desktop.

## Architecture

```mermaid
graph TD
    A[App.jsx] --> B[MobileStyles Component]
    A --> C[Calendar View]
    A --> D[Settings Panel]
    A --> E[Enhanced StudentProfile]
    A --> F[Financials Tab in Reports]
    
    B --> B1[CSS Injection @media 768px]
    B --> B2[Card-based Layouts]
    B --> B3[Responsive Charts]
    
    C --> C1[Monthly Grid]
    C --> C2[Day Panel]
    C --> C3[Calendar Service]
    
    D --> D1[System Settings]
    D --> D2[Email Management]
    D --> D3[Property Config]
    
    E --> E1[Payment Timeline]
    E --> E2[Edit/Delete Payment]
    E --> E3[Generate Statement]
    
    F --> F1[Financial Ledger]
    F --> F2[Filter Bar]
    F --> F3[Quarterly View]
    
    C3 --> G[Supabase]
    E2 --> G
    F1 --> G
    D2 --> G
    
    G --> H[monthly_obligations]
    G --> I[payments]
    G --> J[settings table]
    G --> K[rooms.is_active]


## Main Algorithm/Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant M as MobileStyles
    participant C as Calendar
    participant S as Settings
    participant P as StudentProfile
    participant DB as Supabase
    
    U->>A: Load application
    A->>M: Inject mobile CSS
    M->>A: Apply responsive styles
    
    U->>C: Navigate to Calendar
    C->>DB: Fetch payments & obligations
    DB-->>C: Return data
    C->>C: Render monthly grid
    U->>C: Click date
    C->>C: Show day panel
    
    U->>P: Open student profile
    P->>DB: Fetch payment history
    DB-->>P: Return payments
    P->>P: Render timeline
    U->>P: Edit payment
    P->>DB: Update payment
    DB-->>P: Confirm update
    P->>P: Refresh timeline
    
    U->>S: Open settings (Admin)
    S->>DB: Fetch settings
    DB-->>S: Return config
    U->>S: Add allowed email
    S->>DB: Insert into settings
    DB-->>S: Confirm


## Components and Interfaces

### Component 1: MobileStyles

**Purpose**: Inject comprehensive mobile-responsive CSS for all breakpoints (@media max-width: 768px and 480px)

**Interface**:
```typescript
interface MobileStylesProps {}

const MobileStyles: React.FC<MobileStylesProps> = () => {
  return <style>{mobileCSS}</style>;
}
```

**Responsibilities**:
- Inject CSS for mobile breakpoints (768px, 480px)
- Convert tables to card-based layouts on mobile
- Transform charts from vertical to horizontal bars
- Stack header actions and buttons
- Apply full-width modals and panels
- Enable sidebar slide-in behavior

**CSS Injection Strategy**:
- All mobile styles already exist in `p2_helpers.jsx` globalCSS
- No new component needed — styles are already injected via `<style>{globalCSS}</style>` in App.jsx
- Sprint 4 will verify and enhance existing mobile classes

---

### Component 2: Calendar

**Purpose**: Monthly calendar view showing payments, obligations, and check-ins with colored dots

**Interface**:
```typescript
interface CalendarProps {
  props: Property[];
  onStudentClick?: (student: Student, room: Room, propName: string) => void;
}

interface CalendarDay {
  date: Date;
  payments: Payment[];
  obligations: Obligation[];
  checkIns: Student[];
}

const Calendar: React.FC<CalendarProps> = ({ props, onStudentClick }) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  
  return (
    <div>
      <CalendarHeader month={currentMonth} onNavigate={setCurrentMonth} />
      <CalendarGrid month={currentMonth} days={days} onDayClick={setSelectedDay} />
      <UpcomingStrip days={next7Days} />
      {selectedDay && <DayPanel day={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}
```

**Responsibilities**:
- Render monthly grid with 7 columns (Sun-Sat)
- Display colored dots: green (payments), red (unpaid obligations), gold (check-ins)
- Handle month navigation (Previous/Next/Today)
- Show day panel on date click with detailed transactions
- Display upcoming 7-day summary strip
- Mobile: full-width grid, bottom sheet for day panel

---

### Component 3: Settings Panel

**Purpose**: Admin-only slide-in drawer for system configuration

**Interface**:
```typescript
interface SettingsProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

interface SystemSettings {
  systemName: string;
  currencySymbol: string;
  countryPhoneCode: string;
}

interface AllowedEmail {
  id: string;
  email: string;
  created_at: string;
}

const Settings: React.FC<SettingsProps> = ({ open, onClose, isAdmin }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  
  return (
    <div className="pn-settings-panel" style={{ /* slide-in from right */ }}>
      <SystemSection settings={settings} onSave={handleSaveSystem} />
      <AuthenticationSection emails={allowedEmails} onAdd={handleAddEmail} onRemove={handleRemoveEmail} />
      <PropertiesSection properties={props} onUpdate={handleUpdateProperty} />
      <NotificationsSection />
      <DangerZone onClearSnapshots={handleClearSnapshots} onRegenerateObligations={handleRegenerate} />
    </div>
  );
}
```

**Responsibilities**:
- Slide in from right (desktop) or full-width (mobile)
- Manage system settings (name, currency, phone code)
- Manage allowed emails for authentication (database-driven)
- Rename properties and change accent colors
- Provide danger zone actions (clear snapshots, regenerate obligations)
- Admin-only access control

---

### Component 4: Enhanced StudentProfile

**Purpose**: Comprehensive student financial drawer with payment history, editing, and statement generation

**Interface**:
```typescript
interface StudentProfileProps {
  student: Student;
  room: Room;
  propName: string;
  onClose: () => void;
  onRecordPay: () => void;
  onRemove: (studentId: string) => void;
  isAdmin: boolean;
}

interface PaymentHistoryItem {
  id: string;
  amount: number;
  date: string;
  method: string;
  receipt: string;
  notes: string;
  month_year: string;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ student, room, propName, onClose, onRecordPay, onRemove, isAdmin }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  
  return (
    <div className="pn-profile-panel">
      <ProfileHeader student={student} room={room} propName={propName} />
      <BalanceCard student={student} room={room} />
      <PaymentTimeline history={paymentHistory} onEdit={handleEdit} onDelete={handleDelete} isAdmin={isAdmin} />
      <QuickRecordPayment onRecord={onRecordPay} />
      <GenerateStatementButton onClick={handleGenerateStatement} />
    </div>
  );
}
```

**Responsibilities**:
- Display student header with name, property+room badge, status, check-in date, phone with WhatsApp icon
- Show balance card with current month obligation (due, paid, balance, last payment)
- Render payment history timeline (most recent first, colored dots, full details)
- Enable inline payment editing (Admin only)
- Enable payment deletion with confirmation (Admin only)
- Provide quick record payment button at bottom
- Generate tenant statement (6 months history) as PDF

---

### Component 5: Financials Tab (Reports View)

**Purpose**: Financial ledger view with filtering and quarterly aggregation

**Interface**:
```typescript
interface FinancialsProps {
  props: Property[];
  isAdmin: boolean;
}

interface LedgerEntry {
  studentId: string;
  studentName: string;
  property: string;
  room: string;
  month: string;
  due: number;
  paid: number;
  balance: number;
  status: string;
  lastPayment: string;
}

interface FilterState {
  property: string;
  month: string;
  student: string;
  status: string;
}

const Financials: React.FC<FinancialsProps> = ({ props, isAdmin }) => {
  const [filters, setFilters] = useState<FilterState>({ property: 'ALL', month: currentMonth, student: '', status: 'ALL' });
  const [viewMode, setViewMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  
  return (
    <div>
      <FilterBar filters={filters} onFilterChange={setFilters} />
      <SummaryStrip ledger={ledger} />
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      <LedgerTable ledger={ledger} onEdit={handleEdit} onDelete={handleDelete} isAdmin={isAdmin} />
    </div>
  );
}
```

**Responsibilities**:
- Provide filter bar: Property dropdown, Month picker (last 6 months), Student search, Status filter
- Display ledger table: Student | Property | Room | Month | Due | Paid | Balance | Status | Last Payment | Actions
- Show summary strip: Total records, Sum Due, Sum Paid, Sum Balance, Collection rate
- Toggle between monthly and quarterly view (Q1-Q4 aggregation)
- Convert to card layout on mobile
- Enable payment editing/deletion (Admin only)

---

### Component 6: Enhanced Bar Chart

**Purpose**: Redesigned bar chart with two bars per property (Expected + Collected) or single gold bar at 100%

**Interface**:
```typescript
interface BarChartProps {
  properties: Property[];
}

interface BarData {
  property: string;
  expected: number;
  collected: number;
  accent: string;
}

const BarChart: React.FC<BarChartProps> = ({ properties }) => {
  const barData: BarData[] = properties.map(p => ({
    property: p.name,
    expected: p.expected,
    collected: p.collected,
    accent: T.prop[p.name]?.accent || T.gold
  }));
  
  return (
    <div className="pn-chart-desktop">
      {barData.map(data => (
        <BarGroup key={data.property} data={data} />
      ))}
      <Legend />
    </div>
  );
}
```

**Responsibilities**:
- Render two bars per property: Expected (sky blue #38BDF8 70% opacity) + Collected (amber #F59E0B)
- Use 6px gap between bars
- Display value labels above each bar (10px gap, left/right aligned)
- Show single gold bar with ✓ when collected = expected (100%)
- Maintain minimum height 240px, minimum width 120px per property group
- Switch to horizontal bars on mobile
- Display legend below chart



## Data Models

### Model 1: Settings Table

```typescript
interface Settings {
  id: string;
  key: string;
  value: string;
  category: 'system' | 'auth' | 'property' | 'notification';
  created_at: string;
  updated_at: string;
}

// Example records:
// { key: 'system_name', value: 'Trevis', category: 'system' }
// { key: 'currency_symbol', value: '$', category: 'system' }
// { key: 'country_phone_code', value: '+263', category: 'system' }
// { key: 'allowed_email', value: 'trevisdaradi@gmail.com', category: 'auth' }
```

**Validation Rules**:
- `key` must be unique within category
- `value` is required and non-empty
- `category` must be one of: system, auth, property, notification
- For `allowed_email` keys, value must be valid email format

---

### Model 2: Room (Enhanced)

```typescript
interface Room {
  id: string;
  property_id: string;
  room_number: string;
  bed_capacity: number;
  rent_per_bed: number;
  notes: string;
  is_active: boolean;  // NEW: soft delete flag
  created_at: string;
}
```

**Validation Rules**:
- `is_active` defaults to true
- All queries must filter WHERE is_active = true
- Soft delete: set is_active = false instead of DELETE
- Cannot soft-delete room with active students (check students.status = 'ACTIVE')

---

### Model 3: Payment (Enhanced for Editing)

```typescript
interface Payment {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;  // ISO date string
  payment_method: 'Cash' | 'EcoCash' | 'Bank Transfer' | 'Zipit' | 'Swipe';
  receipt_number: string;
  month_year: string;  // 'YYYY-MM' format
  notes: string;
  recorded_by: string;  // user ID
  created_at: string;
  updated_at: string;  // NEW: track edits
  edited_by: string;   // NEW: user ID who edited
}
```

**Validation Rules**:
- `amount` must be positive number
- `payment_date` must be valid ISO date
- `month_year` derived from payment_date (format: 'YYYY-MM')
- `payment_method` must be one of allowed values
- `updated_at` and `edited_by` set on edit (Admin only)
- Editing a payment triggers obligation recalculation

---

### Model 4: CalendarDay

```typescript
interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  payments: Payment[];
  obligations: Obligation[];
  checkIns: Student[];
  dots: {
    green: boolean;   // has payments
    red: boolean;     // has unpaid obligations
    gold: boolean;    // has check-ins
  };
}
```

**Validation Rules**:
- `date` is always midnight UTC
- `isCurrentMonth` true if date.month === currentMonth
- `isToday` true if date === today
- `dots.green` true if payments.length > 0
- `dots.red` true if obligations with status='OVERDUE' exist
- `dots.gold` true if checkIns.length > 0

---

### Model 5: LedgerEntry

```typescript
interface LedgerEntry {
  studentId: string;
  studentName: string;
  property: string;
  room: string;
  month: string;  // 'May 2026' format
  due: number;
  paid: number;
  balance: number;
  status: 'PAID' | 'PARTIAL' | 'OVERDUE';
  lastPayment: string;  // ISO date or '—'
  actions: {
    canEdit: boolean;
    canDelete: boolean;
  };
}
```

**Validation Rules**:
- `balance` = due - paid (computed)
- `status` = 'PAID' if paid >= due, 'PARTIAL' if paid > 0, else 'OVERDUE'
- `month` formatted as "May 2026" not "2026-05-01"
- `actions.canEdit` and `actions.canDelete` true only if isAdmin
- `lastPayment` is most recent payment date for that student/month

---

### Model 6: TenantStatement

```typescript
interface TenantStatement {
  student: {
    name: string;
    property: string;
    room: string;
    checkInDate: string;
    phone: string;
  };
  period: {
    start: string;  // 6 months ago
    end: string;    // current month
  };
  transactions: {
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  summary: {
    totalDue: number;
    totalPaid: number;
    currentBalance: number;
  };
}
```

**Validation Rules**:
- `period.start` is 6 months before current month
- `period.end` is current month
- `transactions` sorted by date ascending
- Each transaction has running balance
- `summary.currentBalance` = totalDue - totalPaid



## Algorithmic Pseudocode

### Algorithm 1: Calendar Data Aggregation

```typescript
ALGORITHM buildCalendarMonth(month: Date, properties: Property[]): CalendarDay[]
INPUT: month (Date object for first of month), properties (array of Property objects)
OUTPUT: array of CalendarDay objects for the entire month grid

BEGIN
  // Initialize calendar grid (42 cells: 6 rows × 7 days)
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())  // Start on Sunday
  
  const days: CalendarDay[] = []
  const currentDate = new Date(startDate)
  
  // Fetch all payments and obligations for the month range
  const allPayments = await fetchPaymentsForRange(startDate, endDate)
  const allObligations = await fetchObligationsForRange(startDate, endDate)
  const allStudents = properties.flatMap(p => p.rooms.flatMap(r => r.students))
  
  // Build 42-day grid
  FOR i = 0 TO 41 DO
    const dateKey = formatDate(currentDate, 'YYYY-MM-DD')
    
    // Filter data for this specific date
    const dayPayments = allPayments.filter(p => p.payment_date === dateKey)
    const dayObligations = allObligations.filter(o => 
      o.month === formatDate(currentDate, 'YYYY-MM-01') AND o.status === 'OVERDUE'
    )
    const dayCheckIns = allStudents.filter(s => s.check_in_date === dateKey)
    
    // Determine dot colors
    const dots = {
      green: dayPayments.length > 0,
      red: dayObligations.length > 0,
      gold: dayCheckIns.length > 0
    }
    
    days.push({
      date: new Date(currentDate),
      dayOfMonth: currentDate.getDate(),
      isCurrentMonth: currentDate.getMonth() === month.getMonth(),
      isToday: isToday(currentDate),
      payments: dayPayments,
      obligations: dayObligations,
      checkIns: dayCheckIns,
      dots: dots
    })
    
    currentDate.setDate(currentDate.getDate() + 1)
  END FOR
  
  RETURN days
END
```

**Preconditions**:
- `month` is a valid Date object set to first of month
- `properties` array is populated with rooms and students
- Database contains payments and obligations tables

**Postconditions**:
- Returns exactly 42 CalendarDay objects (6 weeks)
- Each day has correct payments, obligations, and check-ins
- Dots are correctly calculated based on data presence
- Days outside current month have isCurrentMonth = false

**Loop Invariants**:
- `currentDate` increments by 1 day each iteration
- `days` array grows by 1 element each iteration
- All dates are in chronological order

---

### Algorithm 2: Payment Edit with Obligation Recalculation

```typescript
ALGORITHM editPayment(paymentId: string, updates: Partial<Payment>, userId: string): Result
INPUT: paymentId (payment UUID), updates (fields to update), userId (editor UUID)
OUTPUT: Result object with success/error

BEGIN
  // Fetch original payment
  const original = await fetchPayment(paymentId)
  IF original IS NULL THEN
    RETURN Error("Payment not found")
  END IF
  
  // Validate updates
  IF updates.amount IS DEFINED AND updates.amount <= 0 THEN
    RETURN Error("Amount must be positive")
  END IF
  
  IF updates.payment_date IS DEFINED AND NOT isValidDate(updates.payment_date) THEN
    RETURN Error("Invalid payment date")
  END IF
  
  // Store old month_year for obligation update
  const oldMonthYear = original.month_year
  const newMonthYear = updates.payment_date 
    ? formatDate(updates.payment_date, 'YYYY-MM')
    : oldMonthYear
  
  // Update payment record
  const updated = await updatePaymentRecord(paymentId, {
    ...updates,
    month_year: newMonthYear,
    updated_at: now(),
    edited_by: userId
  })
  
  // Recalculate obligations for affected months
  IF oldMonthYear !== newMonthYear THEN
    // Payment moved to different month — update both months
    await recalculateObligation(original.student_id, oldMonthYear)
    await recalculateObligation(original.student_id, newMonthYear)
  ELSE
    // Same month — update once
    await recalculateObligation(original.student_id, oldMonthYear)
  END IF
  
  RETURN Success(updated)
END

ALGORITHM recalculateObligation(studentId: string, monthYear: string): void
INPUT: studentId (student UUID), monthYear (YYYY-MM format)
OUTPUT: void (updates database)

BEGIN
  // Sum all payments for this student in this month
  const totalPaid = await sumPayments(studentId, monthYear)
  
  // Get obligation record
  const obligation = await fetchObligation(studentId, monthYear + '-01')
  IF obligation IS NULL THEN
    RETURN  // No obligation exists for this month
  END IF
  
  // Determine new status
  const newStatus = 
    IF totalPaid >= obligation.amount_due THEN 'PAID'
    ELSE IF totalPaid > 0 THEN 'PARTIAL'
    ELSE 'OVERDUE'
  
  // Update obligation
  await updateObligation(obligation.id, {
    amount_paid: totalPaid,
    status: newStatus,
    updated_at: now()
  })
END
```

**Preconditions**:
- `paymentId` exists in payments table
- `userId` is valid admin user
- `updates` contains at least one field to update
- Database has monthly_obligations table with matching records

**Postconditions**:
- Payment record updated with new values
- `updated_at` and `edited_by` fields set
- All affected monthly_obligations recalculated
- If payment date changed, both old and new month obligations updated
- Status correctly reflects new paid amount

**Loop Invariants**:
- N/A (no loops in main algorithm)

---

### Algorithm 3: Soft Delete Room with Student Check

```typescript
ALGORITHM softDeleteRoom(roomId: string, userId: string): Result
INPUT: roomId (room UUID), userId (admin user UUID)
OUTPUT: Result object with success/error

BEGIN
  // Fetch room
  const room = await fetchRoom(roomId)
  IF room IS NULL THEN
    RETURN Error("Room not found")
  END IF
  
  // Check for active students
  const activeStudents = await countActiveStudents(roomId)
  IF activeStudents > 0 THEN
    RETURN Error(`Cannot remove room — ${activeStudents} active students assigned`)
  END IF
  
  // Soft delete: set is_active = false
  await updateRoom(roomId, {
    is_active: false,
    updated_at: now(),
    updated_by: userId
  })
  
  RETURN Success("Room removed successfully")
END

ALGORITHM countActiveStudents(roomId: string): number
INPUT: roomId (room UUID)
OUTPUT: count of active students

BEGIN
  const count = await queryDatabase(`
    SELECT COUNT(*) 
    FROM students 
    WHERE room_id = $1 
      AND status = 'ACTIVE'
  `, [roomId])
  
  RETURN count
END
```

**Preconditions**:
- `roomId` exists in rooms table
- `userId` is valid admin user
- Room has `is_active` column (default true)

**Postconditions**:
- If active students exist, room is NOT deleted and error returned
- If no active students, room.is_active set to false
- Room still exists in database (soft delete)
- All future queries filter WHERE is_active = true

**Loop Invariants**:
- N/A (no loops)

---

### Algorithm 4: Generate Tenant Statement (6 Months)

```typescript
ALGORITHM generateTenantStatement(studentId: string): TenantStatement
INPUT: studentId (student UUID)
OUTPUT: TenantStatement object with 6 months history

BEGIN
  // Fetch student details
  const student = await fetchStudent(studentId)
  const room = await fetchRoom(student.room_id)
  const property = await fetchProperty(room.property_id)
  
  // Calculate period (6 months back)
  const endMonth = new Date()
  const startMonth = new Date()
  startMonth.setMonth(startMonth.getMonth() - 6)
  
  // Fetch obligations and payments for period
  const obligations = await fetchObligationsForPeriod(studentId, startMonth, endMonth)
  const payments = await fetchPaymentsForPeriod(studentId, startMonth, endMonth)
  
  // Build transaction list
  const transactions: Transaction[] = []
  let runningBalance = 0
  
  // Sort all events by date
  const events = [
    ...obligations.map(o => ({ type: 'obligation', date: o.month, amount: o.amount_due })),
    ...payments.map(p => ({ type: 'payment', date: p.payment_date, amount: p.amount }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date))
  
  FOR EACH event IN events DO
    IF event.type === 'obligation' THEN
      runningBalance += event.amount
      transactions.push({
        date: event.date,
        description: `Rent due for ${formatMonth(event.date)}`,
        debit: event.amount,
        credit: 0,
        balance: runningBalance
      })
    ELSE IF event.type === 'payment' THEN
      runningBalance -= event.amount
      transactions.push({
        date: event.date,
        description: `Payment received`,
        debit: 0,
        credit: event.amount,
        balance: runningBalance
      })
    END IF
  END FOR
  
  // Calculate summary
  const totalDue = obligations.reduce((sum, o) => sum + o.amount_due, 0)
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  
  RETURN {
    student: {
      name: student.full_name,
      property: property.name,
      room: room.room_number,
      checkInDate: student.check_in_date,
      phone: student.phone
    },
    period: {
      start: formatDate(startMonth, 'YYYY-MM-DD'),
      end: formatDate(endMonth, 'YYYY-MM-DD')
    },
    transactions: transactions,
    summary: {
      totalDue: totalDue,
      totalPaid: totalPaid,
      currentBalance: totalDue - totalPaid
    }
  }
END
```

**Preconditions**:
- `studentId` exists in students table
- Student has associated room and property
- Database contains obligations and payments for past 6 months

**Postconditions**:
- Returns complete statement with all transactions
- Transactions sorted chronologically
- Running balance calculated correctly
- Summary totals match transaction sums
- Period covers exactly 6 months

**Loop Invariants**:
- `runningBalance` accurately reflects cumulative balance after each transaction
- `transactions` array grows by 1 each iteration
- All transactions maintain chronological order

---

### Algorithm 5: Financial Ledger with Filtering

```typescript
ALGORITHM buildFinancialLedger(filters: FilterState, properties: Property[]): LedgerEntry[]
INPUT: filters (property, month, student, status), properties (all properties)
OUTPUT: array of LedgerEntry objects

BEGIN
  // Determine month range
  const months = filters.month === 'last-6' 
    ? getLast6Months() 
    : [filters.month]
  
  const ledger: LedgerEntry[] = []
  
  // Filter properties
  const filteredProps = filters.property === 'ALL'
    ? properties
    : properties.filter(p => p.id === filters.property)
  
  FOR EACH property IN filteredProps DO
    FOR EACH room IN property.rooms DO
      FOR EACH student IN room.students WHERE student.status === 'ACTIVE' DO
        
        // Apply student name filter
        IF filters.student !== '' AND NOT student.full_name.includes(filters.student) THEN
          CONTINUE
        END IF
        
        FOR EACH month IN months DO
          // Fetch obligation for this student/month
          const obligation = await fetchObligation(student.id, month)
          IF obligation IS NULL THEN
            CONTINUE
          END IF
          
          // Apply status filter
          IF filters.status !== 'ALL' AND obligation.status !== filters.status THEN
            CONTINUE
          END IF
          
          // Get last payment date for this month
          const lastPayment = await getLastPaymentDate(student.id, month)
          
          ledger.push({
            studentId: student.id,
            studentName: student.full_name,
            property: property.name,
            room: room.room_number,
            month: formatMonth(month),  // "May 2026"
            due: obligation.amount_due,
            paid: obligation.amount_paid,
            balance: obligation.balance,
            status: obligation.status,
            lastPayment: lastPayment || '—',
            actions: {
              canEdit: isAdmin,
              canDelete: isAdmin
            }
          })
        END FOR
      END FOR
    END FOR
  END FOR
  
  RETURN ledger
END
```

**Preconditions**:
- `filters` contains valid property ID, month, student name, and status
- `properties` array is fully populated with rooms and students
- Database contains monthly_obligations and payments tables

**Postconditions**:
- Returns ledger entries matching all filter criteria
- Each entry has correct due, paid, balance, and status
- Entries sorted by property, room, student, month
- Actions reflect admin permissions

**Loop Invariants**:
- All entries in `ledger` match filter criteria
- `ledger` array grows only when all filters pass
- Each entry corresponds to exactly one student/month obligation



## Key Functions with Formal Specifications

### Function 1: fetchCalendarData()

```typescript
async function fetchCalendarData(
  month: Date, 
  properties: Property[]
): Promise<CalendarDay[]>
```

**Preconditions:**
- `month` is a valid Date object set to first day of month (day = 1)
- `properties` is non-empty array of Property objects
- Database connection is established and authenticated

**Postconditions:**
- Returns array of exactly 42 CalendarDay objects (6 weeks × 7 days)
- Each CalendarDay has valid date, payments, obligations, and checkIns arrays
- Days outside current month have `isCurrentMonth = false`
- Dot colors correctly reflect data presence (green/red/gold)
- No side effects on input parameters

**Loop Invariants:**
- Calendar grid always starts on Sunday before or on first of month
- Each day increments by exactly 24 hours
- All dates are in chronological order

---

### Function 2: updatePaymentWithRecalc()

```typescript
async function updatePaymentWithRecalc(
  paymentId: string,
  updates: Partial<Payment>,
  userId: string
): Promise<Result<Payment>>
```

**Preconditions:**
- `paymentId` exists in payments table
- `userId` is authenticated admin user
- `updates` contains at least one valid field
- If `updates.amount` provided, it must be positive number
- If `updates.payment_date` provided, it must be valid ISO date string

**Postconditions:**
- Payment record updated with new values
- `updated_at` timestamp set to current time
- `edited_by` field set to `userId`
- All affected monthly_obligations recalculated (old month and new month if date changed)
- Obligation status updated to reflect new payment totals
- Returns updated Payment object on success, Error on failure

**Loop Invariants:**
- N/A (no explicit loops, but database triggers maintain obligation consistency)

---

### Function 3: softDeleteRoom()

```typescript
async function softDeleteRoom(
  roomId: string,
  userId: string
): Promise<Result<void>>
```

**Preconditions:**
- `roomId` exists in rooms table
- `userId` is authenticated admin user
- Room has `is_active` column (boolean, default true)

**Postconditions:**
- If room has active students (status='ACTIVE'), returns Error and no changes made
- If room has no active students, `is_active` set to false
- Room record remains in database (soft delete, not hard delete)
- All future queries filter `WHERE is_active = true` automatically
- Returns Success(void) on successful soft delete, Error with message on failure

**Loop Invariants:**
- N/A (single database transaction)

---

### Function 4: generateStatement()

```typescript
async function generateStatement(
  studentId: string
): Promise<TenantStatement>
```

**Preconditions:**
- `studentId` exists in students table
- Student has associated room and property (room_id not null)
- Database contains obligations and payments tables

**Postconditions:**
- Returns TenantStatement covering exactly 6 months (current month + 5 previous)
- Transactions array sorted chronologically (oldest first)
- Each transaction has correct running balance
- Summary totals match sum of all transactions
- Debit transactions (obligations) increase balance
- Credit transactions (payments) decrease balance
- No mutations to database (read-only operation)

**Loop Invariants:**
- Running balance after each transaction = previous balance + debit - credit
- Transactions array maintains chronological order throughout construction
- All transactions belong to the specified student and period

---

### Function 5: buildLedger()

```typescript
async function buildLedger(
  filters: FilterState,
  properties: Property[],
  isAdmin: boolean
): Promise<LedgerEntry[]>
```

**Preconditions:**
- `filters` contains valid property ID (or 'ALL'), month string, student search string, status filter
- `properties` is non-empty array with populated rooms and students
- `isAdmin` is boolean indicating user permissions

**Postconditions:**
- Returns array of LedgerEntry objects matching all filter criteria
- Each entry has correct due, paid, balance (due - paid), and status
- Entries sorted by property name, then room number, then student name, then month
- `actions.canEdit` and `actions.canDelete` set to true only if `isAdmin` is true
- Month formatted as "May 2026" not "2026-05-01"
- Empty array returned if no entries match filters (not null or error)

**Loop Invariants:**
- All entries in result array match filter criteria
- Each entry corresponds to exactly one student/month obligation
- Balance always equals due - paid for each entry

---

### Function 6: injectMobileCSS()

```typescript
function injectMobileCSS(): string
```

**Preconditions:**
- None (pure function)

**Postconditions:**
- Returns CSS string with @media queries for 768px and 480px breakpoints
- CSS includes all mobile-responsive classes:
  - `.pn-sidebar` slide-in behavior
  - `.pn-kpi-grid` 2×2 then 1×1 layout
  - `.pn-prop-grid` single column
  - `.pn-chart-desktop` hidden, `.pn-chart-mobile` shown
  - `.pn-attn-table` hidden, `.pn-attn-cards` shown
  - `.pn-modal-inner` full-width
  - `.pn-header-actions` stacked buttons
- No side effects (pure function)
- CSS is valid and parseable

**Loop Invariants:**
- N/A (no loops)

---

### Function 7: handleRemoveRoom()

```typescript
async function handleRemoveRoom(
  roomId: string,
  propertyName: string
): Promise<void>
```

**Preconditions:**
- `roomId` exists in rooms table
- User is authenticated admin
- Room belongs to property with name `propertyName`

**Postconditions:**
- If room has active students, alert shown and no changes made
- If room has no active students, confirmation dialog shown
- If user confirms, room soft-deleted (is_active = false)
- UI refreshed to hide deleted room
- Toast notification shown on success or error

**Loop Invariants:**
- N/A (single transaction with user confirmation)



## Example Usage

### Example 1: Calendar Navigation and Day Panel

```typescript
// User navigates to Calendar view
const Calendar = ({ props }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Fetch calendar data for current month
  useEffect(() => {
    const days = await fetchCalendarData(currentMonth, props);
    setCalendarDays(days);
  }, [currentMonth, props]);
  
  // Navigate to previous month
  const handlePrevMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonth(prev);
  };
  
  // Navigate to next month
  const handleNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
  };
  
  // Jump to today
  const handleToday = () => {
    setCurrentMonth(new Date());
  };
  
  // Open day panel
  const handleDayClick = (day) => {
    setSelectedDay(day);
  };
  
  return (
    <div>
      <CalendarHeader 
        month={currentMonth}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        onToday={handleToday}
      />
      <CalendarGrid days={calendarDays} onDayClick={handleDayClick} />
      {selectedDay && (
        <DayPanel 
          day={selectedDay} 
          onClose={() => setSelectedDay(null)} 
        />
      )}
    </div>
  );
};
```

---

### Example 2: Edit Payment with Obligation Recalculation

```typescript
// Admin edits a payment in StudentProfile
const handleEditPayment = async (paymentId, updates) => {
  try {
    // Validate amount
    if (updates.amount && updates.amount <= 0) {
      showToast('Amount must be positive', 'error');
      return;
    }
    
    // Update payment
    const result = await updatePaymentWithRecalc(
      paymentId,
      updates,
      user.id
    );
    
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    
    // Refresh payment history
    const history = await getPaymentsByStudent(student.id);
    setPaymentHistory(history);
    
    // Refresh obligations
    await refresh();
    
    showToast('Payment updated successfully', 'success');
    setEditing(null);
  } catch (error) {
    showToast('Failed to update payment', 'error');
  }
};

// Usage in PaymentTimeline component
<PaymentTimeline 
  history={paymentHistory}
  onEdit={handleEditPayment}
  onDelete={handleDeletePayment}
  isAdmin={isAdmin}
/>
```

---

### Example 3: Soft Delete Room with Student Check

```typescript
// Admin clicks "Remove Room" button
const handleRemoveRoom = async (roomId) => {
  try {
    // Check for active students
    const activeCount = await countActiveStudents(roomId);
    
    if (activeCount > 0) {
      alert(`Cannot remove room — ${activeCount} active students assigned. Remove or relocate students first.`);
      return;
    }
    
    // Confirm deletion
    const confirmed = window.confirm(
      `Remove ${room.room_number}? This will soft-delete the room.`
    );
    
    if (!confirmed) return;
    
    // Soft delete
    const result = await softDeleteRoom(roomId, user.id);
    
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    
    // Refresh property data
    await refresh();
    
    showToast('Room removed successfully', 'success');
  } catch (error) {
    showToast('Failed to remove room', 'error');
  }
};

// Render "Remove Room" button (Admin only)
{isAdmin && (
  <button 
    onClick={() => handleRemoveRoom(room.id)}
    style={{ 
      background: T.redDim, 
      color: T.red, 
      border: `1px solid ${T.red}40`,
      padding: '4px 8px',
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 700,
      cursor: 'pointer'
    }}
  >
    Remove Room
  </button>
)}
```

---

### Example 4: Generate Tenant Statement

```typescript
// User clicks "Generate Statement" button in StudentProfile
const handleGenerateStatement = async () => {
  try {
    // Fetch statement data
    const statement = await generateStatement(student.id);
    
    // Create printable HTML
    const printDiv = document.createElement('div');
    printDiv.id = 'tenant-statement';
    printDiv.innerHTML = `
      <style>
        @media print {
          body > *:not(#tenant-statement) { display: none !important; }
          #tenant-statement { display: block !important; }
        }
        #tenant-statement { font-family: Arial, sans-serif; padding: 32px; }
        #tenant-statement h1 { font-size: 22px; margin-bottom: 16px; }
        #tenant-statement table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        #tenant-statement th { background: #f5f5f5; padding: 8px; text-align: left; }
        #tenant-statement td { padding: 8px; border-bottom: 1px solid #ddd; }
      </style>
      <h1>Tenant Statement</h1>
      <div><strong>${statement.student.name}</strong></div>
      <div>${statement.student.property} · ${statement.student.room}</div>
      <div>Period: ${formatDate(statement.period.start)} to ${formatDate(statement.period.end)}</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          ${statement.transactions.map(t => `
            <tr>
              <td>${formatDate(t.date)}</td>
              <td>${t.description}</td>
              <td>${t.debit > 0 ? fmt(t.debit) : '—'}</td>
              <td>${t.credit > 0 ? fmt(t.credit) : '—'}</td>
              <td>${fmt(t.balance)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div><strong>Summary</strong></div>
      <div>Total Due: ${fmt(statement.summary.totalDue)}</div>
      <div>Total Paid: ${fmt(statement.summary.totalPaid)}</div>
      <div>Current Balance: ${fmt(statement.summary.currentBalance)}</div>
    `;
    
    document.body.appendChild(printDiv);
    window.print();
    setTimeout(() => document.body.removeChild(printDiv), 1000);
    
  } catch (error) {
    showToast('Failed to generate statement', 'error');
  }
};
```

---

### Example 5: Financial Ledger with Filtering

```typescript
// Financials tab in Reports view
const Financials = ({ props, isAdmin }) => {
  const [filters, setFilters] = useState({
    property: 'ALL',
    month: getCurrentMonth(),
    student: '',
    status: 'ALL'
  });
  const [ledger, setLedger] = useState([]);
  const [viewMode, setViewMode] = useState('monthly');
  
  // Fetch ledger data when filters change
  useEffect(() => {
    const fetchLedger = async () => {
      const entries = await buildLedger(filters, props, isAdmin);
      setLedger(entries);
    };
    fetchLedger();
  }, [filters, props, isAdmin]);
  
  // Calculate summary
  const summary = useMemo(() => ({
    totalRecords: ledger.length,
    sumDue: ledger.reduce((sum, e) => sum + e.due, 0),
    sumPaid: ledger.reduce((sum, e) => sum + e.paid, 0),
    sumBalance: ledger.reduce((sum, e) => sum + e.balance, 0),
    collectionRate: ledger.reduce((sum, e) => sum + e.due, 0) > 0
      ? ((ledger.reduce((sum, e) => sum + e.paid, 0) / ledger.reduce((sum, e) => sum + e.due, 0)) * 100).toFixed(1)
      : '0.0'
  }), [ledger]);
  
  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} />
      <SummaryStrip summary={summary} />
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      <LedgerTable 
        ledger={ledger} 
        onEdit={handleEditPayment}
        onDelete={handleDeletePayment}
        isAdmin={isAdmin}
      />
    </div>
  );
};
```

---

### Example 6: Mobile Responsive Chart

```typescript
// Enhanced bar chart with mobile horizontal layout
const BarChart = ({ properties }) => {
  return (
    <>
      {/* Desktop: vertical grouped bars */}
      <div className="pn-chart-desktop" style={{ display: 'flex', gap: 32, alignItems: 'flex-end', height: 240 }}>
        {properties.map(p => {
          const ac = T.prop[p.name] || { accent: T.gold };
          const maxVal = Math.max(...properties.map(x => Math.max(x.expected, x.collected)), 1);
          const ePct = Math.max(2, (p.expected / maxVal) * 100);
          const cPct = Math.max(2, (p.collected / maxVal) * 100);
          const is100 = p.expected > 0 && p.collected >= p.expected;
          
          return (
            <div key={p.name} style={{ flex: 1, textAlign: 'center', minWidth: 120 }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'flex-end', height: 200 }}>
                {is100 ? (
                  <div style={{ width: 28, height: `${cPct}%`, background: ac.accent, borderRadius: '4px 4px 0 0', position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: ac.accent, paddingBottom: 10 }}>
                      ✓ {fmt(p.collected)}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 18, height: `${ePct}%`, background: '#38BDF8B3', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                      <div style={{ position: 'absolute', bottom: '100%', left: 0, fontSize: 9, color: T.muted, paddingBottom: 10 }}>
                        {fmt(p.expected)}
                      </div>
                    </div>
                    <div style={{ width: 18, height: `${cPct}%`, background: T.amber, borderRadius: '4px 4px 0 0', position: 'relative' }}>
                      <div style={{ position: 'absolute', bottom: '100%', right: 0, fontSize: 9, fontWeight: 600, color: T.amber, paddingBottom: 10 }}>
                        {fmt(p.collected)}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 10 }}>{p.name}</div>
            </div>
          );
        })}
      </div>
      
      {/* Mobile: horizontal bars */}
      <div className="pn-chart-mobile" style={{ display: 'none', flexDirection: 'column', gap: 16 }}>
        {properties.map(p => {
          const ac = T.prop[p.name] || { accent: T.gold };
          const maxVal = Math.max(...properties.map(x => Math.max(x.expected, x.collected)), 1);
          const ePct = Math.max(3, (p.expected / maxVal) * 100);
          const cPct = Math.max(3, (p.collected / maxVal) * 100);
          
          return (
            <div key={p.name + 'm'}>
              <div style={{ fontSize: 11, color: T.text, fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ height: 12, width: `${ePct}%`, background: '#38BDF8B3', borderRadius: 3, minWidth: 20 }} />
                  <span style={{ fontSize: 10, color: T.muted }}>{fmt(p.expected)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ height: 12, width: `${cPct}%`, background: T.amber, borderRadius: 3, minWidth: 20 }} />
                  <span style={{ fontSize: 10, color: T.amber, fontWeight: 600 }}>{fmt(p.collected)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.muted }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#38BDF8B3', display: 'inline-block' }} /> Expected
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.amber }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: T.amber, display: 'inline-block' }} /> Collected
        </span>
      </div>
    </>
  );
};
```



## Correctness Properties

### Property 1: Calendar Grid Completeness
**∀ month ∈ Months**: `buildCalendarMonth(month, properties).length === 42`

The calendar grid always contains exactly 42 days (6 weeks × 7 days), ensuring consistent layout regardless of month length or starting day.

---

### Property 2: Payment Edit Obligation Consistency
**∀ payment ∈ Payments, updates ∈ Updates**: 
```
updatePaymentWithRecalc(payment.id, updates, userId) ⟹ 
  ∑(payments for student/month) === obligation.amount_paid
```

After editing any payment, the sum of all payments for that student/month always equals the obligation's amount_paid field.

---

### Property 3: Soft Delete Preservation
**∀ room ∈ Rooms**: 
```
softDeleteRoom(room.id, userId) ⟹ 
  (room.is_active === false) ∧ (room still exists in database)
```

Soft-deleting a room sets is_active to false but preserves the record in the database, enabling potential recovery.

---

### Property 4: Active Student Blocking
**∀ room ∈ Rooms**: 
```
(∃ student ∈ room.students: student.status === 'ACTIVE') ⟹ 
  softDeleteRoom(room.id, userId) returns Error
```

Any room with at least one active student cannot be soft-deleted, ensuring data integrity.

---

### Property 5: Statement Transaction Balance
**∀ statement ∈ TenantStatements, i ∈ [0, statement.transactions.length)**:
```
statement.transactions[i].balance === 
  statement.transactions[i-1].balance + 
  statement.transactions[i].debit - 
  statement.transactions[i].credit
```

Each transaction's balance equals the previous balance plus debits minus credits, maintaining accurate running balance.

---

### Property 6: Ledger Filter Correctness
**∀ entry ∈ buildLedger(filters, properties, isAdmin)**:
```
(filters.property === 'ALL' ∨ entry.property === filters.property) ∧
(filters.status === 'ALL' ∨ entry.status === filters.status) ∧
(filters.student === '' ∨ entry.studentName.includes(filters.student))
```

Every ledger entry matches all active filter criteria, ensuring accurate filtered results.

---

### Property 7: Mobile CSS Injection Idempotence
**∀ n ∈ ℕ**: `injectMobileCSS() === injectMobileCSS()`

Calling the mobile CSS injection function multiple times produces identical output, ensuring consistent styling.

---

### Property 8: Calendar Dot Accuracy
**∀ day ∈ CalendarDays**:
```
day.dots.green === (day.payments.length > 0) ∧
day.dots.red === (∃ o ∈ day.obligations: o.status === 'OVERDUE') ∧
day.dots.gold === (day.checkIns.length > 0)
```

Calendar dot colors accurately reflect the presence of payments (green), overdue obligations (red), and check-ins (gold).

---

### Property 9: Obligation Status Derivation
**∀ obligation ∈ MonthlyObligations**:
```
obligation.status === 
  if obligation.amount_paid >= obligation.amount_due then 'PAID'
  else if obligation.amount_paid > 0 then 'PARTIAL'
  else 'OVERDUE'
```

Obligation status is always correctly derived from the relationship between amount_paid and amount_due.

---

### Property 10: Admin-Only Actions
**∀ action ∈ {editPayment, deletePayment, removeRoom, manageSettings}**:
```
action.execute() ⟹ user.role === 'ADMIN'
```

All destructive or sensitive actions (edit payment, delete payment, remove room, manage settings) require admin role.

---

### Property 11: Month Format Consistency
**∀ entry ∈ LedgerEntries**:
```
entry.month matches /^[A-Z][a-z]+ \d{4}$/ 
```

All month displays use human-readable format "May 2026" not machine format "2026-05-01".

---

### Property 12: Statement Period Coverage
**∀ statement ∈ TenantStatements**:
```
statement.period.end - statement.period.start === 6 months ∧
statement.transactions[0].date >= statement.period.start ∧
statement.transactions[last].date <= statement.period.end
```

Tenant statements always cover exactly 6 months, and all transactions fall within that period.

---

### Property 13: Responsive Breakpoint Consistency
**∀ viewport ∈ Viewports**:
```
(viewport.width <= 768px) ⟹ mobile styles applied ∧
(viewport.width <= 480px) ⟹ extra-small mobile styles applied
```

Mobile styles activate at correct breakpoints (768px and 480px), ensuring responsive behavior.

---

### Property 14: Payment Edit Audit Trail
**∀ payment ∈ Payments**: 
```
(payment.updated_at !== null) ⟹ 
  (payment.edited_by !== null ∧ payment.updated_at > payment.created_at)
```

Any edited payment has both updated_at timestamp and edited_by user ID, maintaining complete audit trail.

---

### Property 15: Settings Email Validation
**∀ setting ∈ Settings where setting.key === 'allowed_email'**:
```
setting.value matches /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

All allowed email settings contain valid email addresses matching standard email regex pattern.



## Error Handling

### Error Scenario 1: Payment Edit with Invalid Amount

**Condition**: Admin attempts to edit payment with zero or negative amount

**Response**: 
- Validate amount before database update
- Return error: "Amount must be positive"
- Display toast notification with error message
- Keep edit form open with invalid value highlighted
- No database changes made

**Recovery**: 
- User corrects amount to positive value
- Resubmit edit form
- Validation passes and payment updated

---

### Error Scenario 2: Room Deletion with Active Students

**Condition**: Admin attempts to remove room that has active students assigned

**Response**:
- Query database for active students before soft delete
- If count > 0, return error: "Cannot remove room — {count} active students assigned"
- Display alert dialog with error message
- Suggest: "Remove or relocate students first"
- No database changes made

**Recovery**:
- Admin removes or relocates all active students from room
- Retry room deletion
- Validation passes and room soft-deleted

---

### Error Scenario 3: Calendar Data Fetch Failure

**Condition**: Network error or database timeout when fetching calendar data

**Response**:
- Catch fetch error in try-catch block
- Display error message: "Failed to load calendar data"
- Show retry button in calendar view
- Log error to console for debugging
- Maintain previous calendar state if available

**Recovery**:
- User clicks retry button
- Re-fetch calendar data
- On success, render calendar grid
- On repeated failure, suggest checking connection

---

### Error Scenario 4: Statement Generation with Missing Data

**Condition**: Student has no obligations or payments for 6-month period

**Response**:
- Generate statement with empty transactions array
- Display message: "No financial activity in the past 6 months"
- Show student header and period information
- Summary shows all zeros (totalDue: 0, totalPaid: 0, currentBalance: 0)
- Statement still printable

**Recovery**:
- No recovery needed (valid state)
- User can close statement or print empty version

---

### Error Scenario 5: Filter Produces No Results

**Condition**: Financial ledger filters match zero entries

**Response**:
- Return empty array from buildLedger()
- Display message: "No entries match your filter criteria"
- Show current filter values
- Suggest: "Try adjusting your filters"
- Summary strip shows all zeros

**Recovery**:
- User adjusts filters (change property, month, status, or clear student search)
- Ledger re-fetches with new filters
- Display matching entries

---

### Error Scenario 6: Settings Update Failure

**Condition**: Database error when updating system settings or allowed emails

**Response**:
- Catch database error in try-catch block
- Display toast: "Failed to update settings"
- Log detailed error to console
- Revert UI to previous state
- No partial updates (transaction rollback)

**Recovery**:
- User retries settings update
- If persistent, check database connection
- Admin can manually update via SQL if needed

---

### Error Scenario 7: Mobile CSS Not Applied

**Condition**: Browser doesn't support @media queries or CSS injection fails

**Response**:
- CSS injection is passive (no error thrown)
- Desktop layout remains functional
- User can still access all features
- Suggest using modern browser (Chrome, Firefox, Safari, Edge)

**Recovery**:
- User switches to supported browser
- Mobile styles apply correctly
- Full responsive experience restored

---

### Error Scenario 8: Payment Deletion with Obligation Impact

**Condition**: Admin deletes payment, causing obligation status to change from PAID to OVERDUE

**Response**:
- Show confirmation dialog: "Deleting this payment will mark obligation as OVERDUE. Continue?"
- If confirmed, delete payment and recalculate obligation
- Update obligation status to OVERDUE
- Display toast: "Payment deleted, obligation updated"
- Refresh student profile and ledger views

**Recovery**:
- If deletion was mistake, admin can re-record payment
- Obligation status recalculates back to PAID

---

### Error Scenario 9: Concurrent Payment Edits

**Condition**: Two admins edit same payment simultaneously

**Response**:
- Use optimistic locking with updated_at timestamp
- Second edit detects timestamp mismatch
- Return error: "Payment was modified by another user"
- Display current payment values
- Suggest: "Refresh and try again"

**Recovery**:
- User refreshes payment data
- Reviews current values
- Reapplies edit if still needed
- Timestamp matches and update succeeds

---

### Error Scenario 10: Invalid Date in Calendar Navigation

**Condition**: User navigates to invalid month (e.g., month 13 or negative year)

**Response**:
- Validate month before fetching data
- Clamp month to valid range (1-12)
- Clamp year to reasonable range (2020-2100)
- Display clamped month in calendar header
- Fetch data for corrected month

**Recovery**:
- Calendar displays valid month
- User can navigate normally
- No error message needed (silent correction)



## Testing Strategy

### Unit Testing Approach

**Key Test Cases**:

1. **Calendar Grid Generation**
   - Test `buildCalendarMonth()` returns exactly 42 days
   - Test first day is always Sunday
   - Test days outside current month have `isCurrentMonth = false`
   - Test today is correctly marked with `isToday = true`
   - Test edge cases: January, December, leap years

2. **Payment Edit Logic**
   - Test valid amount updates succeed
   - Test zero/negative amounts rejected
   - Test date change triggers two obligation recalculations
   - Test same-month edit triggers one recalculation
   - Test audit fields (updated_at, edited_by) set correctly

3. **Soft Delete Room**
   - Test room with active students returns error
   - Test room with no students soft-deletes successfully
   - Test is_active set to false, record preserved
   - Test queries filter WHERE is_active = true

4. **Statement Generation**
   - Test 6-month period calculation
   - Test transaction sorting (chronological)
   - Test running balance calculation
   - Test summary totals match transaction sums
   - Test empty statement (no transactions)

5. **Ledger Filtering**
   - Test property filter (ALL vs specific)
   - Test month filter (single vs last 6)
   - Test student search (partial match)
   - Test status filter (ALL, PAID, PARTIAL, OVERDUE)
   - Test combined filters

6. **Mobile CSS Injection**
   - Test CSS string contains @media queries
   - Test all mobile classes present
   - Test CSS is valid and parseable
   - Test idempotence (multiple calls produce same output)

**Coverage Goals**:
- 90%+ code coverage for business logic
- 100% coverage for financial calculations
- 100% coverage for data validation

---

### Property-Based Testing Approach

**Property Test Library**: fast-check (JavaScript/TypeScript)

**Property Tests**:

1. **Calendar Grid Properties**
   ```typescript
   fc.assert(
     fc.property(fc.date(), fc.array(fc.record(propertySchema)), (month, props) => {
       const days = buildCalendarMonth(month, props);
       return days.length === 42 && 
              days[0].date.getDay() === 0 &&  // First day is Sunday
              days.every((d, i) => i === 0 || d.date > days[i-1].date);  // Chronological
     })
   );
   ```

2. **Payment Edit Obligation Consistency**
   ```typescript
   fc.assert(
     fc.property(
       fc.uuid(), 
       fc.record({ amount: fc.double({ min: 0.01, max: 10000 }) }), 
       fc.uuid(),
       async (paymentId, updates, userId) => {
         await updatePaymentWithRecalc(paymentId, updates, userId);
         const payments = await fetchPaymentsForStudent(studentId, monthYear);
         const obligation = await fetchObligation(studentId, monthYear);
         const sum = payments.reduce((s, p) => s + p.amount, 0);
         return Math.abs(sum - obligation.amount_paid) < 0.01;  // Float tolerance
       }
     )
   );
   ```

3. **Statement Balance Invariant**
   ```typescript
   fc.assert(
     fc.property(fc.uuid(), async (studentId) => {
       const statement = await generateStatement(studentId);
       return statement.transactions.every((t, i) => {
         if (i === 0) return true;
         const prevBalance = statement.transactions[i-1].balance;
         const expectedBalance = prevBalance + t.debit - t.credit;
         return Math.abs(t.balance - expectedBalance) < 0.01;
       });
     })
   );
   ```

4. **Ledger Filter Correctness**
   ```typescript
   fc.assert(
     fc.property(
       fc.record({
         property: fc.oneof(fc.constant('ALL'), fc.uuid()),
         status: fc.oneof(fc.constant('ALL'), fc.constantFrom('PAID', 'PARTIAL', 'OVERDUE')),
         student: fc.string()
       }),
       fc.array(fc.record(propertySchema)),
       async (filters, props) => {
         const ledger = await buildLedger(filters, props, true);
         return ledger.every(entry => 
           (filters.property === 'ALL' || entry.property === filters.property) &&
           (filters.status === 'ALL' || entry.status === filters.status) &&
           (filters.student === '' || entry.studentName.includes(filters.student))
         );
       }
     )
   );
   ```

5. **Soft Delete Idempotence**
   ```typescript
   fc.assert(
     fc.property(fc.uuid(), fc.uuid(), async (roomId, userId) => {
       const result1 = await softDeleteRoom(roomId, userId);
       const result2 = await softDeleteRoom(roomId, userId);
       const room = await fetchRoom(roomId);
       return room.is_active === false && result1.success === result2.success;
     })
   );
   ```

**Property Test Coverage**:
- All financial calculations
- All filter combinations
- All date manipulations
- All state transitions

---

### Integration Testing Approach

**Integration Test Scenarios**:

1. **End-to-End Calendar Flow**
   - Navigate to Calendar view
   - Fetch data for current month
   - Click on date with payments
   - Verify day panel shows correct payments
   - Navigate to next month
   - Verify data updates correctly

2. **Payment Edit Flow**
   - Open student profile
   - Click edit on payment
   - Change amount and date
   - Submit edit
   - Verify payment updated in database
   - Verify obligation recalculated
   - Verify UI refreshed

3. **Room Deletion Flow**
   - Navigate to property detail
   - Expand room with no students
   - Click "Remove Room"
   - Confirm deletion
   - Verify room soft-deleted
   - Verify room hidden from UI
   - Verify queries filter is_active = true

4. **Statement Generation Flow**
   - Open student profile
   - Click "Generate Statement"
   - Verify statement fetches 6 months data
   - Verify transactions sorted chronologically
   - Verify running balance correct
   - Verify print dialog opens
   - Verify PDF generated correctly

5. **Financial Ledger Flow**
   - Navigate to Reports > Financials
   - Apply property filter
   - Apply month filter
   - Apply status filter
   - Verify ledger updates
   - Verify summary strip recalculates
   - Toggle quarterly view
   - Verify aggregation correct

6. **Mobile Responsive Flow**
   - Resize viewport to 768px
   - Verify sidebar slides in
   - Verify tables convert to cards
   - Verify charts switch to horizontal
   - Verify modals go full-width
   - Resize to 480px
   - Verify extra-small styles apply

**Integration Test Tools**:
- Vitest for test runner
- React Testing Library for component testing
- MSW (Mock Service Worker) for API mocking
- Playwright for E2E browser testing

**Coverage Goals**:
- 100% coverage of critical user flows
- All admin actions tested
- All mobile breakpoints tested

