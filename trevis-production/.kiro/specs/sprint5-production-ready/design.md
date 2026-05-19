# Design Document: Sprint 5 — Production-Ready Trevis

## Overview

Sprint 5 transforms Trevis from a functional demo into a production-grade business tool. The core objective is to ensure every data entry point from the original spreadsheet exists in the app, with fast performance, reliable data handling, and full mobile parity. This sprint addresses six critical areas: database performance optimization, student room transfers with audit trails, comprehensive inline data editing, mobile calendar feature parity, proper handling of unassigned bed records, and database health maintenance.

The design follows a layered architecture: database layer (indexes, new tables, views), service layer (new APIs for transfers and edits), component layer (inline editing UI, transfer flows, mobile calendar), and business logic layer (validation, audit trails, balance recalculation). All changes maintain backward compatibility with existing Sprint 4 functionality while adding production-critical features.

## Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Student Profile Drawer]
        B[Payment Modal]
        C[Calendar Component]
        D[Room Management]
        E[Error Boundaries]
    end
    
    subgraph "Service Layer"
        F[studentService]
        G[paymentService]
        H[transferService]
        I[propertyService]
    end
    
    subgraph "Database Layer"
        J[(students)]
        K[(payments)]
        L[(student_transfers)]
        M[(monthly_obligations)]
        N[(rooms)]
        O[Indexes]
        P[Views]
    end
    
    A --> F
    A --> H
    B --> G
    C --> G
    C --> M
    D --> F
    D --> N
    
    F --> J
    G --> K
    H --> L
    H --> J
    H --> M
    I --> N
    
    O -.-> J
    O -.-> K
    O -.-> M
    O -.-> N
    P -.-> J
    P -.-> M
    
    style L fill:#ffd700
    style H fill:#ffd700
    style O fill:#90EE90
    style E fill:#87CEEB


## Main Workflow Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant SP as Student Profile
    participant TS as Transfer Service
    participant PS as Payment Service
    participant DB as Database
    participant RC as Recalculate Engine
    
    Note over U,RC: SECTION 2: Student Transfer Flow
    U->>SP: Click "Transfer Room"
    SP->>U: Show Property Selector
    U->>SP: Select Property
    SP->>TS: Get Available Rooms
    TS->>DB: Query rooms with capacity
    DB-->>TS: Available rooms list
    TS-->>SP: Display rooms with bed counts
    U->>SP: Select Room + Confirm
    SP->>TS: Execute Transfer
    TS->>DB: Insert student_transfers record
    TS->>DB: Update student.room_id
    TS->>DB: Update monthly_obligation (if rent changed)
    DB-->>TS: Transfer complete
    TS-->>SP: Success
    SP->>U: Show transfer confirmation
    
    Note over U,RC: SECTION 3: Payment Edit Flow
    U->>SP: Edit payment date
    SP->>PS: Update payment
    PS->>DB: Update payment record
    PS->>DB: Recalculate month_year
    DB->>RC: Trigger recalculate_balances()
    RC->>DB: Update monthly_obligations
    RC->>DB: Update student statuses
    DB-->>PS: Update complete
    PS-->>SP: Refresh payment history
    SP->>U: Show updated data


## Components and Interfaces

### Section 1: Performance & Reliability

#### Database Indexes

```typescript
interface DatabaseIndex {
  table: string;
  columns: string[];
  indexType: 'btree' | 'hash' | 'gin';
  purpose: string;
}

const performanceIndexes: DatabaseIndex[] = [
  {
    table: 'payments',
    columns: ['student_id', 'month_year'],
    indexType: 'btree',
    purpose: 'Fast payment history queries by student and month'
  },
  {
    table: 'students',
    columns: ['room_id', 'status'],
    indexType: 'btree',
    purpose: 'Fast student lookups by room and active status'
  },
  {
    table: 'monthly_obligations',
    columns: ['student_id', 'month', 'status'],
    indexType: 'btree',
    purpose: 'Fast obligation queries for dashboard and reports'
  },
  {
    table: 'rooms',
    columns: ['property_id', 'is_active'],
    indexType: 'btree',
    purpose: 'Fast room filtering by property'
  }
];
```

**Responsibilities**:
- Reduce query execution time from O(n) to O(log n) for filtered queries
- Enable efficient JOIN operations across students, rooms, and payments
- Support pagination without full table scans

#### Frontend Query Optimization

```typescript
interface OptimizedQuery {
  select: string;
  filters: Record<string, any>;
  pagination?: { limit: number; offset: number };
  orderBy?: { column: string; ascending: boolean };
}

// Selective column queries - only fetch what's needed
const studentListQuery: OptimizedQuery = {
  select: 'id, full_name, phone, status, room_id, rooms(room_number, rent_per_bed)',
  filters: { 'rooms.is_active': true, 'status': 'ACTIVE' },
  pagination: { limit: 50, offset: 0 },
  orderBy: { column: 'full_name', ascending: true }
};

// On-demand loading for heavy data
const studentDetailQuery: OptimizedQuery = {
  select: '*, rooms(*, properties(*)), payments(*), monthly_obligations(*)',
  filters: { id: 'student-uuid' }
};
```

**Responsibilities**:
- Reduce payload size by 60-70% through selective column queries
- Implement pagination for lists exceeding 50 items
- Load payment history and obligations only when Student Profile opens
- Cache property data in React Context to avoid repeated fetches

#### Error Boundaries

```typescript
interface ErrorBoundaryProps {
  componentName: string;
  fallback: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ComponentErrorBoundary extends React.Component<ErrorBoundaryProps> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.componentName}] Error:`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

**Components requiring error boundaries**:
- Dashboard (property summary cards)
- PropertyDetail (room and student lists)
- Students (student table and search)
- Reports (financial reports and exports)
- Calendar (calendar grid and day panel)
- Finances (payment recording and history)



### Section 2: Student Transfer Between Rooms

#### Transfer Service Interface

```typescript
interface TransferService {
  getAvailableRooms(propertyId: string): Promise<AvailableRoom[]>;
  executeTransfer(transfer: TransferRequest): Promise<TransferResult>;
  getTransferHistory(studentId: string): Promise<Transfer[]>;
}

interface AvailableRoom {
  id: string;
  roomNumber: string;
  bedCapacity: number;
  occupiedBeds: number;
  availableBeds: number;
  rentPerBed: number;
  propertyName: string;
}

interface TransferRequest {
  studentId: string;
  fromRoomId: string;
  toRoomId: string;
  transferDate: string; // ISO date
  reason?: string;
  performedBy: string; // user email
}

interface TransferResult {
  success: boolean;
  transferId?: string;
  obligationUpdated: boolean;
  error?: string;
}

interface Transfer {
  id: string;
  studentId: string;
  fromRoomId: string;
  toRoomId: string;
  fromRoomNumber: string;
  toRoomNumber: string;
  fromPropertyName: string;
  toPropertyName: string;
  transferDate: string;
  reason?: string;
  performedBy: string;
  createdAt: string;
}
```

**Responsibilities**:
- Query rooms with available bed capacity across all properties
- Validate transfer eligibility (target room has space, student is active)
- Create audit trail in student_transfers table
- Update student.room_id atomically
- Update current month obligation if rent amount changed
- Return detailed transfer history for Student Profile display

#### Transfer UI Flow

```typescript
interface TransferFlowState {
  step: 'property' | 'room' | 'confirm';
  selectedProperty: string | null;
  selectedRoom: AvailableRoom | null;
  reason: string;
  loading: boolean;
}

interface TransferButtonProps {
  student: Student;
  currentRoom: Room;
  currentProperty: string;
  onTransferComplete: () => void;
  isAdmin: boolean;
}
```

**3-Step Inline Flow**:
1. **Property Selector**: Dropdown showing all properties with available beds
2. **Room Selector**: Dropdown showing rooms in selected property with "X beds free — $Y/bed" labels
3. **Confirmation Card**: Summary showing from/to details, rent change warning if applicable, optional reason field



### Section 3: Full Data Entry — Every Field Editable

#### Inline Editing Interface

