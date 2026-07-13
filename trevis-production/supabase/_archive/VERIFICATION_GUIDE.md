# Sprint 5.5 Migration Verification Guide

## Overview

This guide explains how to use the verification queries in `sprint5.5_verification_queries.sql` to ensure the rent cycle engine migration preserves data integrity and populates new fields correctly.

## Requirements Validated

- **Requirement 8.3**: All existing payment records preserved unchanged
- **Requirement 8.4**: All existing student records preserved unchanged  
- **Requirement 8.5**: New fields populated correctly for sample students with accurate coverage calculations

## Verification Process

### Step 1: Pre-Migration Baseline (BEFORE Task 1.1)

Run **Section 1** queries to capture baseline data:

```sql
-- Copy and run queries 1.1 through 1.4
```

**Save these results:**
- Total payment count
- Total student count  
- Payment data hash
- Student data hash

These will be compared after migration to ensure no data loss.

### Step 2: Schema Verification (AFTER Task 1.1)

After applying the schema migration, run **Section 2** queries:

```sql
-- Copy and run queries 2.1 through 2.4
```

**Expected Results:**

**Query 2.1 - Students table new columns:**
| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| billing_anchor_date | date | YES |
| coverage_end_date | date | YES |
| next_due_date | date | YES |
| daily_rate | numeric | YES |

**Query 2.2 - Payments table new columns:**
| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| coverage_start | date | YES |
| coverage_end | date | YES |
| coverage_days | integer | YES |

**Query 2.3 - Students existing columns:** Should return count = 12

**Query 2.4 - Payments existing columns:** Should return count = 10

### Step 3: Data Preservation Verification (AFTER Task 1.2)

After running the data population function, run **Section 3** queries:

```sql
-- Copy and run queries 3.1 through 3.6
```

**Critical Checks:**

**Query 3.1 - Payment data integrity:**
- Hash MUST match pre-migration hash from Step 1 (query 1.3)
- Record count MUST match pre-migration count from Step 1 (query 1.1)
- ✗ If hash differs: Existing payment data was modified (VIOLATION of Req 8.3)

**Query 3.2 - Student data integrity:**
- Hash MUST match pre-migration hash from Step 1 (query 1.4)
- Record count MUST match pre-migration count from Step 1 (query 1.2)
- ✗ If hash differs: Existing student data was modified (VIOLATION of Req 8.4)

**Query 3.3 - Payment counts:**
- All values must match Step 1 query 1.1 exactly
- Total amount, earliest payment, latest payment must be identical

**Query 3.4 - Student counts:**
- All values must match Step 1 query 1.2 exactly
- Active count, inactive count must be identical

**Query 3.5 & 3.6 - No deletions:**
- Both must show "✓ PASS" result
- ✗ If "FAIL": Records were deleted (VIOLATION)

### Step 4: Coverage Calculation Verification (AFTER Task 1.2)

Run **Section 4** queries to verify new fields populated correctly:

```sql
-- Copy and run queries 4.1 through 4.5
```

**Expected Results:**

**Query 4.1 - Payment coverage fields:**
- population_percentage should be ≥ 95%
- Lower percentage acceptable only if some payments lack valid student/room data

**Query 4.2 - Student billing fields:**
- population_percentage should be ≥ 95% for active students
- Only active students with payments should have coverage data

**Query 4.3 - Sample student calculations (Requirement 8.5):**

This query validates coverage calculations for 5 sample students. All match columns should show ✓:

| Check | Formula | Expected |
|-------|---------|----------|
| daily_rate_match | ✓ | daily_rate = rent_per_bed / 30 |
| coverage_days_match | ✓ | coverage_days = ROUND(amount / daily_rate) |
| coverage_end_match | ✓ | coverage_end = payment_date + coverage_days - 1 |
| billing_anchor_match | ✓ | billing_anchor day-of-month = payment_date day-of-month |

✗ If any show ✗: Coverage calculation logic is incorrect

**Query 4.4 - Daily rate accuracy:**
- accuracy_percentage MUST be 100%
- Daily rate = monthly rent / 30 (verified for all students)

**Query 4.5 - Coverage period accuracy:**
- accuracy_percentage MUST be 100%
- Coverage end = payment date + coverage days - 1 (verified for all payments)

### Step 5: Data Quality Checks

Run **Section 5** queries to identify issues:

```sql
-- Copy and run queries 5.1 through 5.5
```

**Expected Results:**

**Query 5.1 - Students missing coverage:**
- Empty result set preferred
- Any results indicate students with payments but no coverage data (needs investigation)

**Query 5.2 - Payments missing coverage:**
- Empty result set preferred
- Results acceptable only for payments where student has no room assignment

**Query 5.3 - Invalid coverage days:**
- MUST be empty (no negative or zero coverage days)
- ✗ If results found: Calculation error in population function

**Query 5.4 - Overdue students:**
- Results expected (some overdue students normal in production)
- Numbers should align with business reality

