<div align="center">
  <img src="./public/trevis_github_banner.svg" alt="Trevis Property Manager Banner" width="100%" />

  <h1>Trevis Property Manager</h1>
  <p><strong>A production property-management system for student accommodation, built around a single, ledger-derived coverage engine.</strong></p>

  <p>
    <a href="#overview">Overview</a> •
    <a href="#the-coverage-engine">Coverage Engine</a> •
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#automation--monitoring">Automation</a> •
    <a href="#installation">Installation</a> •
    <a href="#built-with">Built With</a>
  </p>
</div>

---

## 🏢 Overview

Trevis manages multi-property student accommodation: occupancy, rent collection,
arrears, transfers, and reporting. It runs in production on real data (a live
portfolio of ~130 students across several properties), backed by Supabase
(Postgres + Auth + RLS) and deployed on Netlify.

> **Not a demo.** Earlier versions ran in-memory on seed data. Trevis is now a
> live system: payments persist, coverage is computed from the immutable payment
> ledger, and the data is monitored daily for integrity.

## 💡 The Coverage Engine

The heart of Trevis is its **rent-coverage model**. Instead of a calendar-month
"paid / unpaid" flag, each payment buys a number of days of coverage that **stack**
from a tenant's current coverage end — so prepaid days are never lost and partial
or early payments are handled correctly.

Design principles (hard-won — see the audit docs in `trevis-production/`):

- **One writer, one source of truth.** `rebuildStudentCoverage()` (JS) is the
  *only* code that writes coverage fields. All legacy SQL coverage writers are
  retired (raise on use). Coverage columns (`coverage_start/end`, `daily_rate`,
  `next_due_date`) are **derived cache** of `payments + room rent` — never
  hand-authored.
- **Replay from the ledger.** Coverage is recomputed by replaying a student's
  full payment history through one pure engine (`paymentProcessor` /
  `rentCycleCalculator`), so it can always be rebuilt from truth.
- **Auto-reconciliation.** Every coverage-affecting mutation (payment
  create/edit/delete, room rent change, transfer, room/status change, vacate)
  triggers a rebuild automatically — drift can't accumulate silently.
- **Timezone-safe dates.** Coverage dates are calendar days, serialized by local
  components (not UTC), so the same ledger yields the same dates everywhere.
- **Invariants + monitoring.** A DB `CHECK (coverage_start <= coverage_end)` plus
  a nightly integrity audit guard against regressions.

## ✨ Features

### 📊 Dashboard & Portfolio Overview
- KPI strip (active students, collected, outstanding, collection rate).
- Per-property collected-vs-expected charts and an Attention Required list
  (overdue / due-today / expiring-soon), all from the coverage engine.
- **Coverage integrity indicator** — shows the data is in sync with the ledger.

### 👥 Tenancy & Occupancy
- Add-student wizard with vacant-bed detection; real-time occupancy.
- Student transfers between rooms (coverage re-rated automatically).
- Vacate / check-out (history preserved).

### 💳 Payments & Coverage
- Record payments (Cash / Transfer / Swipe) with receipts and history.
- **Coverage breakdown** per student: a chain-aware timeline showing the current
  coverage chain vs. previous (expired) chains, so "why N days remaining" is
  self-evident.
- **Coverage runway bars** on student rows (paid-through / expiring / overdue).

### 📈 Reporting & Finances
- Income, outstanding balances, and occupancy views driven by coverage status.
- 1-click CSV export.

### 🛡️ Auth & Security
- Supabase Auth with role-based access (Admin / Manager).
- Row-Level Security protects all table data.
- Per-student data access governed by RLS policies (not client logic).

### 📱 Responsive UI
- Hand-crafted dark-slate design, `IBM Plex Mono` numerals, mobile-friendly nav.

## 🛠️ Architecture

Trevis is a React + Vite single-page app talking directly to Supabase (no custom
backend). The live project lives in the **`trevis-production/`** subfolder
(Netlify builds from there; the repo root retains the original demo).

```
payments (immutable ledger) + rooms.rent_per_bed
                │
                ▼  rebuildStudentCoverage()  ── the ONLY writer
   students.{coverage_start, coverage_end, daily_rate, next_due_date}  (derived cache)
                │
                ▼  classifyStudent()  (pure)
        CURRENT / EXPIRING_SOON / DUE_TODAY / OVERDUE
                │
                ▼
   Dashboard · Property views · Finances · Reports · Daily owner report
```

Key modules (`trevis-production/src/`):
- `services/rentCycleCalculator.js` · `paymentProcessor.js` — pure coverage math.
- `services/coverageDatabaseService.js` — the single coverage writer + reads.
- `services/statusClassifier.js` · `statusVocabulary.js` — coverage status + the
  canonical status vocabulary.
- `services/coverageBreakdown.js` — chain-aware per-payment explanation.
- `hooks/useCoverageStore.js` — one app-level coverage fetch shared by all views.
- `scripts/replay_portfolio_coverage.mjs` — operator/audit tool (dry-run + apply
  + nightly `--report` integrity monitor).
- `scripts/daily_owner_report.mjs` — the daily owner-intelligence report.

Test suite: ~190 unit tests (Vitest), run locally and in CI under both local and
UTC timezones.

## 🤖 Automation & Monitoring

Scheduled via **GitHub Actions** (free; no Netlify deploys):

- **Coverage Integrity Monitor** — nightly read-only audit that replays every
  active student and alarms if stored coverage drifts from the ledger
  (`STATUS: HEALTHY ✅`).
- **Daily Owner Report** — emails the owner each morning (07:00 CAT) a portfolio
  health summary (active, occupancy, outstanding, $/day accruing, overdue and
  expiring lists) via Resend, plus a one-tap WhatsApp click-to-send summary.

## 🚀 Installation

Requires [Node.js](https://nodejs.org/) 20+.

```bash
git clone https://github.com/98Devops/trevis-app.git
cd trevis-app/trevis-production      # the live project lives here
npm install
```

Create `trevis-production/.env`:
```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Run:
```bash
npm run dev      # dev server
npm test         # vitest
npm run build    # production build
```

> Operator/audit scripts use a Supabase **service_role** key set in the shell
> (never committed). See `trevis-production/scripts/` and the `supabase/` SQL.

## 💻 Built With

- **[React](https://reactjs.org/)** + **[Vite](https://vitejs.dev/)** — SPA + tooling
- **[Supabase](https://supabase.com/)** — Postgres, Auth, Row-Level Security
- **[Vitest](https://vitest.dev/)** — unit testing (~190 tests)
- **[Resend](https://resend.com/)** — transactional email (daily report)
- **GitHub Actions** — scheduled monitoring + reporting
- **Netlify** — hosting / CI deploy
- Vanilla CSS — responsive dark-slate design

---

<div align="center">
  <sub>Built by Tafara Rugara · coverage engine stabilized & hardened for production.</sub>
</div>