```typescript
interface InlineEditField {
  field: string;
  value: any;
  type: 'text' | 'phone' | 'date' | 'number' | 'select' | 'textarea';
  validation?: (value: any) => boolean;
  onSave: (newValue: any) => Promise<void>;
}

interface EditableStudentProfile {
  fullName: InlineEditField;
  phone: InlineEditField;
  nationalId: InlineEditField;
  emergencyContactName: InlineEditField;
  emergencyContactPhone: InlineEditField;
  checkInDate: InlineEditField;
  paymentPlan: InlineEditField;
  notes: InlineEditField;
  status: InlineEditField;
}

interface EditablePayment {
  paymentDate: InlineEditField;
  amount: InlineEditField;
  paymentMethod: InlineEditField;
  receiptNumber: InlineEditField;
  notes: InlineEditField;
}

interface EditableRoom {
  roomNumber: InlineEditField;
  bedCapacity: InlineEditField;
  rentPerBed: InlineEditField;
  notes: InlineEditField;
}
```

**Responsibilities**:
- Provide inline editing for all student profile fields
- Enable payment history editing with date change warnings
- Support room detail editing (Admin only)
- Auto-save on blur with optimistic UI updates
- Show amber warning for backdated payment edits
- Trigger balance recalculation when payment date/amount changes

#### Payment Edit Service

```typescript
interface PaymentEditService {
  updatePayment(
    paymentId: string,
    updates: Partial<Payment>,
    userId: string
  ): Promise<{ success: boolean; error?: string }>;
  
  deletePayment(
    paymentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }>;
  
  recalculateBalances(): Promise<void>;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Cash' | 'EcoCash' | 'Bank Transfer' | 'Zipit' | 'Swipe';
  receiptNumber?: string;
  monthYear: string; // Auto-calculated from paymentDate
  notes?: string;
  recordedBy: string;
  updatedAt?: string;
  editedBy?: string;
}
```

**Validation Rules**:
- Payment date cannot be in the future
- Amount must be positive number
- Payment method must be one of allowed values
- Month_year auto-updates when payment_date changes
- Backdated payments (prior month) show amber warning



### Section 4: Mobile Calendar = Desktop Calendar

#### Mobile Calendar Grid Interface

```typescript
interface MobileCalendarCell {
  dayNum: number | null;
  date: Date | null;
  isToday: boolean;
  hasPayments: boolean;
  hasCheckins: boolean;
  hasObligations: boolean;
  paymentCount: number;
  checkinCount: number;
  obligationCount: number;
}

interface MobileCalendarGrid {
  cells: MobileCalendarCell[];
  weekDays: string[];
  monthLabel: string;
  onDayClick: (cell: MobileCalendarCell) => void;
}

interface MobileDayPanel {
  date: Date;
  payments: PaymentEvent[];
  obligations: ObligationEvent[];
  checkins: CheckinEvent[];
  isOpen: boolean;
  onClose: () => void;
}
```

**Mobile Calendar Requirements**:
- Full 7-column month grid (42 cells = 6 weeks)
- Minimum touch target: 44px × 44px per cell
- Payment dots (green), overdue dots (red), check-in dots (gold)
- Day panel slides up as bottom sheet (70% screen height)
- Drag handle at top of bottom sheet
- Swipe down to close gesture support

#### Responsive Breakpoints

```typescript
const BREAKPOINTS = {
  mobile: '(max-width: 768px)',
  tablet: '(min-width: 769px) and (max-width: 1024px)',
  desktop: '(min-width: 1025px)'
};

interface ResponsiveCalendarStyles {
  mobile: {
    gridColumns: 'repeat(7, 1fr)',
    cellMinHeight: '44px',
    cellPadding: '4px',
    fontSize: '11px',
    dotSize: '5px'
  };
  desktop: {
    gridColumns: 'repeat(7, 1fr)',
    cellMinHeight: '90px',
    cellPadding: '8px',
    fontSize: '13px',
    dotSize: '6px'
  };
}
```

**Responsibilities**:
- Replace mobile calendar override with full month grid
- Ensure touch targets meet accessibility standards (44px minimum)
- Display all event indicators exactly as desktop
- Implement bottom sheet with smooth slide-up animation
- Support swipe gestures for closing day panel



### Section 5: Unassigned Student Handling

#### Unassigned Record Interface

```typescript
interface UnassignedRecord {
  id: string;
  fullName: string; // Format: "UNASSIGNED-{room_id}-{bed_number}"
  status: 'VACANT';
  roomId: string;
  isUnassigned: boolean; // Computed: fullName.startsWith('UNASSIGNED')
}

interface UnassignedDisplayProps {
  record: UnassignedRecord;
  room: Room;
  property: Property;
  onAssignStudent: (roomId: string) => void;
}
```

**Display Rules**:
- Show as "Empty bed" with grey VACANT badge
- "+ Assign Student" button pre-fills Add Student wizard with room
- Filter out from Students list: `WHERE full_name NOT LIKE 'UNASSIGNED%'`
- Filter out from Finances view
- Filter out from Arrears report
- Filter out from all Reports
- Include in room capacity calculations (occupied beds count)

#### Query Filters

```typescript
const UNASSIGNED_FILTER = "full_name NOT LIKE 'UNASSIGNED%'";

interface QueryWithUnassignedFilter {
  baseQuery: string;
  filters: string[];
  includeUnassigned: boolean;
}

// Example: Students list query
const studentsListQuery: QueryWithUnassignedFilter = {
  baseQuery: 'SELECT * FROM students',
  filters: [
    'status = ACTIVE',
    'rooms.is_active = true',
    UNASSIGNED_FILTER
  ],
  includeUnassigned: false
};

// Example: Room capacity query (includes UNASSIGNED)
const roomCapacityQuery: QueryWithUnassignedFilter = {
  baseQuery: 'SELECT COUNT(*) FROM students WHERE room_id = ?',
  filters: ['status != VACATED'],
  includeUnassigned: true // Count UNASSIGNED as occupied beds
};
```

**Responsibilities**:
- Distinguish UNASSIGNED records from real students in all views
- Provide clear UI for assigning students to empty beds
- Maintain accurate room capacity calculations
- Exclude UNASSIGNED from financial calculations and reports



### Section 6: Database Health

#### Health Check Interface

```typescript
interface DatabaseHealthCheck {
  checkMissingCheckInDates(): Promise<HealthCheckResult>;
  checkOrphanedObligations(): Promise<HealthCheckResult>;
  checkMissingCurrentMonthObligations(): Promise<HealthCheckResult>;
  generateMissingObligations(): Promise<GenerationResult>;
  cleanupOrphanedRecords(): Promise<CleanupResult>;
}

interface HealthCheckResult {
  passed: boolean;
  issueCount: number;
  details: string[];
  affectedRecords: string[];
}

interface GenerationResult {
  success: boolean;
  obligationsCreated: number;
  studentsProcessed: number;
  errors: string[];
}

interface CleanupResult {
  success: boolean;
  recordsDeleted: number;
  tablesAffected: string[];
}
```

**Health Checks**:
1. **Missing Check-in Dates**: Find students without check_in_date, use created_at as fallback
2. **Orphaned Obligations**: Find monthly_obligations where student_id doesn't exist in students table
3. **Missing Current Month Obligations**: Find active students without obligation record for current month
4. **View Accuracy**: Verify v_property_summary excludes UNASSIGNED students

#### Database Maintenance Functions

