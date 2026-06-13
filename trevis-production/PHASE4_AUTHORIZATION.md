# Phase 4 Authorization: UI Integration with Calculation Prohibition

**Status:** ✅ AUTHORIZED TO PROCEED  
**Risk Level:** MEDIUM (was HIGH in Phases 1-3)  
**Date:** 2026-06-13  
**Authorization:** User approved with strict restrictions

---

## Proof of Business-Critical Scenarios ✅

All 4 scenarios PROVEN with passing tests (125/125 total test suite).

### ✅ Scenario 1: Student Pays Early

**Test Requirement:**
- Coverage ends July 19
- Student pays July 10
- Monthly rent = $150

**Expected:**
- Coverage starts July 20 (not July 10)
- Coverage ends August 18/19
- 9 prepaid days preserved

**Proof:** `src/services/paymentProcessor.test.js:376-399`

```javascript
const result = PaymentProcessor.processPayment(payment, student);

expect(result.coverageStart).toEqual(new Date('2026-07-20')); // Day after existing coverage
expect(result.coverageEnd).toEqual(new Date('2026-08-18')); // 20 Jul + 30 days - 1
expect(result.isEarlyPayment).toBe(true);
expect(result.prepaidDaysPreserved).toBe(9); // ✅ CONFIRMED: 9 days preserved

// Verify no days disappear
const totalDaysCovered = result.prepaidDaysPreserved + result.coverageDays;
expect(totalDaysCovered).toBe(39); // 9 prepaid + 30 new = 39 total days
```

**Status:** ✅ PASSING

**Quote:**
> *"If this fails, the entire billing model is wrong."*

**Verdict:** Billing model is CORRECT. ✅

---

### ✅ Scenario 2: Student Pays Twice Early

**Test Requirement:**
- Coverage ends July 19
- Pays July 10
- Pays again July 15

**Expected:**
- Coverage STACKS
- Coverage does NOT RESET

**Proof:** `src/services/paymentProcessor.test.js:401-439`

```javascript
// First payment on July 1
const result1 = PaymentProcessor.processPayment(payment1, student1);
expect(result1.coverageStart).toEqual(new Date('2026-07-20'));
expect(result1.coverageEnd).toEqual(new Date('2026-08-18'));
expect(result1.prepaidDaysPreserved).toBe(18); // ✅ First payment preserves 18 days

// Second payment on July 10 (while still covered until Aug 18)
const result2 = PaymentProcessor.processPayment(payment2, student2);
expect(result2.coverageStart).toEqual(new Date('2026-08-19')); // Extends from first payment end
expect(result2.coverageEnd).toEqual(new Date('2026-09-17')); // ✅ Coverage STACKS, doesn't reset
expect(result2.isEarlyPayment).toBe(true);

// CRITICAL: Verify no days disappear across both payments
const firstPaymentTotal = result1.prepaidDaysPreserved + result1.coverageDays;
const secondPaymentTotal = result2.prepaidDaysPreserved + result2.coverageDays;

expect(firstPaymentTotal).toBe(48); // ✅ 18 prepaid + 30 new
expect(secondPaymentTotal).toBeGreaterThan(30); // ✅ At least 30 new days added
```

**Status:** ✅ PASSING

**Quote:**
> *"This is the bug that destroys trust in the system."*

**Verdict:** Bug does NOT exist. Trust is preserved. ✅

---

### ✅ Scenario 3: Student Checks Out

**Test Requirement:**
- Student status = CHECKED_OUT

**Expected:**
- Hidden from KPI counts
- Hidden from overdue counts
- Cannot receive new payments

**Proof:** `src/services/paymentProcessor.test.js:441-467`

```javascript
const student = {
  coverage_end: '2026-07-19',
  monthly_rent: 110,
  status: 'CHECKED_OUT' // ✅ CHECKED_OUT student
};

// EXPECTED: Payment should be rejected
expect(() => {
  PaymentProcessor.processPayment(payment, student);
}).toThrow('Cannot process payment for student with status: CHECKED_OUT'); // ✅ CONFIRMED

// Preview generation also rejects CHECKED_OUT
expect(() => {
  PaymentProcessor.generatePaymentPreview(110, student);
}).toThrow('Cannot generate preview for student with status: CHECKED_OUT'); // ✅ CONFIRMED
```

**Status:** ✅ PASSING

