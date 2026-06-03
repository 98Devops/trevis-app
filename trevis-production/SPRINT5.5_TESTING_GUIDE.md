# Sprint 5.5: Flexible Rent Cycle Testing Guide

## Step 1: Run the SQL Migration

1. Open **Supabase SQL Editor**
2. Copy and paste the entire contents of `sprint5.5_flexible_rent_cycles_CORRECTED.sql`
3. Click **Run**
4. You should see: "Payment backfill complete" and "Student coverage update complete: X students updated"

## Step 2: Verify Migration Success

Run these queries in Supabase SQL Editor to confirm everything worked:

### Check Payments Table Columns
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
  AND column_name IN ('coverage_start_date', 'coverage_end_date', 'days_covered');
```
**Expected**: 3 rows showing the new columns exist

### Check Backfilled Payment Data
```sql
SELECT 
  id, 
  student_id, 
  amount, 
  payment_date, 
  coverage_start_date, 
  coverage_end_date, 
  days_covered
FROM payments 
ORDER BY payment_date DESC
LIMIT 10;
```
**Expected**: All payments should have coverage dates and days_covered filled in

### Check Student Coverage Data
```sql
SELECT 
  id, 
  full_name, 
  coverage_start, 
  coverage_end, 
  daily_rate,
  status
FROM students
WHERE coverage_end IS NOT NULL
ORDER BY coverage_end ASC
LIMIT 10;
```
**Expected**: Students should have coverage dates and daily rates

### Check Coverage Status View
```sql
SELECT * FROM student_coverage_status 
ORDER BY days_count ASC NULLS LAST
LIMIT 10;
```
**Expected**: Shows students with their status (PAID, EXPIRING_SOON, OVERDUE), days remaining/overdue

### Check Dashboard KPIs
```sql
SELECT * FROM get_dashboard_kpis();
```
**Expected**: Returns counts for total_students, current_students, expiring_soon, overdue_students, total_overdue_amount

## Step 3: Test with a New Student

### Add Test Student

1. **Go to the app** and add a new student:
   - Name: "Test Student Sprint 5.5"
   - Property: King Fisher
   - Room: Any available room with $150/month rent
   - Check-in date: Today's date

### Test Scenario 1: Full Payment (30 days coverage)

2. **Record a payment** for the test student:
   - Amount: **$150**
   - Payment Date: **Today's date**
   - Method: Cash

3. **Expected Results**:
   - Coverage: Today → 29 days from today (30 days total)
   - Status: **✓ PAID — 29 days remaining**
   - Daily rate: **$5.00/day**
   - Outstanding: **$0**

4. **Verify in SQL**:
```sql
SELECT 
  s.full_name,
  p.amount,
  p.payment_date,
  p.coverage_start_date,
  p.coverage_end_date,
  p.days_covered,
  s.coverage_end,
  s.daily_rate
FROM students s
JOIN payments p ON p.student_id = s.id
WHERE s.full_name LIKE '%Test Student%'
ORDER BY p.payment_date DESC;
```

### Test Scenario 2: Partial Payment (18 days coverage)

5. **Record another payment** for a different test student:
   - Amount: **$90**
   - Payment Date: **Today's date**
   - Method: Cash

6. **Expected Results**:
   - Coverage: Today → 17 days from today (18 days total)
   - Status: **✓ PAID — 17 days remaining**
   - Days covered: **18 days** ($90 ÷ $5 = 18)
   - Outstanding: **$0** (until coverage expires)

### Test Scenario 3: Long-term Prepayment (90 days coverage)

7. **Record a long-term payment**:
   - Amount: **$450**
   - Payment Date: **Today's date**
   - Method: Bank Transfer

8. **Expected Results**:
   - Coverage: Today → 89 days from today (90 days total)
   - Status: **✓ PAID — 89 days remaining**
   - Days covered: **90 days** ($450 ÷ $5 = 90)
   - Outstanding: **$0**
   - Should stay PAID for 3 months!

## Step 4: Test Status Changes Over Time

Since we can't wait for time to pass, let's simulate it with SQL:

### Simulate EXPIRING_SOON Status (5 days remaining)

```sql
-- Temporarily set a student's coverage to expire in 5 days
UPDATE students 
SET coverage_end = CURRENT_DATE + 5
WHERE full_name LIKE '%Test Student%'
LIMIT 1;

-- Check the status
SELECT * FROM student_coverage_status 
WHERE name LIKE '%Test Student%';
```
**Expected Status**: `EXPIRING_SOON` with "5 days remaining"

### Simulate OVERDUE Status (5 days overdue)

```sql
-- Temporarily set a student's coverage to have expired 5 days ago
UPDATE students 
SET coverage_end = CURRENT_DATE - 5
WHERE full_name LIKE '%Test Student%'
LIMIT 1;

