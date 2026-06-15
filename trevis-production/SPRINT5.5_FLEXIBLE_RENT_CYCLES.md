# Sprint 5.5: Flexible Rent Cycle Engine

> **⚠️ Correction (Stabilization TD-1, 2026-06-15):** This planning doc's code samples
> reference `src/services/coverageService.js` as the implementation target. That file was
> an early, **wrong-math** draft (`Math.floor`, no early-payment/prepaid preservation,
> wrong column names) that was never wired up and has been archived to
> `src/services/_archive/coverageService.legacy.js` (do not import). The actual,
> authoritative implementation is `rentCycleCalculator.js` → `paymentProcessor.js` →
> `statusClassifier.js` → `coverageDatabaseService.js`. Treat the architecture/goals below
> as accurate; treat `coverageService.js` references as historical only.

## Executive Summary

**Critical Business Model Fix**: The current system uses calendar-month billing (June 1-30, July 1-31) which assumes all students pay on the 1st. This is fundamentally incorrect for boarding house operations where each student has their own billing cycle based on when they pay.

**Impact**: This affects arrears calculations, reports, dashboard KPIs, and payment tracking - the entire financial model.

## The Problem

### Current (Incorrect) Model
- Student A pays June 1 → Overdue July 1
- Student B pays June 12 → Overdue July 1  
- Student C pays June 19 → Overdue July 1
- Student D pays June 30 → Overdue July 1

**All students become overdue on the 1st regardless of when they paid.**

### New (Correct) Model
- Student A pays June 1 → Overdue July 1 (30 days coverage)
- Student B pays June 12 → Overdue July 12 (30 days coverage)
- Student C pays June 19 → Overdue July 19 (30 days coverage)
- Student D pays June 30 → Overdue July 30 (30 days coverage)

**Each student has their own billing clock starting from their payment date.**

## Core Concept: Coverage Windows

### Daily Rate Calculation
```
daily_rate = monthly_rent / 30
```

**Example:**
- Room rent: $150/month
- Daily rate: $150 ÷ 30 = $5/day

### Coverage Calculation
```
days_covered = floor(payment_amount / daily_rate)
coverage_start = payment_date
coverage_end = payment_date + days_covered - 1
```

**Example 1: Full Payment**
- Payment: $150 on 19 June
- Days covered: $150 ÷ $5 = 30 days
- Coverage: 19 June → 18 July
- Status: PAID until 19 July

**Example 2: Partial Payment**
- Payment: $90 on 19 June
- Days covered: $90 ÷ $5 = 18 days
- Coverage: 19 June → 6 July
- Status: PAID until 7 July, then OVERDUE

**Example 3: Long-term Prepayment**
- Payment: $450 on 19 June
- Days covered: $450 ÷ $5 = 90 days
- Coverage: 19 June → 16 September
- Status: PAID for 3 months

## New Status Model

### Status Logic
| Coverage Remaining | Status | Display |
|-------------------|--------|---------|
| > 7 days | **PAID** | ✓ PAID — 12 days remaining |
| 1-7 days | **EXPIRING_SOON** | ⚠ EXPIRING SOON — 3 days remaining |
| 0 days | **DUE_TODAY** | ⚠ DUE TODAY |
| < 0 days | **OVERDUE** | ✗ OVERDUE — 5 days overdue |
| No coverage | **VACANT** | ○ VACANT |

### Replaces Old Status
- ~~PAID~~ (full month paid)
- ~~PARTIAL~~ (partial month paid)
- ~~OVERDUE~~ (month not paid)

## Database Schema Changes

### New Columns: `payments` table
```sql
ALTER TABLE payments 
  ADD COLUMN coverage_start_date date,
  ADD COLUMN coverage_end_date date,
  ADD COLUMN days_covered integer;
```

**Purpose**: Track what period each payment covers

### New Columns: `students` table
```sql
ALTER TABLE students
  ADD COLUMN coverage_start date,
  ADD COLUMN coverage_end date,
  ADD COLUMN daily_rate numeric(10,2);
```

**Purpose**: Track current coverage status for operational view

### New Functions

#### `calculate_coverage(room_rent, payment_amount, payment_date)`
Returns: `{daily_rate, days_covered, coverage_start, coverage_end}`

#### `get_student_status(coverage_end)`
Returns: `'PAID' | 'EXPIRING_SOON' | 'DUE_TODAY' | 'OVERDUE' | 'VACANT'`

#### `get_days_status(coverage_end)`
Returns: `{days_count, status_label}` (e.g., "12 days remaining" or "5 days overdue")

### New View: `student_coverage_status`
Real-time operational dashboard showing:
- Student name, property, room
- Monthly rent, daily rate
- Coverage start/end dates
- Current status
- Days remaining/overdue
- Amount overdue

### New Function: `get_dashboard_kpis()`
Returns:
```javascript
{
  total_students: 143,
  current_students: 110,
  expiring_soon: 12,
  overdue_students: 21,
  total_overdue_amount: 3250.00
}
```

## Frontend Changes

