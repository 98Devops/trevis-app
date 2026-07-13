# Sprint 5.5 Migration Verification Checklist

Quick reference for running verification queries during migration.

## ✅ Pre-Migration Checklist

Run these queries and **save the results** before any migration:

```sql
-- □ Save payment count
SELECT COUNT(*) as payment_count, SUM(amount) as total_amount FROM payments;

-- □ Save student count  
SELECT COUNT(*) as student_count FROM students WHERE status NOT IN ('VACANT', 'VACATED');

-- □ Save payment hash
SELECT MD5(STRING_AGG(
  id::text || student_id::text || amount::text || payment_date::text || month_year,
  '' ORDER BY payment_date, id
)) as payment_hash FROM payments;

-- □ Save student hash
SELECT MD5(STRING_AGG(
  id::text || full_name || COALESCE(room_id::text, '') || status,
  '' ORDER BY created_at, id
)) as student_hash FROM students;
```

**Record Results:**
- Payment count: ___________
- Total amount: ___________
- Student count: ___________
- Payment hash: ___________
- Student hash: ___________

---

## ✅ Post-Schema Migration Checklist (After Task 1.1)

```sql
-- □ Verify students table has 4 new columns
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('billing_anchor_date', 'coverage_end_date', 'next_due_date', 'daily_rate');
-- Expected: 4

-- □ Verify payments table has 3 new columns
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('coverage_start', 'coverage_end', 'coverage_days');
-- Expected: 3

-- □ Verify students table still has all existing columns
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('id', 'full_name', 'phone', 'national_id', 'room_id', 
                      'check_in_date', 'check_out_date', 'payment_plan', 'status');
-- Expected: 9 or more

-- □ Verify payments table still has all existing columns
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('id', 'student_id', 'amount', 'payment_date', 'payment_method',
                      'receipt_number', 'month_year', 'notes');
-- Expected: 8 or more
```

**Schema Check:** ✅ Pass / ❌ Fail

---

## ✅ Post-Population Checklist (After Task 1.2)

### Data Preservation (Requirements 8.3, 8.4)

```sql
-- □ Verify payment count unchanged
SELECT COUNT(*) as payment_count, SUM(amount) as total_amount FROM payments;
-- Must match pre-migration values: ✅ / ❌

-- □ Verify student count unchanged
SELECT COUNT(*) as student_count FROM students WHERE status NOT IN ('VACANT', 'VACATED');
-- Must match pre-migration values: ✅ / ❌

-- □ Verify payment hash unchanged
SELECT MD5(STRING_AGG(
  id::text || student_id::text || amount::text || payment_date::text || month_year,
  '' ORDER BY payment_date, id
)) as payment_hash FROM payments;
-- Must match pre-migration hash: ✅ / ❌

-- □ Verify student hash unchanged
SELECT MD5(STRING_AGG(
  id::text || full_name || COALESCE(room_id::text, '') || status,
  '' ORDER BY created_at, id
)) as student_hash FROM students;
-- Must match pre-migration hash: ✅ / ❌
```

**Data Preservation:** ✅ All Pass / ❌ FAIL - DO NOT PROCEED

---

### Field Population (Requirement 8.5)

```sql
-- □ Check payment field population rate
SELECT 
  COUNT(*) as total,
  COUNT(coverage_start) as populated,
  ROUND(100.0 * COUNT(coverage_start) / COUNT(*), 1) as percentage
FROM payments;
-- Expected: >95%  | Actual: _____% | ✅ / ❌

-- □ Check student field population rate
SELECT 
  COUNT(*) as total,
  COUNT(coverage_end_date) as populated,
  ROUND(100.0 * COUNT(coverage_end_date) / COUNT(*), 1) as percentage
FROM students WHERE status NOT IN ('VACANT', 'VACATED');
-- Expected: >95%  | Actual: _____% | ✅ / ❌
```

**Field Population:** ✅ Pass / ❌ Fail

---

### Calculation Accuracy (Requirement 8.5)

```sql
-- □ Sample check: View 5 students with coverage calculations
SELECT 
  s.full_name,
  r.rent_per_bed,
  p.amount,
  -- Daily rate check
  s.daily_rate as stored,
  ROUND(r.rent_per_bed / 30.0, 2) as expected,
  CASE WHEN ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01 
       THEN '✓' ELSE '✗' END as daily_rate,
  -- Coverage days check
  p.coverage_days as stored_days,
  ROUND(p.amount / s.daily_rate) as expected_days,
  CASE WHEN p.coverage_days = ROUND(p.amount / s.daily_rate)
       THEN '✓' ELSE '✗' END as coverage_days,
  -- Coverage end check
  p.coverage_end as stored_end,
  p.payment_date + (p.coverage_days - 1) as expected_end,
  CASE WHEN p.coverage_end = p.payment_date + (p.coverage_days - 1)
       THEN '✓' ELSE '✗' END as coverage_end
FROM students s
JOIN rooms r ON r.id = s.room_id
JOIN LATERAL (
  SELECT * FROM payments WHERE student_id = s.id ORDER BY payment_date DESC LIMIT 1
) p ON TRUE
WHERE s.status = 'ACTIVE' AND s.coverage_end_date IS NOT NULL
LIMIT 5;
-- All checks should show ✓
```