```sql
-- Function: Add missing check-in dates
CREATE OR REPLACE FUNCTION fix_missing_checkin_dates()
RETURNS TABLE (student_id uuid, updated_date date) AS $$
BEGIN
  RETURN QUERY
  UPDATE students
  SET check_in_date = created_at::date
  WHERE check_in_date IS NULL
    AND status = 'ACTIVE'
    AND full_name NOT LIKE 'UNASSIGNED%'
  RETURNING id, check_in_date;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate missing current month obligations
CREATE OR REPLACE FUNCTION generate_missing_obligations()
RETURNS TABLE (student_id uuid, month date, amount_due numeric) AS $$
DECLARE
  current_month date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  RETURN QUERY
  INSERT INTO monthly_obligations (student_id, month, amount_due, amount_paid, status, due_date)
  SELECT 
    s.id,
    current_month,
    r.rent_per_bed,
    0,
    'OVERDUE',
    current_month
  FROM students s
  JOIN rooms r ON r.id = s.room_id
  WHERE s.status = 'ACTIVE'
    AND s.full_name NOT LIKE 'UNASSIGNED%'
    AND NOT EXISTS (
      SELECT 1 FROM monthly_obligations mo
      WHERE mo.student_id = s.id AND mo.month = current_month
    )
  ON CONFLICT (student_id, month) DO NOTHING
  RETURNING student_id, month, amount_due;
END;
$$ LANGUAGE plpgsql;

-- Function: Clean up orphaned obligations
CREATE OR REPLACE FUNCTION cleanup_orphaned_obligations()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM monthly_obligations
  WHERE student_id NOT IN (SELECT id FROM students);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**Responsibilities**:
- Ensure all active students have check_in_date
- Generate obligations for current month for all active students
- Remove orphaned obligation records
- Update v_property_summary view to exclude UNASSIGNED students
- Provide health check dashboard for admins



## Data Models

### student_transfers Table

```sql
CREATE TABLE student_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_room_id uuid NOT NULL REFERENCES rooms(id),
  to_room_id uuid NOT NULL REFERENCES rooms(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_rooms CHECK (from_room_id != to_room_id)
);

CREATE INDEX idx_transfers_student ON student_transfers(student_id);
CREATE INDEX idx_transfers_date ON student_transfers(transfer_date);
```

**Validation Rules**:
- from_room_id and to_room_id must be different
- student_id must exist and be ACTIVE
- to_room_id must have available bed capacity
- transfer_date cannot be in the future

### Updated v_property_summary View

```sql
CREATE OR REPLACE VIEW v_property_summary AS
SELECT
  p.id as property_id,
  p.name as property_name,
  p.color_accent,
  COUNT(DISTINCT r.id) as room_count,
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.status = 'ACTIVE' 
    AND s.full_name NOT LIKE 'UNASSIGNED%'
  ) as active_students,
  COALESCE(SUM(mo.amount_due), 0) as expected,
  COALESCE(SUM(mo.amount_paid), 0) as collected,
  COALESCE(SUM(mo.amount_due - mo.amount_paid), 0) as arrears,
  COUNT(*) FILTER (
    WHERE mo.status = 'OVERDUE' 
    AND s.status = 'ACTIVE'
    AND s.full_name NOT LIKE 'UNASSIGNED%'
  ) as overdue_count
FROM properties p
LEFT JOIN rooms r ON r.property_id = p.id AND r.is_active = true
LEFT JOIN students s ON s.room_id = r.id 
  AND s.status = 'ACTIVE'
  AND s.full_name NOT LIKE 'UNASSIGNED%'
LEFT JOIN monthly_obligations mo
  ON mo.student_id = s.id
  AND mo.month = date_trunc('month', CURRENT_DATE)::date
GROUP BY p.id, p.name, p.color_accent;
```

### Performance Indexes

```sql
-- Payments table indexes
CREATE INDEX idx_payments_student_month ON payments(student_id, month_year);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_method ON payments(payment_method);

-- Students table indexes
CREATE INDEX idx_students_room_status ON students(room_id, status);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_checkin ON students(check_in_date);

-- Monthly obligations indexes
CREATE INDEX idx_obligations_student_month ON monthly_obligations(student_id, month);
CREATE INDEX idx_obligations_status ON monthly_obligations(status);
CREATE INDEX idx_obligations_month ON monthly_obligations(month);

-- Rooms table indexes
CREATE INDEX idx_rooms_property_active ON rooms(property_id, is_active);
```



## Algorithmic Pseudocode

### Algorithm 1: Execute Student Transfer

```pascal
ALGORITHM executeStudentTransfer(transferRequest)
INPUT: transferRequest of type TransferRequest
OUTPUT: result of type TransferResult

PRECONDITIONS:
  - transferRequest.studentId exists in students table
  - transferRequest.toRoomId exists in rooms table
  - transferRequest.fromRoomId != transferRequest.toRoomId
  - Student status is ACTIVE
  - Target room has available bed capacity

POSTCONDITIONS:
  - student_transfers record created
  - student.room_id updated to toRoomId
  - If rent changed: current month obligation updated
  - All changes committed atomically or rolled back

BEGIN
  // Step 1: Validate transfer eligibility
  student ← database.students.findById(transferRequest.studentId)
  IF student IS NULL OR student.status != 'ACTIVE' THEN
    RETURN TransferResult(success: false, error: "Student not found or inactive")
  END IF
  
  fromRoom ← database.rooms.findById(transferRequest.fromRoomId)
  toRoom ← database.rooms.findById(transferRequest.toRoomId)
  
  IF toRoom IS NULL THEN
    RETURN TransferResult(success: false, error: "Target room not found")
  END IF
  
  // Step 2: Check target room capacity
  occupiedBeds ← COUNT(students WHERE room_id = toRoom.id AND status != 'VACATED')
  availableBeds ← toRoom.bed_capacity - occupiedBeds
  
  IF availableBeds <= 0 THEN
    RETURN TransferResult(success: false, error: "Target room is full")
  END IF
  
  // Step 3: Begin transaction
  BEGIN TRANSACTION
  
  // Step 4: Create transfer audit record
  transferId ← database.student_transfers.insert({
    student_id: transferRequest.studentId,
    from_room_id: transferRequest.fromRoomId,
    to_room_id: transferRequest.toRoomId,
    transfer_date: transferRequest.transferDate,
    reason: transferRequest.reason,
    performed_by: transferRequest.performedBy
  })
  
  // Step 5: Update student room assignment
  database.students.update(
    WHERE id = transferRequest.studentId,
    SET room_id = transferRequest.toRoomId
  )
  
  // Step 6: Update current month obligation if rent changed
  obligationUpdated ← false
  IF fromRoom.rent_per_bed != toRoom.rent_per_bed THEN
    currentMonth ← date_trunc('month', CURRENT_DATE)
    
    database.monthly_obligations.update(
      WHERE student_id = transferRequest.studentId AND month = currentMonth,
      SET amount_due = toRoom.rent_per_bed
    )
    
    obligationUpdated ← true
  END IF
  
  // Step 7: Commit transaction
  COMMIT TRANSACTION
  
  RETURN TransferResult(
    success: true,
    transferId: transferId,
    obligationUpdated: obligationUpdated
  )
  
EXCEPTION
  ROLLBACK TRANSACTION
  RETURN TransferResult(success: false, error: exception.message)
END
```



### Algorithm 2: Update Payment with Date Change

```pascal
ALGORITHM updatePaymentWithDateChange(paymentId, updates, userId)
INPUT: paymentId (uuid), updates (Partial<Payment>), userId (uuid)
OUTPUT: result of type { success: boolean, error?: string }

PRECONDITIONS:
  - paymentId exists in payments table
  - If updates.payment_date provided: date is valid and not in future
  - If updates.amount provided: amount > 0
  - userId exists in auth.users table

POSTCONDITIONS:
  - Payment record updated with new values
  - If payment_date changed: month_year recalculated
  - monthly_obligations recalculated for affected months
  - Student status updated based on new balance

BEGIN
  // Step 1: Fetch existing payment
  payment ← database.payments.findById(paymentId)
  IF payment IS NULL THEN
    RETURN { success: false, error: "Payment not found" }
  END IF
  
  oldMonthYear ← payment.month_year
  
  // Step 2: Validate updates
  IF updates.payment_date IS NOT NULL THEN
    IF updates.payment_date > CURRENT_DATE THEN
      RETURN { success: false, error: "Payment date cannot be in future" }
    END IF
    
    // Calculate new month_year
    updates.month_year ← substring(updates.payment_date, 0, 7) // 'YYYY-MM'
  END IF
  
  IF updates.amount IS NOT NULL AND updates.amount <= 0 THEN
    RETURN { success: false, error: "Amount must be positive" }
  END IF
  
  // Step 3: Begin transaction
  BEGIN TRANSACTION
  
  // Step 4: Update payment record
  database.payments.update(
    WHERE id = paymentId,
    SET updates,
    SET updated_at = CURRENT_TIMESTAMP,
    SET edited_by = userId
  )
  
  // Step 5: Recalculate obligations for affected months
  affectedMonths ← [oldMonthYear]
  IF updates.month_year IS NOT NULL AND updates.month_year != oldMonthYear THEN
    affectedMonths.push(updates.month_year)
  END IF
  
  FOR EACH month IN affectedMonths DO
    recalculateMonthlyObligation(payment.student_id, month)
  END FOR
  
  // Step 6: Recalculate student status
  recalculateStudentStatus(payment.student_id)
  
  // Step 7: Commit transaction
  COMMIT TRANSACTION
  
  RETURN { success: true }
  
