<div align="center">
  <h1>PropNest</h1>
  <p><strong>Property management for student housing, lodges, short-stays and rentals — built around a single, ledger-derived coverage engine.</strong></p>
</div>

---

## Overview

PropNest is a property-management SaaS for multi-unit accommodation: occupancy,
rent collection, arrears, transfers, and reporting. One operator picks a
**vertical** (students, lodges, Airbnb-style short stays, or long-term rentals),
adds their properties, units, and rates, and the system tracks who is paid-up,
who is expiring, and who is overdue — from the payment ledger, not a calendar
flag.

It is a React + Vite single-page app talking directly to Supabase
(Postgres + Auth + Row-Level Security), deployed on Netlify.

> **Lineage.** PropNest is the productized evolution of a live single-owner
> student-accommodation system. The coverage engine is battle-tested in
> production (~130 occupants, daily integrity monitoring) and is intentionally
> **vertical-neutral**: the math is "amount ÷ daily rate = days of coverage",
> which holds whether the payer is a student, a lodge guest, or a renter.

## The coverage engine

Instead of a monthly "paid / unpaid" flag, each payment buys a number of days of
coverage that **stack** from the occupant's current coverage end — so prepaid
days are never lost and partial or early payments are handled correctly.

Design principles:

- **One writer, one source of truth.** `rebuildStudentCoverage()` is the *only*
  code that writes coverage fields. Coverage columns (`coverage_start/end`,
  `daily_rate`, `next_due_date`) are a **derived cache** of `payments + unit
  rate` — never hand-authored.
- **Replay from the ledger.** Coverage is recomputed by replaying the full
  payment history through one pure engine, so it can always be rebuilt from truth.
- **Auto-reconciliation.** Every coverage-affecting mutation triggers a rebuild,
  so drift can't accumulate silently.
- **Timezone-safe dates.** Coverage dates are calendar days serialized by local
  components (not UTC) — the same ledger yields the same dates everywhere.
- **Invariants + monitoring.** A DB `CHECK (coverage_start <= coverage_end)` plus
  a nightly integrity audit guard against regressions.

## Tech stack

- **React + Vite** — SPA + tooling
- **TypeScript** (incremental) — the engine domain is being typed module-by-module
- **Supabase** — Postgres, Auth, Row-Level Security
- **Vitest** — ~190 unit tests, run under both local and UTC timezones
- **Netlify** — hosting / CI deploy

## Getting started

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
cp .env.example .env     # fill in your Supabase URL + anon key
npm run dev              # dev server
npm test                # vitest
npm run typecheck       # tsc --noEmit (TS coexists with JS)
npm run build           # production build
```

Database setup: see [`supabase/README.md`](supabase/README.md) — run the SQL
files in order against a fresh Supabase project. Demo data uses generated
English names; no real tenant data ships in this repo.

## Roadmap

- **Phase 0 — Foundation** ✅ renamed, TypeScript-enabled, demo seed data.
- **Phase 1 — Typed domain** — convert the engine services to `.ts` behind their
  existing tests (`Payment`, `CoverageWindow`, `CoverageStatus`, `Occupant`).
- **Phase 2 — Verticals** — onboarding picks a vertical (students / lodges /
  short-stay / rentals); per-account data via Supabase RLS membership.
- **Phase 3 — UI redesign** — break the monolithic view files into a component
  library and restyle.
