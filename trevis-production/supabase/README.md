# PropNest — Database Setup

PropNest runs on Supabase (Postgres + Auth + RLS). To stand up a fresh project,
run these files in the Supabase SQL editor **in order**:

| # | File | What it does |
|---|------|--------------|
| 1 | `schema.sql` | Tables, RLS policies, helper functions, triggers |
| 2 | `seed.sql` | Demo properties + units + occupants (Maple Court, Oakwood) |
| 3 | `seed_part2.sql` | More demo occupants (Birchgate, Cedar House) |
| 4 | `seed_payments.sql` | Demo payment ledger (drives the coverage engine) |
| 5 | `R3_coverage_invariants.sql` | `CHECK (coverage_start <= coverage_end)` backstop |
| 6 | `R6_performance_indexes.sql` | Hot-path indexes (payments by occupant+date, etc.) |
| 7 | `R7_parity_objects.sql` | settings/report_logs/monthly_snapshots tables, rooms.is_active, balance-recalc functions (objects the app calls) |
| 8 | `R8_payment_methods.sql` | Widen the payment_method CHECK to a superset (additive) so the UI's generic methods work without rejecting existing data |

The demo data uses **generated English names** — no real tenant data ships in
this repo. All occupant rows share the same UUIDs across the seed files, so
`seed_payments.sql` attaches correctly and the coverage engine produces a
realistic spread of current / expiring / overdue occupants.

`_archive/` holds the historical migration + audit SQL from the upstream system,
kept for reference only — it is **not** part of fresh setup.

## Coverage engine principle
Coverage columns (`coverage_start/end`, `daily_rate`, `next_due_date`) are a
**derived cache** of `payments + unit rate`. They are written only by the JS
engine (`rebuildStudentCoverage`), never hand-authored. Replaying the payment
ledger always reconstructs them.