EXCEPTION
  ROLLBACK TRANSACTION
  RETURN { success: false, error: exception.message }
END

PROCEDURE recalculateMonthlyObligation(studentId, monthYear)
BEGIN
  month ← to_date(monthYear || '-01', 'YYYY-MM-DD')
  
  // Sum all payments for this student in this month
  totalPaid ← SUM(payments.amount 
    WHERE student_id = studentId AND month_year = monthYear)
  
  // Get amount due from obligation
  obligation ← database.monthly_obligations.findOne(
    WHERE student_id = studentId AND month = month
  )
  
  IF obligation IS NULL THEN
    RETURN // No obligation exists for this month
  END IF
  
  // Determine new status
  IF totalPaid >= obligation.amount_due THEN
    newStatus ← 'PAID'
  ELSE IF totalPaid > 0 THEN
    newStatus ← 'PARTIAL'
  ELSE
    newStatus ← 'OVERDUE'
  END IF
  
  // Update obligation
  database.monthly_obligations.update(
    WHERE student_id = studentId AND month = month,
    SET amount_paid = totalPaid,
    SET status = newStatus,
    SET updated_at = CURRENT_TIMESTAMP
  )
END

PROCEDURE recalculateStudentStatus(studentId)
BEGIN
  currentMonth ← date_trunc('month', CURRENT_DATE)
  
  obligation ← database.monthly_obligations.findOne(
    WHERE student_id = studentId AND month = currentMonth
  )
  
  IF obligation IS NULL THEN
    RETURN
  END IF
  
  // Update student status based on current month obligation
  IF obligation.status = 'PAID' THEN
    database.students.update(
      WHERE id = studentId,
      SET status = 'PAID'
    )
  ELSE IF obligation.status = 'OVERDUE' THEN
    database.students.update(
      WHERE id = studentId,
      SET status = 'OVERDUE'
    )
  ELSE
    database.students.update(
      WHERE id = studentId,
      SET status = 'ACTIVE'
    )
  END IF
END
```



### Algorithm 3: Render Mobile Calendar Grid

```pascal
ALGORITHM renderMobileCalendarGrid(currentDate, properties)
INPUT: currentDate (Date), properties (Property[])
OUTPUT: calendarGrid of type MobileCalendarGrid

PRECONDITIONS:
  - currentDate is valid Date object
  - properties array contains all property data with rooms and students

POSTCONDITIONS:
  - Returns 42-cell grid (6 weeks × 7 days)
  - Each cell contains event indicators (payments, obligations, check-ins)
  - All cells have minimum 44px × 44px touch targets

BEGIN
  year ← currentDate.getFullYear()
  month ← currentDate.getMonth()
  
  // Step 1: Calculate calendar boundaries
  firstDay ← new Date(year, month, 1)
  lastDay ← new Date(year, month + 1, 0)
  startDayOfWeek ← firstDay.getDay() // 0 = Sunday
  daysInMonth ← lastDay.getDate()
  
  // Step 2: Initialize event tracking
  paymentDots ← {}
  obligationDots ← {}
  checkinDots ← {}
  
  // Step 3: Process all properties for calendar events
  FOR EACH property IN properties DO
    FOR EACH room IN property.rooms DO
      FOR EACH student IN room.students DO
        // Skip VACANT and VACATED students
        IF student.status = 'VACANT' OR student.status = 'VACATED' THEN
          CONTINUE
        END IF
        
        // Process check-ins
        IF student.check_in_date IS NOT NULL THEN
          checkinDate ← new Date(student.check_in_date)
          IF checkinDate.year = year AND checkinDate.month = month THEN
            dayKey ← checkinDate.getDate()
            IF checkinDots[dayKey] IS NULL THEN
              checkinDots[dayKey] ← []
            END IF
            checkinDots[dayKey].push({
              student: student.full_name,
              property: property.name,
              room: room.room_number,
              date: student.check_in_date
            })
          END IF
        END IF
        
        // Process payment history
        IF student.payHistory IS NOT NULL THEN
          FOR EACH payment IN student.payHistory DO
            payDate ← new Date(payment.date)
            IF payDate.year = year AND payDate.month = month THEN
              dayKey ← payDate.getDate()
              IF paymentDots[dayKey] IS NULL THEN
                paymentDots[dayKey] ← []
              END IF
              paymentDots[dayKey].push({
                student: student.full_name,
                property: property.name,
                room: room.room_number,
                amount: payment.amount,
                method: payment.method,
                date: payment.date
              })
            END IF
          END FOR
        END IF
        
        // Process obligations (show on 1st of month)
        balance ← room.rent_per_bed - student.amount_paid
        IF balance > 0 THEN
          IF obligationDots[1] IS NULL THEN
            obligationDots[1] ← []
          END IF
          obligationDots[1].push({
            student: student.full_name,
            property: property.name,
            room: room.room_number,
            amount: balance,
            status: student.status
          })
        END IF
      END FOR
    END FOR
  END FOR
  
  // Step 4: Build 42-cell grid
  cells ← []
  FOR i FROM 0 TO 41 DO
    dayNum ← i - startDayOfWeek + 1
    isCurrentMonth ← (dayNum >= 1 AND dayNum <= daysInMonth)
    
    IF isCurrentMonth THEN
      date ← new Date(year, month, dayNum)
      isToday ← (date.toDateString() = new Date().toDateString())
      
      cells.push({
        index: i,
        dayNum: dayNum,
        date: date,
        isToday: isToday,
        hasPayments: (paymentDots[dayNum]?.length > 0),
        hasCheckins: (checkinDots[dayNum]?.length > 0),
        hasObligations: (obligationDots[dayNum]?.length > 0),
        paymentCount: paymentDots[dayNum]?.length || 0,
        checkinCount: checkinDots[dayNum]?.length || 0,
        obligationCount: obligationDots[dayNum]?.length || 0
      })
    ELSE
      // Empty cell for days outside current month
      cells.push({
        index: i,
        dayNum: null,
        date: null,
        isToday: false,
        hasPayments: false,
        hasCheckins: false,
        hasObligations: false,
        paymentCount: 0,
        checkinCount: 0,
        obligationCount: 0
      })
    END IF
  END FOR
  
  // Step 5: Return grid with event data
  RETURN {
    cells: cells,
    weekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthLabel: currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    paymentDots: paymentDots,
    obligationDots: obligationDots,
    checkinDots: checkinDots
  }
END
```



### Algorithm 4: Database Health Check and Repair

```pascal
ALGORITHM performDatabaseHealthCheck()
INPUT: None
OUTPUT: healthReport of type HealthReport

POSTCONDITIONS:
  - All health issues identified
  - Repair actions executed if auto-fix enabled
  - Health report generated with details

BEGIN
  healthReport ← {
    checks: [],
    totalIssues: 0,
    repairsApplied: 0
  }
  
  // Check 1: Missing check-in dates
  missingCheckinResult ← checkMissingCheckInDates()
  healthReport.checks.push(missingCheckinResult)
  healthReport.totalIssues += missingCheckinResult.issueCount
  
  // Check 2: Orphaned obligations
  orphanedResult ← checkOrphanedObligations()
  healthReport.checks.push(orphanedResult)
  healthReport.totalIssues += orphanedResult.issueCount
  
  // Check 3: Missing current month obligations
  missingObligationsResult ← checkMissingCurrentMonthObligations()
  healthReport.checks.push(missingObligationsResult)
  healthReport.totalIssues += missingObligationsResult.issueCount
  
  // Check 4: View accuracy (UNASSIGNED filtering)
  viewAccuracyResult ← checkViewAccuracy()
  healthReport.checks.push(viewAccuracyResult)
  healthReport.totalIssues += viewAccuracyResult.issueCount
  
  RETURN healthReport
END