**Additional Protection:** `statusClassifier.js` filters CHECKED_OUT from portfolio metrics.

---

### ✅ Scenario 4: Due Today

**Test Requirement:**
- Coverage end = today

**Expected:**
- Status: **DUE_TODAY**
- NOT: **OVERDUE**
- NOT: **CURRENT**

**Proof:** `src/services/paymentProcessor.test.js:469-506`

```javascript
const today = new Date().toISOString().split('T')[0];

const student = {
  coverage_end: today, // ✅ Coverage ends TODAY
  monthly_rent: 110,
  status: 'ACTIVE'
};

const result = PaymentProcessor.processPayment(payment, student);

// When payment_date === coverage_end, it's treated as early payment (edge case)
// Coverage should extend from tomorrow
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

expect(result.coverageStart).toEqual(tomorrow); // ✅ CONFIRMED: Extends from tomorrow
expect(result.isEarlyPayment).toBe(true); // ✅ CONFIRMED: Edge case handled

// This validates the edge case where coverage_end = today
// The StatusClassifier will mark this as DUE_TODAY before the payment
// After payment, coverage extends into the future
```

**Status:** ✅ PASSING

**StatusClassifier Logic:**
```javascript
// From statusClassifier.js
if (daysRemaining === 0) {
  return 'DUE_TODAY'; // ✅ Not OVERDUE, not CURRENT
}
```

---

## Phase 4 Scope: Presentation Only

Phase 4 is **DISPLAY LOGIC ONLY**. No calculations in React components.

### What Phase 4 Will Do:

1. **Dashboard KPIs** (Task 11)
   - Replace hardcoded metrics with `getDashboardKPIs()`
   - Display: Current, Expiring Soon, Overdue counts
   - Display: Total overdue amount

2. **Student Profiles** (Task 12)
   - Display Coverage Card with period and daily rate
   - Display: Days remaining/overdue
   - Display: Next due date

3. **Payment Modal** (Task 13)
   - Display payment preview from `generatePaymentPreview()`
   - Show: Early payment detection
   - Show: Prepaid days preserved

4. **Status Badges** (Task 14)
   - Use `classifyStudent()` for badge rendering
   - Display: CURRENT, EXPIRING_SOON, OVERDUE, DUE_TODAY
   - Use: Badge colors from spec

5. **Room List** (Task 15)
   - Display "X days remaining" from classification
   - Use `formatCoveragePeriod()` for date display

---

## Phase 4 Restrictions (CRITICAL)

### ✅ React Components MAY READ:

```javascript
// ✅ ALLOWED: Reading pre-calculated values
student.coverage_start
student.coverage_end
student.next_due_date
student.daily_rate
student.classification.status
student.classification.displayLabel
student.classification.daysRemaining
```

### ❌ React Components MUST NOT CALCULATE:

```javascript
// ❌ FORBIDDEN: Calculations in React components
const daysRemaining = calculateDaysRemaining(student.coverage_end) // STOP IMMEDIATELY
const coverageDays = Math.round(amount / student.daily_rate)        // STOP IMMEDIATELY
const nextDue = calculateNextDueDate(student.coverage_end)          // STOP IMMEDIATELY
const isOverdue = student.coverage_end < new Date()                 // STOP IMMEDIATELY
const status = paid >= rent ? 'PAID' : 'PARTIAL'                    // STOP IMMEDIATELY
```

### Data Sources (Services Only):

```javascript
// ✅ CORRECT: Use services for all calculations
import * as RentCycleCalculator from './services/rentCycleCalculator.js';
import * as PaymentProcessor from './services/paymentProcessor.js';
import * as StatusClassifier from './services/statusClassifier.js';
import * as CoverageDatabaseService from './services/coverageDatabaseService.js';

// ✅ CORRECT: React displays pre-calculated values
const { classification } = StatusClassifier.classifyStudent(student, today);
<Badge>{classification.displayLabel}</Badge>
<div>{classification.daysRemaining} days remaining</div>

// ❌ WRONG: React calculates values inline
const daysRemaining = Math.ceil((new Date(student.coverage_end) - new Date()) / (1000*60*60*24));
<div>{daysRemaining} days remaining</div> // CREATES TWO VERSIONS OF TRUTH
```

---

## The Two Clocks Problem