**Manual Review:**
- Student 1: Daily rate ✅/❌, Coverage days ✅/❌, Coverage end ✅/❌
- Student 2: Daily rate ✅/❌, Coverage days ✅/❌, Coverage end ✅/❌
- Student 3: Daily rate ✅/❌, Coverage days ✅/❌, Coverage end ✅/❌
- Student 4: Daily rate ✅/❌, Coverage days ✅/❌, Coverage end ✅/❌
- Student 5: Daily rate ✅/❌, Coverage days ✅/❌, Coverage end ✅/❌

```sql
-- □ Daily rate accuracy (all students)
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (
    WHERE ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
  ) as correct,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
  ) / COUNT(*), 2) as accuracy
FROM students s JOIN rooms r ON r.id = s.room_id
WHERE s.daily_rate IS NOT NULL;
-- Expected: 100%  | Actual: _____% | ✅ / ❌

-- □ Coverage period accuracy (all payments)
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (
    WHERE p.coverage_end = p.payment_date + (p.coverage_days - 1)
  ) as correct,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE p.coverage_end = p.payment_date + (p.coverage_days - 1)
  ) / COUNT(*), 2) as accuracy
FROM payments p
WHERE p.coverage_start IS NOT NULL;
-- Expected: 100%  | Actual: _____% | ✅ / ❌
```

**Calculation Accuracy:** ✅ All Pass / ❌ Fail

---

### Data Quality

```sql
-- □ Check for invalid coverage days (should be empty)
SELECT COUNT(*) FROM payments 
WHERE coverage_days IS NOT NULL AND coverage_days <= 0;
-- Expected: 0  | Actual: _____ | ✅ / ❌

-- □ Check for students with payments but no coverage
SELECT COUNT(*) FROM students s
WHERE s.status NOT IN ('VACANT', 'VACATED')
  AND s.coverage_end_date IS NULL
  AND EXISTS (SELECT 1 FROM payments WHERE student_id = s.id);
-- Expected: 0  | Actual: _____ | ✅ / ❌

-- □ Check for unrealistic coverage (>90 days)
SELECT COUNT(*) FROM payments WHERE coverage_days > 90;
-- Expected: 0 or very few  | Actual: _____ | ✅ / ❌
```

**Data Quality:** ✅ Pass / ❌ Issues Found

---

## ✅ Final Summary

Run the comprehensive summary:

```sql
-- □ Overall migration health check
-- (Run the full Section 6 query from sprint5.5_verification_queries.sql)
```

**Summary Result:**
```
Overall Status: ✓✓✓ MIGRATION SUCCESSFUL / ⚠ PARTIAL / ✗ FAILED
```

---

## 📋 Decision Matrix

| Check Category | Status | Action |
|----------------|--------|--------|
| Pre-migration baseline | ✅ / ❌ | Save all values |
| Schema changes | ✅ / ❌ | All columns must exist |
| Data preservation (Req 8.3, 8.4) | ✅ / ❌ | **CRITICAL** - Hashes must match |
| Field population | ✅ / ❌ | Must be >90% |
| Calculation accuracy (Req 8.5) | ✅ / ❌ | **CRITICAL** - Must be 100% |
| Data quality | ✅ / ❌ | No invalid data |

**Proceed to Phase 2 if:**
- ✅ All checks pass
- ✅ Data preservation verified (hashes match)
- ✅ Calculation accuracy = 100%
- ✅ No critical data quality issues

**DO NOT PROCEED if:**
- ❌ Any data preservation check fails (Req 8.3, 8.4 violated)
- ❌ Calculation accuracy < 100% (Req 8.5 violated)
- ❌ Critical data quality issues exist
- ❌ Rollback and fix issues first

---

## 🔧 Quick Fixes

### If population percentage is low:

```sql
-- Run the population function again
SELECT populate_rent_cycle_fields();

-- Or manually for specific students
UPDATE students s
SET daily_rate = ROUND(r.rent_per_bed / 30.0, 2)
FROM rooms r
WHERE s.room_id = r.id
  AND s.daily_rate IS NULL
  AND s.status NOT IN ('VACANT', 'VACATED');
```

### If calculations are incorrect:

```sql
-- Clear incorrect data
UPDATE students 
SET billing_anchor_date = NULL, 
    coverage_end_date = NULL, 
    next_due_date = NULL, 
    daily_rate = NULL;

UPDATE payments 
SET coverage_start = NULL, 
    coverage_end = NULL, 
    coverage_days = NULL;

-- Fix population function
-- Re-run population
```

### If data preservation fails:

```sql
-- CRITICAL: Rollback immediately
-- DO NOT proceed with migration
-- Review what modified existing data
-- Fix population function to only update NEW columns
```

---

## ✍️ Sign-off

**Migration verified by:** _________________

**Date:** _________________

**All checks passed:** YES / NO

**Ready for Phase 2:** YES / NO

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