FUNCTION checkMissingCheckInDates()
RETURNS HealthCheckResult
BEGIN
  // Find active students without check_in_date
  missingStudents ← database.students.find(
    WHERE check_in_date IS NULL
    AND status = 'ACTIVE'
    AND full_name NOT LIKE 'UNASSIGNED%'
  )
  
  IF missingStudents.length = 0 THEN
    RETURN {
      checkName: 'Missing Check-in Dates',
      passed: true,
      issueCount: 0,
      details: ['All active students have check-in dates']
    }
  END IF
  
  // Auto-fix: Use created_at as fallback
  fixedCount ← 0
  FOR EACH student IN missingStudents DO
    database.students.update(
      WHERE id = student.id,
      SET check_in_date = student.created_at::date
    )
    fixedCount += 1
  END FOR
  
  RETURN {
    checkName: 'Missing Check-in Dates',
    passed: false,
    issueCount: missingStudents.length,
    details: [`Fixed ${fixedCount} students using created_at as check-in date`],
    affectedRecords: missingStudents.map(s => s.id)
  }
END

FUNCTION checkOrphanedObligations()
RETURNS HealthCheckResult
BEGIN
  // Find obligations where student no longer exists
  orphanedObligations ← database.monthly_obligations.find(
    WHERE student_id NOT IN (SELECT id FROM students)
  )
  
  IF orphanedObligations.length = 0 THEN
    RETURN {
      checkName: 'Orphaned Obligations',
      passed: true,
      issueCount: 0,
      details: ['No orphaned obligation records found']
    }
  END IF
  
  // Auto-fix: Delete orphaned records
  deletedCount ← database.monthly_obligations.delete(
    WHERE student_id NOT IN (SELECT id FROM students)
  )
  
  RETURN {
    checkName: 'Orphaned Obligations',
    passed: false,
    issueCount: orphanedObligations.length,
    details: [`Deleted ${deletedCount} orphaned obligation records`],
    affectedRecords: orphanedObligations.map(o => o.id)
  }
END

FUNCTION checkMissingCurrentMonthObligations()
RETURNS HealthCheckResult
BEGIN
  currentMonth ← date_trunc('month', CURRENT_DATE)::date
  
  // Find active students without current month obligation
  studentsWithoutObligation ← database.students.find(
    WHERE status = 'ACTIVE'
    AND full_name NOT LIKE 'UNASSIGNED%'
    AND id NOT IN (
      SELECT student_id FROM monthly_obligations
      WHERE month = currentMonth
    )
  )
  
  IF studentsWithoutObligation.length = 0 THEN
    RETURN {
      checkName: 'Missing Current Month Obligations',
      passed: true,
      issueCount: 0,
      details: ['All active students have current month obligations']
    }
  END IF
  
  // Auto-fix: Generate missing obligations
  createdCount ← 0
  FOR EACH student IN studentsWithoutObligation DO
    room ← database.rooms.findById(student.room_id)
    IF room IS NOT NULL THEN
      database.monthly_obligations.insert({
        student_id: student.id,
        month: currentMonth,
        amount_due: room.rent_per_bed,
        amount_paid: 0,
        status: 'OVERDUE',
        due_date: currentMonth
      })
      createdCount += 1
    END IF
  END FOR
  
  RETURN {
    checkName: 'Missing Current Month Obligations',
    passed: false,
    issueCount: studentsWithoutObligation.length,
    details: [`Created ${createdCount} missing obligation records for current month`],
    affectedRecords: studentsWithoutObligation.map(s => s.id)
  }
END

FUNCTION checkViewAccuracy()
RETURNS HealthCheckResult
BEGIN
  // Verify v_property_summary excludes UNASSIGNED students
  viewDefinition ← database.getViewDefinition('v_property_summary')
  
  IF viewDefinition.includes("full_name NOT LIKE 'UNASSIGNED%'") THEN
    RETURN {
      checkName: 'View Accuracy (UNASSIGNED Filtering)',
      passed: true,
      issueCount: 0,
      details: ['v_property_summary correctly excludes UNASSIGNED students']
    }
  ELSE
    RETURN {
      checkName: 'View Accuracy (UNASSIGNED Filtering)',
      passed: false,
      issueCount: 1,
      details: ['v_property_summary needs update to exclude UNASSIGNED students'],
      affectedRecords: ['v_property_summary']
    }
  END IF
END
```



## Key Functions with Formal Specifications

### Function 1: getAvailableRooms()

```typescript
async function getAvailableRooms(propertyId?: string): Promise<AvailableRoom[]>
```

**Preconditions:**
- If propertyId provided: propertyId exists in properties table
- Database connection is active
- User has permission to view rooms

**Postconditions:**
- Returns array of rooms with available bed capacity > 0
- Each room includes: id, roomNumber, bedCapacity, occupiedBeds, availableBeds, rentPerBed, propertyName
- Rooms are sorted by property name, then room number
- UNASSIGNED students are counted as occupied beds
- VACATED students are not counted as occupied beds

**Loop Invariants:**
- For each room processed: occupiedBeds + availableBeds = bedCapacity
- All rooms returned have availableBeds > 0

### Function 2: executeTransfer()

```typescript
async function executeTransfer(transfer: TransferRequest): Promise<TransferResult>
```

**Preconditions:**
- transfer.studentId exists and student.status = 'ACTIVE'
- transfer.fromRoomId = student.room_id (current room)
- transfer.toRoomId exists and has availableBeds > 0
- transfer.fromRoomId ≠ transfer.toRoomId
- transfer.performedBy is valid user ID

**Postconditions:**
- student_transfers record created with all transfer details
- student.room_id updated to transfer.toRoomId
- If fromRoom.rent ≠ toRoom.rent: current month obligation.amount_due updated
- All database changes committed atomically
- Returns TransferResult with success=true and transferId
- On error: all changes rolled back, returns TransferResult with success=false and error message

**Loop Invariants:** N/A (no loops in function)

### Function 3: updatePayment()

```typescript
async function updatePayment(
  paymentId: string,
  updates: Partial<Payment>,
  userId: string
): Promise<{ success: boolean; error?: string }>
```

**Preconditions:**
- paymentId exists in payments table
- If updates.payment_date: date ≤ CURRENT_DATE (not in future)
- If updates.amount: amount > 0
- userId exists in auth.users table
- User has permission to edit payments

**Postconditions:**
- Payment record updated with provided fields
- If payment_date changed: month_year recalculated as 'YYYY-MM'
- updated_at set to current timestamp
- edited_by set to userId
- monthly_obligations recalculated for affected months (old and new)
- Student status updated based on new balance
- Returns { success: true } on success
- On error: all changes rolled back, returns { success: false, error: message }

**Loop Invariants:**
- For each affected month: sum of payments.amount = monthly_obligations.amount_paid
- For each affected month: obligation.status correctly reflects payment status

### Function 4: renderMobileCalendarGrid()

```typescript
function renderMobileCalendarGrid(
  currentDate: Date,
  properties: Property[]
): MobileCalendarGrid
```

**Preconditions:**
- currentDate is valid Date object
- properties array contains complete property data with rooms and students
- All student.payHistory arrays are valid

**Postconditions:**
- Returns grid with exactly 42 cells (6 weeks × 7 days)
- First cell index corresponds to first day of month's weekday
- Each cell with dayNum has correct event indicators
- All event counts match actual event arrays
- paymentDots, obligationDots, checkinDots contain all events for the month
- VACANT and VACATED students excluded from all event calculations

**Loop Invariants:**
- For each property processed: all rooms processed
- For each room processed: all non-VACANT/VACATED students processed
- For each student processed: all payment history entries processed
- Event counts remain consistent: cell.paymentCount = paymentDots[dayNum].length

### Function 5: performDatabaseHealthCheck()

```typescript
async function performDatabaseHealthCheck(): Promise<HealthReport>
```

**Preconditions:**
- Database connection is active
- User has admin permissions
- All tables (students, monthly_obligations, rooms) exist

**Postconditions:**
- All health checks executed
- Missing check-in dates fixed using created_at as fallback
- Orphaned obligations deleted
- Missing current month obligations created
- View accuracy verified
- Returns HealthReport with all check results
- healthReport.totalIssues = sum of all check issueCount values
- All auto-fixes applied successfully or errors logged

**Loop Invariants:**
- For each health check: result added to healthReport.checks
- For each issue found: issueCount incremented
- For each repair applied: repairsApplied incremented



## Example Usage

### Example 1: Execute Student Transfer

```typescript
// User clicks "Transfer Room" in Student Profile
const transferRequest: TransferRequest = {
  studentId: 'uuid-student-123',
  fromRoomId: 'uuid-room-5',
  toRoomId: 'uuid-room-12',
  transferDate: '2026-05-15',
  reason: 'Student requested quieter room',
  performedBy: 'admin@trevis.co.zw'
};

