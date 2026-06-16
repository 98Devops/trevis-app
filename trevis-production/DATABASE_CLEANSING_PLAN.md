# DATABASE CLEANSING PLAN — STAGE 8.2 (Historical Data Integrity Audit)

**Date:** 2026-06-16
**Objective:** Identify legacy records created before the Sprint 5.5 coverage architecture
and define a safe, reversible cleansing strategy.
**Constraint:** ❌ No data modified. Diagnostics + strategy only. All `UPDATE`/`DELETE`
statements below are **proposals**, gated behind a dry-run and a backup.

> Context: production carries **historical payments predating the May-2026 tracking start**
> (e.g. Rutendo Hlabati has a Jan-2025 payment). Coverage columns are stored, written by
> `rebuildStudentCoverage` (JS, authoritative) and historically by the SQL
> `populate_rent_cycle_fields` (most-recent-payment only) and
> `rebuild_student_coverage_from_payments` (`FLOOR` math). See `DATA_TRUTH_AUDIT.md`.

---

## 0. Pre-flight (run first, mandatory)

```sql
-- Full logical backup before ANY repair (Supabase: use dashboard backup or pg_dump).
-- Snapshot the two tables we will touch, so every repair is reversible:
CREATE TABLE students_backup_20260616  AS TABLE students;
CREATE TABLE payments_backup_20260616  AS TABLE payments;
-- Verify row counts match the live tables before proceeding.
SELECT (SELECT count(*) FROM students)  AS students_live,
       (SELECT count(*) FROM students_backup_20260616) AS students_bak,
       (SELECT count(*) FROM payments)  AS payments_live,
       (SELECT count(*) FROM payments_backup_20260616) AS payments_bak;
```

---

## 1. Duplicate payments

**Definition:** two+ payment rows with identical `(student_id, amount, payment_date)`
(TD-6 only guards a 10s window at write time; pre-TD-6 dups may exist historically).

```sql
-- DIAGNOSTIC
SELECT student_id, amount, payment_date, count(*) AS dup_count,
       array_agg(id ORDER BY created_at) AS payment_ids
FROM payments
GROUP BY student_id, amount, payment_date
HAVING count(*) > 1
ORDER BY dup_count DESC, student_id;
```

**Repair strategy:** keep the earliest `created_at` row, delete the rest, then rebuild that
student. **Do NOT bulk-delete blindly** — a student can legitimately pay the same amount on
the same day twice in rare cases; review the diagnostic list with the operator first.

```sql
-- PROPOSED REPAIR (per reviewed student only; wrap in transaction):
-- DELETE FROM payments p USING (
--   SELECT id, row_number() OVER (PARTITION BY student_id, amount, payment_date
--                                 ORDER BY created_at) AS rn
--   FROM payments WHERE student_id = :sid
-- ) d WHERE p.id = d.id AND d.rn > 1;
-- SELECT * FROM rebuild_student_coverage_from_payments(:sid);  -- (or JS rebuild — see §note)
```

**Impact:** likely **low count**; each removed dup shortens coverage for that student by the
duplicated days (which is the correct outcome). Money-affecting → operator review required.

---

## 2. Missing coverage rebuilds (stored columns stale vs. ledger)

**Definition:** an ACTIVE student with payments but whose stored `coverage_end` does not
match a full JS replay of their ledger (the core Stage 8.1 finding).

```sql
-- DIAGNOSTIC: ACTIVE students with payments but NULL coverage (never rebuilt)
SELECT s.id, s.full_name, count(p.id) AS payments, s.coverage_end
FROM students s
JOIN payments p ON p.student_id = s.id
WHERE s.status = 'ACTIVE'
GROUP BY s.id, s.full_name, s.coverage_end
HAVING s.coverage_end IS NULL          -- has payments but no coverage = missing rebuild
ORDER BY payments DESC;

-- DIAGNOSTIC: stored coverage_end older than last payment's coverage (likely stale)
SELECT s.id, s.full_name, s.coverage_end,
       max(p.coverage_end_date) AS max_payment_cov_end,
       max(p.payment_date)      AS last_payment
FROM students s JOIN payments p ON p.student_id = s.id
WHERE s.status = 'ACTIVE'
GROUP BY s.id, s.full_name, s.coverage_end
HAVING s.coverage_end IS DISTINCT FROM max(p.coverage_end_date)
ORDER BY last_payment DESC;
```

**Repair strategy:** re-replay via the **authoritative JS** `rebuildStudentCoverage`
(preferred — see §note on FLOOR), one student at a time, idempotent.

**Impact:** potentially **portfolio-wide** for historical-data students; corrects
under/over-stated coverage. Non-destructive (recomputes from immutable payment ledger).

---

## 3. Invalid `coverage_start`

