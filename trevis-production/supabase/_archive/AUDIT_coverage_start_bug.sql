-- ═══════════════════════════════════════════════════════════
-- AUDIT — coverage_start bug scope (read-only)
-- Run BEFORE the R2 re-run to size the corruption, and AFTER to confirm it's gone.
-- Bug: rebuildStudentCoverage()/R2 stored the LAST payment's slice start as
-- coverage_start, collapsing long-term tenants to start == end. Fixed in code
-- (commit: gap-aware chain start); these queries prove the data is repaired.
-- ═══════════════════════════════════════════════════════════

-- (1) Headline count — how many ACTIVE students are corrupted?
--     BEFORE repair: expect a meaningful number. AFTER: expect 0.
SELECT COUNT(*) AS affected_students
FROM students
WHERE status = 'ACTIVE'
  AND coverage_start IS NOT NULL
  AND coverage_end IS NOT NULL
  AND coverage_start >= coverage_end;

-- (2) The actual offenders (names + dates) for spot-checking.
SELECT full_name, coverage_start, coverage_end, daily_rate, next_due_date
FROM students
WHERE status = 'ACTIVE'
  AND coverage_start IS NOT NULL
  AND coverage_end IS NOT NULL
  AND coverage_start >= coverage_end
ORDER BY full_name;

-- (3) Onenhlanha specifically — the canary.
--     AFTER repair expect: coverage_start = 2025-07-30, coverage_end = 2026-07-24
--     (chain start | correct end), i.e. start strictly < end.
SELECT full_name, coverage_start, coverage_end
FROM students
WHERE full_name = 'Onenhlanha Nyathi';

-- (4) Live vs backup sanity for the canary (start should differ from the buggy
--     live value and align to the healthy backup chain start).
SELECT s.full_name,
       s.coverage_start AS live_start,  s.coverage_end AS live_end,
       b.coverage_start AS backup_start, b.coverage_end AS backup_end
FROM students s
JOIN students_coverage_backup_20260616 b ON b.id = s.id
WHERE s.full_name = 'Onenhlanha Nyathi';