const result = await transferService.executeTransfer(transferRequest);

if (result.success) {
  console.log(`Transfer completed: ${result.transferId}`);
  if (result.obligationUpdated) {
    console.log('Current month obligation updated due to rent change');
  }
  // Refresh student profile and room list
  refreshStudentProfile();
  refreshPropertyRooms();
} else {
  console.error(`Transfer failed: ${result.error}`);
  showErrorToast(result.error);
}
```

### Example 2: Edit Payment Date (Backdated)

```typescript
// User edits payment date in payment history
const paymentId = 'uuid-payment-456';
const updates = {
  payment_date: '2026-04-20', // Changed from May to April
  notes: 'Corrected payment date - was recorded late'
};

const result = await paymentService.updatePayment(
  paymentId,
  updates,
  currentUser.id
);

if (result.success) {
  console.log('Payment updated successfully');
  // Trigger full recalculation
  await paymentService.recalculateBalances();
  // Refresh all financial views
  refreshPaymentHistory();
  refreshMonthlyObligations();
  refreshStudentStatus();
} else {
  console.error(`Update failed: ${result.error}`);
  showErrorToast(result.error);
}
```

### Example 3: Render Mobile Calendar

```typescript
// Calendar component renders mobile grid
const currentDate = new Date(2026, 4, 1); // May 2026
const properties = await propertyService.getAllProperties();

const calendarGrid = renderMobileCalendarGrid(currentDate, properties);

// Render 7-column grid
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
  {calendarGrid.cells.map(cell => (
    <div
      key={cell.index}
      onClick={() => cell.dayNum && handleDayClick(cell)}
      style={{
        minHeight: '44px',
        minWidth: '44px',
        padding: '4px',
        border: '1px solid #ddd',
        cursor: cell.dayNum ? 'pointer' : 'default',
        background: cell.isToday ? '#ffd70020' : 
                   (cell.hasPayments || cell.hasObligations) ? '#0000ff08' : 
                   cell.dayNum ? '#fff' : '#f5f5f5'
      }}
    >
      {cell.dayNum && (
        <>
          <div style={{ fontSize: '11px', fontWeight: cell.isToday ? 700 : 600 }}>
            {cell.dayNum}
          </div>
          <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
            {cell.hasPayments && <span style={{ color: '#0a0', fontSize: '5px' }}>●</span>}
            {cell.hasObligations && <span style={{ color: '#c00', fontSize: '5px' }}>●</span>}
            {cell.hasCheckins && <span style={{ color: '#ffd700', fontSize: '5px' }}>●</span>}
          </div>
        </>
      )}
    </div>
  ))}
</div>
```

### Example 4: Database Health Check

```typescript
// Admin runs health check from Settings
const healthReport = await performDatabaseHealthCheck();

console.log(`Health Check Complete: ${healthReport.totalIssues} issues found`);

healthReport.checks.forEach(check => {
  if (check.passed) {
    console.log(`✓ ${check.checkName}: PASSED`);
  } else {
    console.warn(`✗ ${check.checkName}: ${check.issueCount} issues`);
    check.details.forEach(detail => console.log(`  - ${detail}`));
  }
});

// Display health report in UI
<HealthReportCard report={healthReport} />
```

### Example 5: Inline Edit Student Field

```typescript
// User clicks to edit student phone number
const [editing, setEditing] = useState(false);
const [value, setValue] = useState(student.phone);

const handleSave = async () => {
  const result = await studentService.updateStudent(student.id, {
    phone: value
  });
  
  if (result.error) {
    showErrorToast('Failed to update phone number');
    setValue(student.phone); // Revert
  } else {
    setEditing(false);
    refreshStudentProfile();
  }
};