-- Check the status
SELECT * FROM student_coverage_status 
WHERE name LIKE '%Test Student%';
```
**Expected Status**: `OVERDUE` with "5 days overdue"
**Expected Amount Overdue**: $25 (5 days × $5/day)

### Reset Test Student

```sql
-- Reset the test student back to normal
UPDATE students 
SET coverage_end = CURRENT_DATE + 20
WHERE full_name LIKE '%Test Student%';
```

## Step 5: What You Should See in the UI

### Student Card Display (Expected)
```
┌─────────────────────────────────────────────┐
│ Test Student Sprint 5.5                     │
│ King Fisher · Room 5 · $150/mo · $5.00/day │
├─────────────────────────────────────────────┤
│ Paid $150 on 10 Jun 2025                   │
│ Coverage: 10 Jun → 09 Jul 2025             │
│ Status: ✓ PAID — 29 days remaining         │
│ Outstanding: $0                             │
└─────────────────────────────────────────────┘
```

### Dashboard KPIs (Expected)
```
┌─────────────┬────────────────┬─────────────┬──────────┐
│ Current     │ Expiring Soon  │ Overdue     │ Vacated  │
├─────────────┼────────────────┼─────────────┼──────────┤
│ 110         │ 12             │ 21          │ 8        │
│ > 7 days    │ 1-7 days       │ 0 days      │ Checked  │
│ remaining   │ remaining      │ remaining   │ out      │
└─────────────┴────────────────┴─────────────┴──────────┘
```

## Step 6: Test Edge Cases

### Case 1: Student with No Payments
- **Expected**: Status = `VACANT`, no coverage dates shown

### Case 2: Multiple Payments
```sql
-- Add a second payment to extend coverage
-- First payment: $150 (30 days)
-- Second payment: $150 (another 30 days)
-- Total coverage: 60 days from first payment date
```
**Note**: Currently, each payment is independent. To extend coverage, you'd need to:
1. Calculate the existing coverage end date
2. Make the second payment date = coverage_end + 1 day

### Case 3: Room Rent Change
If you change a room's rent from $150 to $180:
- **Old payments**: Keep their original coverage (calculated at $150)
- **New payments**: Use new daily rate ($180 ÷ 30 = $6/day)

## Step 7: Buttons & Functionality You Should Have

### On Student Card/Profile:
- ✅ **"Record Payment"** button → Opens payment modal
- ✅ **"View Payment History"** → Shows all payments with coverage dates
- ✅ **"Check Out Student"** → Sets status to VACATED, keeps coverage history

### In Payment Modal:
- ✅ **Amount field** → User enters payment amount
- ✅ **Payment Date field** → User selects date
- ✅ **Auto-calculation preview** → Shows: "This will cover X days (until [date])"
- ✅ **Submit** → Calculates coverage and updates student status

### On Dashboard:
- ✅ **Current Students** card → Click to filter by PAID status
- ✅ **Expiring Soon** card → Click to filter by EXPIRING_SOON status
- ✅ **Overdue** card → Click to filter by OVERDUE status

### In Arrears/Finances View:
- ✅ **Filter by Status** dropdown → PAID, EXPIRING_SOON, OVERDUE, ALL
- ✅ **Sort by Days Overdue** → Shows most overdue first
- ✅ **Outstanding Amount** column → Calculated from coverage

## Step 8: Expected Calculations

### Daily Rate
```
daily_rate = room_rent ÷ 30
```
Examples:
- $150/month → $5.00/day
- $180/month → $6.00/day
- $110/month → $3.67/day

### Days Covered
```
days_covered = floor(payment_amount ÷ daily_rate)
```
Examples:
- $150 payment, $5/day → 30 days
- $90 payment, $5/day → 18 days
- $450 payment, $5/day → 90 days
- $100 payment, $5/day → 20 days

### Coverage Period
```
coverage_start = payment_date
coverage_end = payment_date + days_covered - 1
```
Examples:
- Payment: 10 Jun, 30 days → 10 Jun to 09 Jul
- Payment: 15 Jun, 18 days → 15 Jun to 02 Jul

### Outstanding Amount
```
If coverage_end < today:
  outstanding = (today - coverage_end) × daily_rate
Else:
  outstanding = 0
```
Examples:
- Coverage ended 5 days ago, $5/day → $25 overdue
- Coverage ended 10 days ago, $5/day → $50 overdue
- Coverage ends in 5 days → $0 overdue

## Troubleshooting

### If payments don't show coverage dates:
1. Check the payment was recorded AFTER running the SQL migration
2. Run the backfill script again:
```sql
-- Re-run just the backfill section from the migration script
```

### If student status is wrong:
1. Check the coverage_end date in students table
2. Verify the get_student_status() function is working:
```sql
SELECT get_student_status('2025-06-20');  -- Future date = PAID
SELECT get_student_status('2025-06-10');  -- Today = varies
SELECT get_student_status('2025-06-01');  -- Past date = OVERDUE
```

### If dashboard KPIs are wrong:
```sql
-- Check the view directly
SELECT status, COUNT(*) 
FROM student_coverage_status 
GROUP BY status;
```

## Success Criteria Checklist

✅ SQL migration runs without errors
✅ All payments have coverage dates
✅ All students have coverage dates (if they have payments)
✅ student_coverage_status view returns data
✅ get_dashboard_kpis() returns correct counts
✅ Test student with $150 payment shows 30 days coverage
✅ Test student with $90 payment shows 18 days coverage
✅ Test student with $450 payment shows 90 days coverage
✅ Status changes correctly (PAID → EXPIRING_SOON → OVERDUE)
✅ Outstanding amount calculates correctly for overdue students
✅ Payment modal shows coverage calculation
✅ Dashboard shows new KPI cards

## What's Next After Testing

Once you've verified everything works:

1. **Update the frontend** to use the new coverage service
2. **Update dashboard** to show new KPIs (Current/Expiring/Overdue)
3. **Update student cards** to show coverage info
4. **Update payment modal** to show coverage preview
5. **Update arrears page** to filter by coverage status
6. **Keep reports unchanged** (they stay on calendar month basis)

The system will now correctly track each student's individual billing cycle!