```sql
-- DIAGNOSTIC
SELECT id, full_name, coverage_start, coverage_end, created_at
FROM students
WHERE status = 'ACTIVE'
  AND (
    (coverage_start IS NULL AND coverage_end IS NOT NULL)        -- end without start
    OR coverage_start > coverage_end                            -- start after end
    OR coverage_start > CURRENT_DATE + INTERVAL '1 year'        -- implausible future
    OR coverage_start < DATE '2020-01-01'                       -- implausible past
  );
-- Cross-check against ledger: coverage_start should equal the FIRST payment's start
SELECT s.id, s.full_name, s.coverage_start,
       min(p.payment_date) AS first_payment
FROM students s JOIN payments p ON p.student_id = s.id
WHERE s.status='ACTIVE'
GROUP BY s.id, s.full_name, s.coverage_start
HAVING s.coverage_start IS DISTINCT FROM min(p.payment_date);
```

**Repair:** full JS rebuild resets `coverage_start` to the first payment's start. **Impact:**
low-medium. Non-destructive.

---

## 4. Invalid `coverage_end`

```sql
-- DIAGNOSTIC
SELECT id, full_name, coverage_start, coverage_end, daily_rate
FROM students
WHERE status = 'ACTIVE'
  AND coverage_end IS NOT NULL
  AND (
    coverage_end < coverage_start
    OR coverage_end < DATE '2020-01-01'
    OR coverage_end > CURRENT_DATE + INTERVAL '2 years'   -- implausibly far prepaid
  );
-- FLOOR-vs-ROUND off-by-one detector (Stage 8.1 Finding 1):
-- compare stored coverage_end to a ROUND-based single-payment estimate for $110/$260 rooms
SELECT s.id, s.full_name, r.rent_per_bed, s.coverage_end
FROM students s JOIN rooms r ON r.id = s.room_id
WHERE s.status='ACTIVE'
  AND (r.rent_per_bed/30.0) <> round((r.rent_per_bed/30.0),2)::numeric  -- non-even daily rate
  AND r.rent_per_bed IN (110, 260);   -- known FLOOR-affected rents; widen as needed
```

**Repair:** full JS rebuild. **Impact:** medium — the $110/$260 cohort is the FLOOR-affected
population from Stage 8.1. Non-destructive.

---

## 5. Missing `daily_rate`

```sql
-- DIAGNOSTIC
SELECT s.id, s.full_name, s.daily_rate, r.rent_per_bed,
       round(r.rent_per_bed/30.0, 2) AS expected_daily_rate
FROM students s LEFT JOIN rooms r ON r.id = s.room_id
WHERE s.status = 'ACTIVE'
  AND (s.daily_rate IS NULL
       OR s.daily_rate <> round(r.rent_per_bed/30.0, 2));
```

**Repair:** rebuild recomputes `daily_rate = round(rent/30, 2)`. Rows where `rooms` is NULL
are a room-assignment problem, not a rate problem (see §7). **Impact:** low. Non-destructive.

---

## 6. Null balances

> Note: there is no `balance` column on `students`/`payments`. "Balance" in the UI is
> derived (`coverageOutstanding = daysOverdue × daily_rate`). The only stored `balance` is
> on `monthly_obligations` (legacy cash-basis system), which is **not** the coverage truth.

```sql
-- DIAGNOSTIC: legacy monthly_obligations with NULL/!= computed balance
SELECT id, student_id, month, amount_due, amount_paid, balance
FROM monthly_obligations
WHERE balance IS NULL
   OR balance <> (coalesce(amount_due,0) - coalesce(amount_paid,0));
-- DIAGNOSTIC: would a coverage "balance" ever be NaN? Only if daily_rate is NULL while overdue:
SELECT id, full_name, daily_rate, coverage_end
FROM students
WHERE status='ACTIVE' AND coverage_end < CURRENT_DATE AND daily_rate IS NULL;
```

**Repair:** `monthly_obligations` is legacy/cash-basis (see TD-10); recompute via the
existing `recalculate_student_balances()` function **only if that table is still surfaced**.
The coverage path guards NaN already (`Number(x) || 0`). **Impact:** low; cosmetic on the
legacy table. Non-destructive.

---

## 7. Orphaned students

**Definition:** student rows with no valid room, or non-VACATED students dangling.

```sql
-- DIAGNOSTIC: students whose room_id is NULL or points to a missing/inactive room
SELECT s.id, s.full_name, s.status, s.room_id, r.id AS room_exists, r.is_active
FROM students s
LEFT JOIN rooms r ON r.id = s.room_id
WHERE s.status <> 'VACATED'
  AND (s.room_id IS NULL OR r.id IS NULL OR r.is_active = false);
```

**Repair strategy:** **do not delete.** Either (a) assign a valid room, or (b) set status to
`VACATED`/`CHECKED_OUT` after operator confirmation. A NULL room means `rebuildStudentCoverage`
throws "Room rent not found" (TD-5 surfaces this) — so these students cannot be rebuilt until
fixed. **Impact:** these are the rows that *break* rebuilds; small count but high leverage.

---

## 8. Orphaned payments

**Definition:** payment rows whose `student_id` is NULL or references a missing student.