// Render inline edit field
{editing ? (
  <input
    value={value}
    onChange={e => setValue(e.target.value)}
    onBlur={handleSave}
    autoFocus
    style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #ffd700' }}
  />
) : (
  <span onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>
    {student.phone || '—'}
  </span>
)}
```



## Correctness Properties

### Universal Quantification Statements

1. **Transfer Atomicity**: ∀ transfer ∈ TransferRequests: (transfer.success = true) ⟹ (student_transfers record exists ∧ student.room_id = transfer.toRoomId ∧ (rent_changed ⟹ obligation.amount_due updated))

2. **Payment Date Consistency**: ∀ payment ∈ Payments: payment.month_year = substring(payment.payment_date, 0, 7)

3. **Obligation Balance Accuracy**: ∀ obligation ∈ MonthlyObligations: obligation.amount_paid = SUM(payments.amount WHERE student_id = obligation.student_id AND month_year = obligation.month)

4. **Room Capacity Constraint**: ∀ room ∈ Rooms: COUNT(students WHERE room_id = room.id AND status ≠ 'VACATED') ≤ room.bed_capacity

5. **UNASSIGNED Filtering**: ∀ view ∈ [StudentsList, Finances, Arrears, Reports]: COUNT(records WHERE full_name LIKE 'UNASSIGNED%') = 0

6. **Calendar Cell Count**: ∀ calendar ∈ CalendarGrids: calendar.cells.length = 42

7. **Mobile Touch Targets**: ∀ cell ∈ MobileCalendarCells: cell.minHeight ≥ 44px ∧ cell.minWidth ≥ 44px

8. **Transfer Room Difference**: ∀ transfer ∈ TransferRequests: transfer.fromRoomId ≠ transfer.toRoomId

9. **Payment Amount Positivity**: ∀ payment ∈ Payments: payment.amount > 0

10. **Student Status Consistency**: ∀ student ∈ Students: (current_month_obligation.status = 'PAID') ⟹ (student.status = 'PAID')

11. **Index Coverage**: ∀ query ∈ [PaymentsByStudent, StudentsByRoom, ObligationsByMonth]: query uses index (execution_time < 100ms for 1000 records)

12. **Error Boundary Isolation**: ∀ component ∈ [Dashboard, PropertyDetail, Students, Reports, Calendar, Finances]: component.error ⟹ ¬(app.crashed)

13. **Health Check Completeness**: ∀ healthCheck ∈ HealthChecks: healthCheck.executed ⟹ (check_in_dates_verified ∧ orphaned_obligations_checked ∧ missing_obligations_checked ∧ view_accuracy_verified)

14. **Pagination Consistency**: ∀ page ∈ PaginatedLists: page.offset + page.limit ≤ total_count ∧ page.records.length ≤ page.limit

15. **Audit Trail Completeness**: ∀ transfer ∈ StudentTransfers: transfer.performed_by IS NOT NULL ∧ transfer.transfer_date IS NOT NULL



## Error Handling

### Error Scenario 1: Transfer to Full Room

**Condition**: User attempts to transfer student to room with no available beds

**Response**:
- Validate room capacity before executing transfer
- Query: `SELECT COUNT(*) FROM students WHERE room_id = ? AND status != 'VACATED'`
- Compare: `occupiedBeds >= room.bed_capacity`
- Return error: "Target room is full (X/Y beds occupied)"

**Recovery**:
- Display error toast with room capacity details
- Keep transfer modal open with current selections
- Suggest alternative rooms with available beds
- User can select different room or cancel

### Error Scenario 2: Backdated Payment Edit

**Condition**: User edits payment date to a prior month

**Response**:
- Detect month change: `oldMonthYear !== newMonthYear`
- Show amber warning banner: "⚠ Recording payment for [Month] — historical records will update"
- Proceed with update if user confirms
- Recalculate obligations for both old and new months

**Recovery**:
- Execute recalculation in transaction
- If recalculation fails: rollback payment update
- Display error: "Failed to update payment — balance recalculation error"
- Preserve original payment data
- Log error for admin review

### Error Scenario 3: Database Query Timeout

**Condition**: Large query exceeds timeout threshold (e.g., loading 1000+ students without pagination)

**Response**:
- Implement query timeout: 30 seconds
- Use pagination: `LIMIT 50 OFFSET 0`
- Show loading skeleton during query
- If timeout: cancel query, show error

**Recovery**:
- Display error: "Query took too long — try filtering or searching"
- Suggest using search or property filter
- Automatically apply pagination
- Retry with smaller page size (25 records)

### Error Scenario 4: Component Crash

**Condition**: React component throws unhandled error (e.g., null reference, invalid data)

**Response**:
- Error boundary catches error
- Log error to console with component name and stack trace
- Display fallback UI: "Something went wrong in [Component]. Try refreshing."
- Provide "Refresh" button to reload component

**Recovery**:
- User clicks "Refresh" → component remounts with fresh data
- If error persists: suggest full page refresh
- Error does not crash entire app
- Other components continue functioning normally

### Error Scenario 5: Concurrent Payment Edit

**Condition**: Two users edit same payment simultaneously

**Response**:
- Use optimistic locking with `updated_at` timestamp
- Check: `WHERE id = ? AND updated_at = ?`
- If no rows updated: payment was modified by another user
- Return error: "Payment was modified by another user"

**Recovery**:
- Fetch latest payment data
- Display diff: "Current value: X, Your edit: Y, Latest value: Z"
- Ask user: "Overwrite latest changes?" or "Cancel your edit"
- If overwrite: force update with new timestamp
- If cancel: discard user's changes, show latest data

### Error Scenario 6: Missing Database Index

**Condition**: Query runs slowly due to missing index (detected in production)

**Response**:
- Monitor query execution time
- Log slow queries (> 1 second) with EXPLAIN output
- Alert admin: "Slow query detected on [table]"
- Suggest index: "Consider adding index on [columns]"

**Recovery**:
- Admin reviews slow query log
- Create missing index: `CREATE INDEX idx_name ON table(columns)`
- Verify query performance improvement
- Update schema migration file for future deployments

### Error Scenario 7: Health Check Failure

**Condition**: Database health check finds critical issues (e.g., 50+ orphaned obligations)

**Response**:
- Execute health check
- Identify issue: "Found 50 orphaned obligation records"
- Attempt auto-fix: delete orphaned records
- If auto-fix fails: log error and alert admin

**Recovery**:
- Display health report with issue details
- Provide manual fix option: "Run cleanup script"
- Admin reviews affected records before cleanup
- Execute cleanup in transaction with rollback option
- Verify data integrity after cleanup



## Testing Strategy

### Unit Testing Approach

**Test Coverage Goals**: 80% code coverage for business logic, 60% for UI components

**Key Test Cases**:

1. **Transfer Service Tests**
   - `executeTransfer_ValidRequest_CreatesTransferRecord()`
   - `executeTransfer_FullRoom_ReturnsError()`
   - `executeTransfer_SameRoom_ReturnsError()`
   - `executeTransfer_RentChange_UpdatesObligation()`
   - `getAvailableRooms_FiltersFullRooms()`
   - `getAvailableRooms_CountsUnassignedAsOccupied()`

2. **Payment Service Tests**
   - `updatePayment_DateChange_RecalculatesMonthYear()`
   - `updatePayment_BackdatedPayment_RecalculatesBothMonths()`
   - `updatePayment_InvalidAmount_ReturnsError()`
   - `deletePayment_ValidId_RecalculatesBalances()`
   - `recalculateBalances_UpdatesAllObligations()`

3. **Calendar Rendering Tests**
   - `renderMobileCalendarGrid_Returns42Cells()`
   - `renderMobileCalendarGrid_FirstCellMatchesWeekday()`
   - `renderMobileCalendarGrid_EventCountsMatchDots()`
   - `renderMobileCalendarGrid_ExcludesVacantStudents()`
   - `renderMobileCalendarGrid_MinimumTouchTargets()`

4. **Health Check Tests**
   - `checkMissingCheckInDates_FindsAndFixesIssues()`
   - `checkOrphanedObligations_DeletesOrphans()`
   - `checkMissingObligations_CreatesForActiveStudents()`
   - `performHealthCheck_ReturnsCompleteReport()`

5. **UNASSIGNED Filtering Tests**
   - `getStudentsList_ExcludesUnassigned()`
   - `getFinancialReport_ExcludesUnassigned()`
   - `getRoomCapacity_IncludesUnassigned()`
   - `propertyView_ExcludesUnassignedFromCounts()`

**Testing Tools**: Jest, React Testing Library, Supabase Test Client

### Property-Based Testing Approach

**Property Test Library**: fast-check (JavaScript/TypeScript)

**Property Tests**:

1. **Transfer Atomicity Property**
   ```typescript
   fc.assert(
     fc.property(
       fc.record({
         studentId: fc.uuid(),
         fromRoomId: fc.uuid(),
         toRoomId: fc.uuid(),
         transferDate: fc.date(),
         performedBy: fc.emailAddress()
       }),
       async (transfer) => {
         // Assume valid setup
         const result = await executeTransfer(transfer);
         
         if (result.success) {
           // Verify all changes applied atomically
           const transferRecord = await getTransferById(result.transferId);
           const student = await getStudentById(transfer.studentId);
           
           expect(transferRecord).toBeDefined();
           expect(student.room_id).toBe(transfer.toRoomId);
         }
       }
     )
   );
   ```

2. **Payment Month Year Consistency Property**
   ```typescript
   fc.assert(
     fc.property(
       fc.record({
         paymentDate: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
         amount: fc.float({ min: 1, max: 10000 })
       }),
       async (payment) => {
         const result = await recordPayment(payment);
         const savedPayment = await getPaymentById(result.id);
         
         const expectedMonthYear = payment.paymentDate.toISOString().substring(0, 7);
         expect(savedPayment.month_year).toBe(expectedMonthYear);
       }
     )
   );
   ```

3. **Calendar Cell Count Property**
   ```typescript
   fc.assert(
     fc.property(
       fc.date(),
       fc.array(fc.record({ /* property structure */ })),
       (currentDate, properties) => {
         const grid = renderMobileCalendarGrid(currentDate, properties);
         expect(grid.cells.length).toBe(42);
       }
     )
   );
   ```

4. **Room Capacity Constraint Property**
   ```typescript
   fc.assert(
     fc.property(
       fc.uuid(), // roomId
       fc.integer({ min: 1, max: 10 }), // bedCapacity
       async (roomId, bedCapacity) => {
         const room = await getRoomById(roomId);
         const occupiedBeds = await getOccupiedBedCount(roomId);
         
         expect(occupiedBeds).toBeLessThanOrEqual(room.bed_capacity);
       }
     )
   );
   ```

### Integration Testing Approach

**Integration Test Scenarios**:

1. **End-to-End Transfer Flow**
   - Create student in Room A
   - Execute transfer to Room B
   - Verify student_transfers record created
   - Verify student.room_id updated
   - Verify obligation updated if rent changed
   - Verify Room A capacity increased
   - Verify Room B capacity decreased

2. **Payment Edit with Recalculation**
   - Record payment for May
   - Edit payment date to April
   - Verify payment.month_year updated
   - Verify April obligation recalculated
   - Verify May obligation recalculated
   - Verify student status updated

3. **Mobile Calendar Rendering**
   - Load properties with students and payments
   - Render mobile calendar for current month
   - Verify 42 cells rendered
   - Verify payment dots displayed
   - Verify obligation dots displayed
   - Click day cell
   - Verify day panel opens with correct events

4. **Database Health Check**
   - Create students without check_in_date
   - Create orphaned obligations
   - Run health check
   - Verify issues detected
   - Verify auto-fixes applied
   - Verify health report accurate

**Testing Environment**: Supabase local development instance with test data



## Performance Considerations

### Database Query Optimization

**Baseline Performance** (without indexes):
- Student list query (143 students): ~800ms
- Payment history query (500+ payments): ~1200ms
- Dashboard summary query: ~1500ms

**Target Performance** (with indexes):
- Student list query: <100ms (8x improvement)
- Payment history query: <150ms (8x improvement)
- Dashboard summary query: <200ms (7.5x improvement)

**Index Strategy**:
1. **Composite Indexes**: Use multi-column indexes for common query patterns
   - `(student_id, month_year)` for payment queries
   - `(room_id, status)` for student queries
   - `(student_id, month)` for obligation queries

2. **Covering Indexes**: Include frequently selected columns in index
   - Reduces need for table lookups
   - Example: `CREATE INDEX idx_payments_student_month ON payments(student_id, month_year) INCLUDE (amount, payment_date)`

3. **Partial Indexes**: Index only relevant rows
   - Example: `CREATE INDEX idx_active_students ON students(room_id) WHERE status = 'ACTIVE'`

**Query Optimization Techniques**:
- Use `SELECT` with specific columns instead of `SELECT *`
- Apply filters in WHERE clause before JOINs
- Use `LIMIT` and `OFFSET` for pagination
- Cache frequently accessed data (properties) in React Context

### Frontend Performance

**Payload Size Reduction**:
- Before: Full student record with all relations = ~2KB per student
- After: Selective columns = ~500 bytes per student (75% reduction)
- For 143 students: 286KB → 71KB payload

**Pagination Strategy**:
- Page size: 50 students
- Load on scroll: Infinite scroll with intersection observer
- Prefetch next page when user reaches 80% of current page

**React Optimization**:
- Use `React.memo()` for student list items
- Use `useMemo()` for expensive calculations (calendar grid)
- Use `useCallback()` for event handlers passed to children
- Implement virtual scrolling for lists > 100 items

**Loading States**:
- Show skeleton loaders during data fetch
- Optimistic UI updates for edits (update UI immediately, sync with server)
- Debounce search input (300ms delay)

### Mobile Performance

**Touch Target Optimization**:
- Minimum size: 44px × 44px (WCAG AAA standard)
- Spacing between targets: 8px minimum
- Larger tap areas for primary actions

**Calendar Rendering**:
- Render only visible month (42 cells)
- Lazy load event details on day click
- Use CSS transforms for smooth animations
- Avoid re-rendering entire grid on event updates

**Bottom Sheet Performance**:
- Use CSS `transform: translateY()` for smooth slide animation
- Hardware acceleration: `will-change: transform`
- Gesture handling: `touch-action: pan-y` for vertical swipe
- Debounce swipe events to prevent jank

### Memory Management

**Data Caching Strategy**:
- Cache property data in React Context (rarely changes)
- Cache student list for 5 minutes
- Invalidate cache on mutations (add, edit, delete)
- Use SWR (stale-while-revalidate) pattern

**Cleanup**:
- Unmount event listeners on component cleanup
- Cancel pending requests on component unmount
- Clear large data structures when no longer needed



## Security Considerations

### Row Level Security (RLS) for Transfers

**Policy**: Only admins can execute transfers

```sql
-- RLS policy for student_transfers table
CREATE POLICY "Admin can manage transfers" ON student_transfers
  FOR ALL USING (is_admin());