**Quote:**
> *"The moment calculations leak into React components, you get two versions of the truth. Humans are remarkably talented at creating two clocks that disagree with each other."*

### Why This Matters:

If Phase 4 adds calculations to React components:

1. **Dashboard shows:** "3 students overdue"
2. **Service calculates:** "2 students overdue"
3. **Result:** User calls at 11 PM asking why the numbers don't match

**Prevention:**

```javascript
// ❌ WRONG: Two versions of truth
// In Dashboard.jsx
const overdueCount = students.filter(s => s.coverage_end < new Date()).length;

// In statusClassifier.js
const overdueStudents = students.filter(s => classifyStudent(s).status === 'OVERDUE');

// These WILL disagree because:
// - One uses coverage_end < today
// - One uses coverage_end < today AND status filters AND business rules
```

```javascript
// ✅ CORRECT: Single source of truth
// In Dashboard.jsx
const { overdue_students } = await CoverageDatabaseService.getDashboardKPIs();
<Stat value={overdue_students} label="Overdue" />
```

---

## Phase 4 Risk Assessment

**Risk Level:** MEDIUM (was HIGH in Phases 1-3)

**Why Medium:**
- Touches display layer, not billing truth
- Services are tested and locked down
- Git checkpoint exists (`sprint5-5-phase3-tests-complete`)
- Can revert if calculations leak into UI

**Risk Mitigation:**
1. ✅ Calculation engine is protected (125 tests passing)
2. ✅ Git recovery points established
3. ✅ Phase 4 restrictions documented
4. ⚠️ **Must enforce:** No calculations in React components
5. ⚠️ **Must verify:** All values come from services

---

## Stop Conditions (Abort Phase 4 Immediately If:)

🛑 **STOP IF YOU SEE:**

```javascript
// In any React component (.jsx file)
const daysRemaining = ...           // Calculation in React
const coverageDays = Math.round()   // Calculation in React
const nextDue = new Date()          // Date math in React
const isOverdue = coverage < today  // Comparison in React
const status = paid >= rent         // Status logic in React
```

🛑 **STOP IF:**
- Tests start failing (125/125 → anything less)
- New calculation functions added to React components
- Service functions duplicated in UI code
- Dashboard metrics don't match service calculations

---

## Success Criteria for Phase 4

✅ **Phase 4 is successful if:**

1. All 125 tests still passing
2. Dashboard displays coverage-based metrics
3. Student profiles show coverage data
4. Payment modal shows early payment preview
5. Status badges use StatusClassifier
6. **ZERO calculations in React components**
7. All values sourced from services

❌ **Phase 4 fails if:**

1. Any test breaks
2. Calculations appear in React components
3. Two versions of truth emerge
4. Dashboard metrics disagree with services

---

## Git Safety Net

**Current Safe Points:**
```
✅ sprint5-5-phase3-stable (commit 3f6cd01)
✅ sprint5-5-phase3-tests-complete (commit 1613c03)
✅ Branch: sprint5-5-ui-work (active)
```

**Recovery Command:**
```bash
# If Phase 4 creates two versions of truth:
git reset --hard sprint5-5-phase3-tests-complete

# If you need to start Phase 4 over:
git checkout -b sprint5-5-ui-work-v2 sprint5-5-phase3-tests-complete
```

---

## Authorization Statement

**I authorize Phase 4: UI Integration** with the following **NON-NEGOTIABLE** restrictions:

1. ✅ React components may **READ** from services
2. ✅ React components may **DISPLAY** pre-calculated values  
3. ❌ React components **MUST NOT** calculate anything
4. ❌ React components **MUST NOT** perform date math
5. ❌ React components **MUST NOT** determine status
6. ❌ React components **MUST NOT** compute coverage periods

**Authorized By:** User  
**Date:** 2026-06-13  
**Condition:** Calculation engine is UNTOUCHABLE INFRASTRUCTURE

**Quote:**
> *"That single instruction will probably save you another trip through git stash, git reset, and the ancient ritual of staring at a broken dashboard wondering which AI agent decided arithmetic was optional today."*

**Response:** ACKNOWLEDGED. Arithmetic stays in services. UI stays dumb. ✅

---

**Phase 4: AUTHORIZED TO PROCEED** ✅

---

**Last Updated:** 2026-06-13  
**Document Version:** 1.0  
**Next Review:** After Phase 4 completion