**Query 5.5 - Unusually long coverage:**
- Few or no results expected
- Large overpayments (>2 months) should be rare but possible

### Step 6: Summary Report

Run **Section 6** to get overall migration health check:

```sql
-- Copy and run the final summary query
```

**Success Criteria:**

The summary report should show:

```
═══════════════════════════════════════════════
         MIGRATION VERIFICATION SUMMARY
═══════════════════════════════════════════════

Schema Changes        | ✓ PASS: All columns added correctly
Data Preservation     | ✓ [count] payments preserved | ✓ [count] active students preserved
Field Population      | >95% payments | >95% students
Calculation Accuracy  | ✓ PASS: 100% accurate
Data Quality Issues   | 0 invalid coverage days | 0 students missing coverage
Overall Status        | ✓✓✓ MIGRATION SUCCESSFUL ✓✓✓
```

**Failure Indicators:**

- **Schema Changes = FAIL**: Not all columns were added
- **Field Population < 90%**: Most records not populated (check population function)
- **Calculation Accuracy < 100%**: Coverage calculation formulas incorrect
- **Data Quality Issues > 0**: Invalid data created during migration
- **Overall Status = FAILED**: Critical issues exist, do not proceed

## Troubleshooting

### Hash Mismatch (Queries 3.1, 3.2)

**Problem**: Data hash changed after migration

**Cause**: Migration modified existing payment or student data

**Fix**: 
1. Rollback migration
2. Review population function - ensure it only updates NEW fields
3. Use UPDATE statements that don't touch existing columns
4. Re-run migration

### Low Population Percentage (Queries 4.1, 4.2)

**Problem**: < 90% of records populated

**Cause**: Population function failing for some records

**Fix**:
1. Run Section 5 queries to identify problem records
2. Check for NULL room_id or rent_per_bed values
3. Check for invalid payment amounts (zero, negative)
4. Add error handling to population function
5. Re-run population for failed records

### Calculation Accuracy < 100% (Queries 4.4, 4.5)

**Problem**: Coverage calculations don't match expected formulas

**Cause**: Incorrect calculation logic in population function

**Fix**:
1. Review query 4.3 to see which calculation is wrong
2. Check daily rate formula: `rent_per_bed / 30`
3. Check coverage days formula: `ROUND(amount / daily_rate)`
4. Check coverage end formula: `payment_date + coverage_days - 1`
5. Correct population function
6. Clear incorrect data: `UPDATE students SET daily_rate = NULL, ...`
7. Re-run population function

### Invalid Coverage Days (Query 5.3)

**Problem**: Negative or zero coverage days found

**Cause**: 
- Zero or NULL daily_rate
- Negative payment amounts
- Division by zero

**Fix**:
1. Identify problematic payments from query 5.3 results
2. Check source data: `SELECT * FROM payments WHERE id IN ([ids])`
3. Add validation to population function:
   ```sql
   IF v_daily_rate IS NULL OR v_daily_rate <= 0 THEN
     RAISE NOTICE 'Invalid daily rate for student %', v_student_id;
     CONTINUE;
   END IF;
   ```
4. Fix source data if needed
5. Re-run population

## Documentation Template

After running all verification queries, document your results:

```markdown
## Migration Verification Results - [Date]

### Pre-Migration Baseline
- Total Payments: [count]
- Total Active Students: [count]
- Payment Hash: [hash]
- Student Hash: [hash]

### Post-Migration Verification

#### Schema Changes
- Students new columns: ✓ 4 columns added
- Payments new columns: ✓ 3 columns added
- Existing columns: ✓ All preserved

#### Data Preservation (Requirements 8.3, 8.4)
- Payment hash match: ✓ PASS
- Student hash match: ✓ PASS
- Payment count: ✓ PASS (no deletions)
- Student count: ✓ PASS (no deletions)

#### Field Population
- Payments: [X]% populated
- Students: [X]% populated

#### Calculation Accuracy (Requirement 8.5)
- Sample students: ✓ 5/5 match
- Daily rate accuracy: [X]%
- Coverage period accuracy: [X]%

#### Data Quality
- Students missing coverage: [X] records
- Payments missing coverage: [X] records
- Invalid coverage days: [X] records
- Overdue students: [X] records

#### Overall Status
[✓✓✓ MIGRATION SUCCESSFUL / ⚠ PARTIAL / ✗ FAILED]

### Issues Found
[List any issues and how they were resolved]

### Approval
Migration verified by: [Name]
Date: [Date]
Ready for Phase 2: [Yes/No]
```

## Next Steps

After successful verification:

1. Save verification results in documentation
2. Get user approval (Phase 1 checkpoint task 2.3)
3. Proceed to Phase 2: Coverage Calculation Engine

If verification fails:

1. Document all failures
2. Fix issues as per Troubleshooting section
3. Re-run verification queries
4. Do NOT proceed to Phase 2 until all checks pass