### Updated Payment Recording
```javascript
import { recordPaymentWithCoverage } from './services/coverageService';

await recordPaymentWithCoverage({
  studentId,
  roomRent: 150,  // Required for coverage calculation
  amount: 150,
  paymentDate: '2026-06-19',
  paymentMethod: 'Cash',
  receiptNumber: 'RCP-001',
  notes: '',
  recordedBy: user.id
});
```

### Student Display
```jsx
<div className="student-card">
  <div className="student-header">
    <h3>Shamah Nyakanda</h3>
    <span className="status-badge status-paid">✓ PAID — 12 days remaining</span>
  </div>
  
  <div className="student-info">
    <div>King Fisher · Room 5 · $150/mo · $5.00/day</div>
    <div>Paid $150 on 30 May 2026</div>
    <div>Coverage: 30 May → 28 Jun 2026</div>
  </div>
</div>
```

### Dashboard KPIs (Updated)
```jsx
// OLD (Incorrect)
<div>Paid: 97</div>
<div>Partial: 22</div>
<div>Overdue: 24</div>

// NEW (Correct)
<div>Current: 110</div>
<div>Expiring Soon: 12</div>
<div>Overdue: 21</div>
<div>Vacated: 8</div>
```

## Reports: Cash Basis Accounting

**Important**: Reports stay on calendar months based on payment received date.

### Example: Payment crossing months
- Payment: $150 on 30 May
- Coverage: 30 May → 28 June (crosses two months)
- **Report attribution**: Appears in **May** report (payment received date)
- **Operational view**: Coverage tracked separately

### Why?
1. Matches bank statements
2. Simple for Trevis to reconcile
3. Standard cash basis accounting
4. No confusing split payments

### Separation of Concerns
| View | Purpose | Time Basis |
|------|---------|-----------|
| **Reports** | Financial reconciliation | Calendar months |
| **Calendar** | Activity tracking | Event dates |
| **Operations** | Who needs to pay | Coverage windows |

## Implementation Steps

### Step 1: Database Migration
Run `sprint5.5_flexible_rent_cycles.sql`:
1. Add new columns
2. Create functions
3. Backfill existing payments
4. Update student coverage
5. Create views

### Step 2: Update Services
- Import `coverageService.js`
- Replace payment recording logic
- Update dashboard data fetching
- Update student status calculation

### Step 3: Update UI Components
- Dashboard: Show new KPIs
- Student cards: Show coverage info
- Payment modal: Calculate coverage on submission
- Arrears page: Filter by coverage status
- Reports: Keep unchanged (calendar basis)

### Step 4: Testing
- Test full payment (30 days)
- Test partial payment (15 days)
- Test long-term prepayment (90 days)
- Test student leaving early
- Verify dashboard KPIs
- Verify reports unchanged

## Migration Strategy

### Backwards Compatibility
- Existing `status` column preserved during transition
- New coverage columns added alongside
- Gradual migration of UI components
- Old status used as fallback if coverage data missing

### Data Backfill
- Historical payments analyzed
- Coverage calculated retroactively
- Student coverage set from latest payment
- No data loss

## Special Cases

### Student Leaves Early
- Coverage: Until 30 August
- Student checks out: 15 July
- Manager clicks "Check Out" → Status = VACATED
- Room becomes available
- Coverage history preserved
- Refund can be calculated: (30 Aug - 15 July) × daily_rate

### Long-term Student
- Payment: $450
- Monthly rent: $150
- Coverage: 90 days (3 months)
- Status: PAID for entire period
- No manual intervention needed
- Automatically expires after 90 days

### Partial Payment
- Payment: $50
- Daily rate: $5
- Coverage: 10 days
- Status shows: "10 days remaining"
- After 10 days: Automatically becomes OVERDUE

## Success Criteria

✅ Each student has independent billing cycle  
✅ Coverage calculated from payment date  
✅ Status reflects actual coverage remaining  
✅ Dashboard shows operational KPIs  
✅ Reports stay on calendar basis  
✅ Long-term prepayments handled automatically  
✅ Early checkout supported  
✅ Historical data backfilled correctly  

## Why This Must Be Done First

This changes the **fundamental billing model**. If we build:
- Audit logs
- Rate limiting  
- Playwright tests
- Performance monitoring

...and **then** redesign billing, we'll have to rewrite half of them.

The billing model is the **foundation**. Everything else builds on top of it.

## Timeline

| Task | Effort | Dependencies |
|------|--------|--------------|
| SQL migration | 1 hour | None |
| Coverage service | 2 hours | SQL complete |
| Update payment flow | 2 hours | Service complete |
| Update dashboard | 2 hours | Service complete |
| Update student cards | 2 hours | Service complete |
| Update arrears page | 2 hours | Service complete |
| Testing & validation | 3 hours | All complete |
| **Total** | **14 hours** | **~2 days** |

## Next Steps After Sprint 5.5

Once flexible rent cycles are complete:
1. Sprint 6: Hardening (audit logs, rate limiting, tests)
2. Sprint 7: Performance optimization
3. Sprint 8: Advanced features

The business model will be correct, and everything built on top of it will be accurate.

---

**Remember**: The business always wins. We build systems that reflect how they actually operate, not force them to adapt to calendar-month assumptions.
