# Critical Business Rules - Flexible Rent Cycle Engine

## System of Record

**Coverage_End_Date** is the single source of truth for all billing and operational decisions.

---

## The 5 Non-Negotiable Rules

### 1. Coverage_End_Date is Primary Billing Truth

✅ **DO:**
- Use `coverage_end` for all status calculations
- Derive dashboard metrics from `coverage_end`
- Calculate days remaining/overdue from `coverage_end`
- Use `coverage_end` for arrears bucketing

❌ **DON'T:**
- Use calendar months for operational decisions
- Reference `month_year` for status determination
- Calculate overdue from "1st of month"
- Make billing assumptions based on calendar dates

---

### 2. Early Payments Extend Existing Coverage

✅ **DO:**
- Check if `payment_date < coverage_end` (early payment detection)
- Start new coverage on `(coverage_end + 1)` for early payments
- Calculate: `new_coverage_end = existing_coverage_end + calculated_days`
- Show in UI: "Extends coverage from [date] to [date]"

❌ **DON'T:**
- Reset coverage from `payment_date` when coverage exists
- Discard days between `payment_date` and `coverage_end`
- Override `coverage_end` without checking existing value
- Allow coverage to move backward in time

**Example:**
```
Student has coverage until June 25
Payment made on June 15 for 30 days
WRONG: Coverage = June 15 to July 14 (loses 10 days)
RIGHT: Coverage = June 26 to July 25 (preserves 10 days + adds 30)
```

---

### 3. Prepaid Days Can NEVER Be Lost

✅ **DO:**
- Validate prepaid day preservation in payment processing
- Log prepaid days saved: `prepaidDaysPreserved` field
- Test coverage extension logic with property-based tests
- Audit trail: record when early payment extends coverage

❌ **DON'T:**
- Allow any payment logic that reduces `coverage_end`
- Skip validation of existing `coverage_end` before update
- Implement "reset from payment date" for all payments
- Trust payment date as coverage start without checking

**Validation:**
```javascript
if (existingCoverageEnd && paymentDate <= existingCoverageEnd) {
  // Early payment detected
  coverageStart = new Date(existingCoverageEnd);
  coverageStart.setDate(coverageStart.getDate() + 1);
  prepaidDaysPreserved = Math.ceil((existingCoverageEnd - paymentDate) / (1000 * 60 * 60 * 24));
}
```

---

### 4. ACTIVE vs CHECKED_OUT States

✅ **DO:**
- Filter `status = 'ACTIVE'` in all student queries for metrics
- Exclude `status = 'CHECKED_OUT'` from dashboard counts
- Return `excludeFromMetrics: true` for non-ACTIVE students
- Show checked-out students in reports but not KPIs

❌ **DON'T:**
- Include CHECKED_OUT students in Current/Expiring/Overdue counts
- Calculate coverage status for non-ACTIVE students
- Show checked-out students in arrears view
- Count checked-out students toward collection rate

**Query Pattern:**
```javascript
const { data: students } = await supabase
  .from('students')
  .select('*, rooms!inner(rent_per_bed, properties(id))')
  .eq('rooms.property_id', propertyId)
  .eq('status', 'ACTIVE'); // Critical filter
```

---

### 5. Dashboard Metrics Derive from Coverage Dates

✅ **DO:**
- Current: `coverage_end > (today + 7 days)`
- Expiring Soon: `coverage_end between today and (today + 7 days)`
- Overdue: `coverage_end < today`
- Filter by `status = 'ACTIVE'` FIRST

❌ **DON'T:**
- Use `monthly_obligations` table for dashboard counts
- Reference calendar months (January, February, etc.)
- Assume "overdue" means "past 1st of month"
- Calculate from `payment_date` or `billing_anchor_date`

**Status Classification:**
```javascript
classifyStatus(coverageEndDate, currentDate, studentStatus) {
  if (studentStatus !== 'ACTIVE') {
    return { status: 'EXCLUDED', excludeFromMetrics: true };
  }
  
  const daysRemaining = Math.ceil((coverageEndDate - currentDate) / (1000 * 60 * 60 * 24));
  
  if (daysRemaining > 7) return { status: 'CURRENT' };
  if (daysRemaining >= 1) return { status: 'EXPIRING_SOON' };
  return { status: 'OVERDUE', daysOverdue: Math.abs(daysRemaining) };
}
```

