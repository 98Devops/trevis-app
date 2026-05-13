# Trevis — Student Accommodation Property Manager

A production-grade property management system for 4 student accommodation properties in Harare, Zimbabwe. Built with React + Vite on the frontend, Supabase (PostgreSQL) on the backend.

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Supabase account (free tier at [supabase.com](https://supabase.com))

### 1. Clone & Install

```bash
cd trevis-production
npm install
```

### 2. Configure Supabase

Copy the env example file:
```bash
copy .env.example .env
```

Then edit `.env` with your Supabase project credentials:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> ⚠️ Without these values the app runs in **Demo Mode** with limited sample data. Add them to unlock real data persistence and auth.

### 3. Run the Database Schema

In your Supabase project → **SQL Editor**:

1. Paste and run `supabase/schema.sql` — creates all 6 tables, triggers, RLS policies, and views
2. Paste and run `supabase/seed.sql` — populates King Fisher and The Chase data
3. Paste and run `supabase/seed_part2.sql` — populates Madden and NEW HOUSE data

### 4. Create Admin User

In Supabase → **Authentication → Users → Invite User**, create your admin account.

Then in **SQL Editor**, set their role:
```sql
UPDATE profiles
SET role = 'ADMIN', full_name = 'Admin Name'
WHERE email = 'your-admin@email.com';
```

To create a Manager scoped to one property:
```sql
UPDATE profiles
SET role = 'MANAGER',
    full_name = 'Manager Name',
    property_id = (SELECT id FROM properties WHERE name = 'King Fisher')
WHERE email = 'manager@email.com';
```

### 5. Run Locally

```bash
npm run dev
```

App runs at `http://localhost:5173`

---

## Project Structure

```
trevis-production/
├── src/
│   ├── App.jsx                    # Root component + app shell
│   ├── main.jsx                   # React entry point
│   ├── lib/
│   │   └── supabase.js            # Supabase client (reads .env)
│   ├── services/
│   │   ├── authService.js         # signIn, signOut, getCurrentUser
│   │   ├── propertyService.js     # getProperties, addRoom, updateRoom
│   │   ├── studentService.js      # CRUD + soft delete + data flags
│   │   ├── paymentService.js      # recordPayment, getPaymentsByStudent
│   │   └── reportService.js       # monthly, outstanding, occupancy reports
│   └── parts/
│       ├── p1_imports_context.jsx # AuthContext + DataContext
│       ├── p2_helpers.jsx         # Design tokens, components (Badge, Btn, etc.)
│       ├── p3_modals.jsx          # Login, AddStudent, AddRoom, PaymentModal, StudentProfile
│       ├── p4_dashboard.jsx       # Dashboard KPI strip + charts
│       ├── p5_views.jsx           # PropertyDetail, RoomRow, Students list
│       └── p6_reports.jsx         # Reports tabs + Data Quality flags
├── supabase/
│   ├── schema.sql                 # Full DB schema with triggers + RLS
│   ├── seed.sql                   # King Fisher + The Chase data (May 2026)
│   └── seed_part2.sql             # Madden + NEW HOUSE data (May 2026)
├── .env.example                   # Environment variable template
└── build_app.cjs                  # (Reference) modular build script
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `properties` | 4 properties with accent colors |
| `rooms` | Rooms per property with bed capacity & rent |
| `students` | Tenants — soft delete via `check_out_date` + status |
| `payments` | Every payment with method, receipt, `recorded_by` |
| `monthly_obligations` | Materialised ledger — 1 row per student per month |
| `profiles` | User roles (ADMIN/MANAGER) + property assignment |

---

## User Roles

| Role | Access |
|---|---|
| **ADMIN** | All 4 properties. Can add/remove students, add rooms, view Data Quality flags, export reports |
| **MANAGER** | Assigned property only — enforced at DB level via RLS. Can record payments only |

> RLS is enforced at PostgreSQL level — a Manager **cannot** query data from other properties even with direct API calls.

---

## Properties & Accent Colors

| Property | Color | Hex |
|---|---|---|
| King Fisher | Cyan | `#22D3EE` |
| The Chase | Purple | `#A78BFA` |
| Madden | Amber | `#F59E0B` |
| NEW HOUSE | Rose | `#FB7185` |

---

## Features

### 📊 Dashboard
- KPI strip: Total Students, Collected, Outstanding, Collection Rate
- Bar chart: Collected vs Expected by property
- Property cards with collection rate progress bars
- Sortable "Attention Required" table (overdue/partial tenants)
- Mobile responsive with hamburger sidebar

### 🔐 Authentication
- Real Supabase Auth (JWT + refresh tokens)
- Demo mode fallback when Supabase not configured
- Role-based UI — Managers see only their property

### 🏠 Properties & Rooms
- Collapsible room rows with occupancy indicators
- **Add Room** (Admin only) — modal with bed capacity and rent
- Vacant bed count shown inline per room
- Room dropdown shows "X beds free" or "FULL" when at capacity

### 👥 Students
- 4-step Add Student wizard with vacant bed detection
- **Remove Student** (soft delete) — preserves payment history
- Toggle to show/hide vacated students
- Global search + filter by status (All/Paid/Partial/Overdue)

### 💳 Payments
- Record payment with date picker (defaults to today)
- Methods: Cash, EcoCash, Bank Transfer, Zipit, Swipe
- Receipt number field
- Postgres trigger auto-updates monthly obligation on every payment

### 📋 Reports
- **Income Summary** — by property with collection rates
- **Outstanding Balances** — sorted by amount owed
- **Occupancy** — beds, occupied, vacant per property
- **Data Quality** (Admin only) — flags from seed import requiring resolution
- CSV export covering all 3 report types

### 🔍 Data Quality Flags
| Flag | Description |
|---|---|
| `OVER_CAPACITY` | More students than beds |
| `ANONYMOUS_PLACEHOLDER` | Blank name row with payment |
| `INVALID_DATE` | Unparseable date in source |
| `FUTURE_DATE` | Check-in date in the future |
| `MISSING_PAYMENT` | Student has date but no amount |
| `MISSING_DATE` | Paid but no date recorded |
| `UNCLEAR_NOTE` | Ambiguous note needing client clarification |

---

## Deploy to Netlify

1. Push `trevis-production/` to a GitHub repo
2. In Netlify → **New site from Git** → select the repo
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in Netlify → **Site Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## Running Costs

| Service | Plan | Cost |
|---|---|---|
| Supabase | Free tier (500MB, 50k users) | $0/mo |
| Netlify | Free tier | $0/mo |
| Domain | e.g. trevis.co.zw | ~$1–2/mo |
| **Total** | | **~$1–2/mo** |

Supabase Pro ($25/mo) only needed if student count exceeds ~500 or scheduled email is required.

---

## Demo Mode Credentials

When Supabase is not connected:

| Role | Email | Password |
|---|---|---|
| Admin | admin@trevis.co.zw | admin1234 |
| Manager | manager@trevis.co.zw | manager1234 |