```sql
-- DIAGNOSTIC
SELECT p.id, p.student_id, p.amount, p.payment_date, p.month_year
FROM payments p
LEFT JOIN students s ON s.id = p.student_id
WHERE p.student_id IS NULL OR s.id IS NULL;
-- Also: payments missing the NOT NULL-required month_year (should be impossible, but verify)
SELECT id, student_id, amount, payment_date FROM payments WHERE month_year IS NULL;
-- Payments with non-positive amounts (would break processPayment validation)
SELECT id, student_id, amount, payment_date FROM payments WHERE amount IS NULL OR amount <= 0;
```

**Repair strategy:** orphaned payments cannot be attributed; **archive, don't hard-delete**
(move to a `payments_orphaned_20260616` table for audit) after operator review. The FK
constraint should prevent missing-student orphans going forward; historical ones predate it.
**Impact:** likely zero or tiny; financial records → preserve, never silently drop.

---

## §Note — which rebuild to use for ALL repairs

⚠️ The SQL `rebuild_student_coverage_from_payments` uses **`FLOOR`** and
`populate_rent_cycle_fields` uses **most-recent-payment-only** — both produce wrong stored
values (Stage 8.1 Findings 1 & 3). **Do not use them for cleansing.** Use the authoritative
**JS `rebuildStudentCoverage`** (`Math.round`, full `payment_date ASC` replay), driven via a
one-off script/admin action, OR first patch the SQL function to `ROUND` and full-replay and
prove parity against the JS engine before relying on it.

---

## Repair execution order (recommended)

1. **Backup** (§0).
2. **§7 orphaned students** — fix room assignments first (unblocks rebuilds).
3. **§8 orphaned/invalid payments** — archive after review (cleans the ledger).
4. **§1 duplicate payments** — operator-reviewed removal.
5. **§2–5 full JS re-replay of every ACTIVE student** — single pass corrects coverage_start,
   coverage_end, daily_rate, next_due_date, and the FLOOR/most-recent-only drift at once.
6. **§6 legacy balances** — only if `monthly_obligations` is still used.
7. **Post-repair parity check** (below).

```sql
-- POST-REPAIR PARITY (re-run §2–§5 diagnostics; expect 0 rows on each)
-- plus a spot KPI reconciliation:
SELECT count(*) FILTER (WHERE coverage_end >= CURRENT_DATE + 8) AS current,
       count(*) FILTER (WHERE coverage_end BETWEEN CURRENT_DATE+1 AND CURRENT_DATE+7) AS expiring,
       count(*) FILTER (WHERE coverage_end = CURRENT_DATE) AS due_today,
       count(*) FILTER (WHERE coverage_end < CURRENT_DATE OR coverage_end IS NULL) AS overdue
FROM students WHERE status='ACTIVE';
-- Compare against getDashboardKPIs() output in the app — they must match.
```

---

## Rollback strategy

Every repair is reversible because coverage columns are **derived** and payments are backed up:

```sql
-- Restore coverage columns from the snapshot (undoes any rebuild):
UPDATE students s SET
  coverage_start = b.coverage_start,
  coverage_end   = b.coverage_end,
  daily_rate     = b.daily_rate,
  next_due_date  = b.next_due_date,
  billing_anchor_date = b.billing_anchor_date
FROM students_backup_20260616 b WHERE b.id = s.id;

-- Restore deleted/archived payments:
INSERT INTO payments SELECT * FROM payments_backup_20260616 b
WHERE b.id NOT IN (SELECT id FROM payments);

-- Full nuclear rollback: restore both tables from backup, or restore the pre-repair
-- Supabase backup taken in §0.
```

Because coverage is fully reconstructable from the (immutable, backed-up) payment ledger,
the **safest rollback is simply re-running the JS rebuild after restoring payments** — no
manual coverage restoration needed.

---

## Estimated impact summary

| Check | Expected volume | Destructive? | Money-affecting? | Priority |
|---|---|---|---|---|
| 1. Duplicate payments | Low (pre-TD-6) | Yes (delete) — review first | Yes | 🟠 P1 |
| 2. Missing/stale rebuilds | **Medium–High** (historical-data + FLOOR cohort) | No (recompute) | Yes | 🔴 P0 |
| 3. Invalid coverage_start | Low | No | Indirect | 🟡 P2 |
| 4. Invalid coverage_end | Medium ($110/$260 cohort) | No | Yes | 🔴 P0 |
| 5. Missing daily_rate | Low | No | Indirect | 🟡 P2 |
| 6. Null balances | Low (legacy table only) | No | No (cash-basis) | 🟢 P3 |
| 7. Orphaned students | Low | No (reassign/vacate) | Blocks rebuilds | 🟠 P1 |
| 8. Orphaned payments | Very low | Archive only | Yes (preserve) | 🟠 P1 |

**Bottom line:** the dominant, highest-value action is **§2/§4 — a single full JS re-replay
of all ACTIVE students** (after fixing §7 orphans), which corrects the FLOOR/most-recent-only
drift portfolio-wide. It is non-destructive and fully reversible. Hard-delete operations
(§1, §8) are small, require operator review, and are archived rather than dropped.