CREATE POLICY "Users can view own property transfers" ON student_transfers
  FOR SELECT USING (
    is_admin() OR
    from_room_id IN (
      SELECT id FROM rooms WHERE property_id = my_property_id()
    ) OR
    to_room_id IN (
      SELECT id FROM rooms WHERE property_id = my_property_id()
    )
  );
```

**Validation**:
- Verify user role before showing "Transfer Room" button
- Server-side validation: check `is_admin()` before executing transfer
- Audit trail: log all transfers with `performed_by` user ID

### Payment Edit Security

**Audit Trail**:
- Track all payment edits with `updated_at` and `edited_by` columns
- Log original values before update
- Prevent deletion of payments older than 90 days (configurable)

**Validation**:
- Payment date cannot be more than 12 months in the past
- Payment amount cannot exceed 10x room rent (fraud detection)
- Only admins can delete payments
- Managers can edit payments for their property only

**RLS Policies**:
```sql
-- Update payments policy
CREATE POLICY "Users can update own property payments" ON payments
  FOR UPDATE USING (
    is_admin() OR
    student_id IN (
      SELECT s.id FROM students s
      JOIN rooms r ON r.id = s.room_id
      WHERE r.property_id = my_property_id()
    )
  );

-- Delete payments policy (admin only)
CREATE POLICY "Admin can delete payments" ON payments
  FOR DELETE USING (is_admin());
```

### Data Integrity

**Transaction Isolation**:
- Use `SERIALIZABLE` isolation level for transfers
- Prevents race conditions when multiple users transfer students simultaneously
- Ensures atomic updates across multiple tables

**Constraint Enforcement**:
- Database constraints prevent invalid data
- CHECK constraint: `from_room_id != to_room_id`
- FOREIGN KEY constraints ensure referential integrity
- UNIQUE constraint on `(student_id, month)` in monthly_obligations

**Input Validation**:
- Sanitize all user inputs before database queries
- Use parameterized queries (Supabase client handles this)
- Validate date formats, UUIDs, numeric ranges
- Escape special characters in search queries

### Access Control

**Role-Based Permissions**:
- **Admin**: Full access to all features
  - Execute transfers
  - Edit all payments
  - Delete payments
  - Run health checks
  - View all properties

- **Manager**: Limited access
  - View own property only
  - Record payments for own property
  - Edit payments for own property (last 30 days)
  - Cannot delete payments
  - Cannot execute transfers

**UI-Level Enforcement**:
- Hide "Transfer Room" button for non-admins
- Disable payment delete button for managers
- Show read-only fields for restricted users

**API-Level Enforcement**:
- Server-side validation on all mutations
- RLS policies enforce database-level security
- Return 403 Forbidden for unauthorized actions

### Sensitive Data Protection

**PII Handling**:
- Student phone numbers, national IDs, emergency contacts are PII
- Encrypt sensitive fields at rest (Supabase handles this)
- Mask phone numbers in logs: `+263***1234`
- Limit PII access to authorized users only

**Audit Logging**:
- Log all data access and modifications
- Include: user ID, action, timestamp, affected records
- Retain logs for 12 months (compliance requirement)
- Provide audit log export for admins



## Dependencies

### Backend Dependencies

**Database**:
- PostgreSQL 15+ (via Supabase)
- Required extensions: `pgcrypto` (UUID generation)

**New Database Objects**:
- Table: `student_transfers`
- Indexes: 8 new performance indexes
- View: Updated `v_property_summary`
- Functions: `fix_missing_checkin_dates()`, `generate_missing_obligations()`, `cleanup_orphaned_obligations()`

### Frontend Dependencies

**Existing Dependencies** (no changes):
- React 18.2.0
- Vite 4.4.5
- @supabase/supabase-js 2.38.0

**New Dependencies** (none required):
- All features implemented with existing libraries
- Error boundaries use React built-in API
- Mobile calendar uses CSS Grid (no additional library)

### Service Layer

**New Services**:
- `transferService.js`: Student transfer operations
  - `getAvailableRooms(propertyId?)`
  - `executeTransfer(transfer)`
  - `getTransferHistory(studentId)`

**Updated Services**:
- `paymentService.js`: Add edit and delete functions
  - `updatePayment(paymentId, updates, userId)`
  - `deletePayment(paymentId, userId)`
  - `recalculateBalances()`

- `studentService.js`: Add UNASSIGNED filtering
  - Update all queries to exclude `UNASSIGNED%` students

### External Services

**None**: All functionality is self-contained within Trevis and Supabase

### Development Tools

**Testing**:
- Jest 29+ (unit tests)
- React Testing Library 14+ (component tests)
- fast-check 3+ (property-based tests)
- Supabase CLI (local development)

**Database Management**:
- Supabase Studio (GUI for database management)
- SQL Editor (for running migrations)

### Deployment Requirements

**Database Migration**:
1. Run `sprint5_schema_updates.sql` in Supabase SQL Editor
2. Verify indexes created: `SELECT * FROM pg_indexes WHERE tablename IN ('students', 'payments', 'monthly_obligations', 'rooms')`
3. Run health check: `SELECT * FROM fix_missing_checkin_dates()`
4. Verify view updated: `SELECT * FROM v_property_summary`

**Frontend Deployment**:
1. Build production bundle: `npm run build`
2. Deploy to hosting (Vercel, Netlify, or custom)
3. Verify environment variables set
4. Test all features in production

**Post-Deployment**:
1. Run database health check
2. Verify performance improvements (query times)
3. Test mobile calendar on actual devices
4. Verify error boundaries catch errors gracefully