---

## Implementation Checklist for Phase 2

When creating JavaScript services, ensure:

- [ ] **RentCycleCalculator**
  - [ ] Calculates coverage days from amount and daily rate
  - [ ] No assumptions about payment timing
  
- [ ] **PaymentProcessor**
  - [ ] Checks `student.coverage_end` before processing
  - [ ] Detects early payments: `payment_date < coverage_end`
  - [ ] Extends from `coverage_end + 1` for early payments
  - [ ] Starts from `payment_date` for normal payments
  - [ ] Returns `isEarlyPayment` and `prepaidDaysPreserved` flags
  - [ ] Never overwrites prepaid coverage
  
- [ ] **StatusClassifier**
  - [ ] Accepts `studentStatus` parameter
  - [ ] Returns `excludeFromMetrics: true` for non-ACTIVE
  - [ ] Calculates from `coverage_end` only
  - [ ] Never references calendar months
  - [ ] Includes `studentStatus` validation in all methods
  
- [ ] **Enhanced Student Service**
  - [ ] Filters `status = 'ACTIVE'` in queries
  - [ ] Passes `student.status` to StatusClassifier
  - [ ] Uses `coverage_end` field (not coverage_end_date)
  - [ ] Handles null coverage_end gracefully

---

## Testing Requirements

### Property-Based Tests Must Validate:

1. **Early Payment Coverage Extension**
   ```javascript
   Property: For any payment where payment_date < existing_coverage_end,
   new_coverage_end = existing_coverage_end + calculated_days
   ```

2. **Prepaid Day Preservation**
   ```javascript
   Property: For any early payment, 
   prepaidDaysPreserved >= 0 AND
   new_coverage_end > existing_coverage_end
   ```

3. **Status Exclusion for Non-ACTIVE**
   ```javascript
   Property: For any student where status != 'ACTIVE',
   classifyStatus().excludeFromMetrics === true
   ```

4. **Dashboard Count Accuracy**
   ```javascript
   Property: For any student collection,
   dashboard_total = students.filter(s => s.status === 'ACTIVE').length
   ```

---

## Common Pitfalls to Avoid

1. **Resetting Coverage on Every Payment**
   - Symptom: Student pays early, loses prepaid days
   - Fix: Check existing `coverage_end` before calculating new coverage

2. **Including CHECKED_OUT in Metrics**
   - Symptom: Dashboard shows wrong counts
   - Fix: Filter `status = 'ACTIVE'` in ALL metric queries

3. **Using Calendar Months for Status**
   - Symptom: Student shows overdue when they still have coverage
   - Fix: Calculate days from `coverage_end - current_date`

4. **Assuming Payment Date = Coverage Start**
   - Symptom: Early payments restart coverage, losing prepaid days
   - Fix: Use `coverage_end + 1` as start for early payments

---

## Quick Reference: Field Names

| Correct (Your Schema) | Wrong (Don't Use) |
|-----------------------|-------------------|
| `coverage_end` | `coverage_end_date` |
| `coverage_start` | `coverage_start_date` |
| `status = 'ACTIVE'` | `status = 'CHECKED_IN'` |
| `status = 'CHECKED_OUT'` | `status = 'VACATED'` |

---

## Phase 2 Entry Criteria

Before starting Phase 2 implementation:

✅ Phase 1 complete: All validation audits pass  
✅ Database fields populated: `billing_anchor_date`, `coverage_end`, `next_due_date`, `daily_rate`  
✅ App still functional on localhost:5173  
✅ This document reviewed and understood  
✅ Requirements and design documents updated with critical rules  

---

## Questions to Ask During Implementation

When writing any service method, ask:

1. **Am I checking existing coverage_end before calculating new coverage?**
2. **Am I filtering status = 'ACTIVE' for dashboard metrics?**
3. **Am I using coverage_end (not calendar months) for status?**
4. **Will this logic preserve prepaid days for early payments?**
5. **Am I passing studentStatus to StatusClassifier?**

If the answer to ANY question is "no" or "maybe", stop and review this document.

---

**Last Updated:** After Phase 1 Validation Audit Pass (126/126)  
**Next Milestone:** Phase 2 - Coverage Calculation Engine Implementation
