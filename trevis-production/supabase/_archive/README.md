# supabase/_archive — QUARANTINED COVERAGE WRITERS

**Do not run any file in this folder against the database.**

These SQL scripts were retired on 2026-06-16 by the coverage writer audit
(`COVERAGE_WRITER_INVENTORY.md`, `SQL_RETIREMENT_MATRIX.md`). Each one contains a
*latent coverage writer* that computes `students.coverage_*` with the WRONG math
(`FLOOR(amount/daily_rate)` or most-recent-payment-only) and would silently corrupt
correct, JS-computed coverage if executed.

| File | Latent writer | Bug |
|---|---|---|
| `FIX_COVERAGE_DAYS_ROUNDING.sql` | `populate_rent_cycle_fields()` | most-recent-payment-only (drops history) |
| `RUN_THIS_COMPLETE.sql` | `populate_rent_cycle_fields()` + **auto-runs it** | same; filename invites a full re-run |
| `sprint5.5_flexible_rent_cycles.sql` | `calculate_coverage()` + STEP 6/7 backfill | FLOOR; **STEP 6/7 DO blocks auto-execute on paste** |
| `sprint5.5_flexible_rent_cycles_CORRECTED.sql` | `calculate_coverage()` + STEP 6/7 backfill | FLOOR; auto-executing backfill |

## The one and only coverage writer

`students` coverage columns are written **exclusively** by the JS engine
`rebuildStudentCoverage()` (`src/services/coverageDatabaseService.js`), reached via
`recordPaymentWithCoverage` / `updatePayment` / `deletePayment`, and re-run in bulk by
the operator tool `scripts/replay_portfolio_coverage.mjs`. There are **no** SQL writers
and **no** triggers that write coverage.

## If you truly need to re-derive coverage in bulk

Run the JS portfolio replay (dry-run first):

```
node scripts/replay_portfolio_coverage.mjs --dry-run
node scripts/replay_portfolio_coverage.mjs --apply
```

The live DB definitions of `rebuild_student_coverage_from_payments`,
`calculate_coverage`, and `populate_rent_cycle_fields` are RAISE-EXCEPTION stubs
installed by `supabase/R1_retire_sql_coverage_rebuild.sql`. If you re-run any file in
this folder, you will re-install a broken writer over those stubs. Don't.
