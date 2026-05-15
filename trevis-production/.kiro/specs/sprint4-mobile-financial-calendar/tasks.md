# Sprint 4 Implementation Tasks

## Phase 1: Database Schema & Quick Wins

- [ ] 1. Database Schema Updates
  - [x] 1.1 Create `supabase/sprint4_schema_updates.sql` with schema changes
  - [x] 1.2 Add `is_active` boolean column to `rooms` table (default true)
  - [x] 1.3 Add `updated_at` and `edited_by` columns to `payments` table
  - [x] 1.4 Create `settings` table with columns: id, key, value, category, created_at, updated_at
  - [x] 1.5 Add indexes for performance: rooms.is_active, payments.updated_at, settings.key
  - [x] 1.6 Update all room queries in propertyService.js to filter WHERE is_active = true

- [ ] 2. Remove Room Feature (Admin Only)
  - [x] 2.1 Add `removeRoom` function to propertyService.js (soft delete with student check)
  - [x] 2.2 Add "Remove Room" button to PropertyDetail expanded room view (Admin only, red styling)
  - [x] 2.3 Implement confirmation modal with student count validation
  - [x] 2.4 Show error if room has active students, success toast on removal
  - [x] 2.5 Refresh property data after successful room removal

- [ ] 3. Room Financial Display Enhancement
  - [x] 3.1 Update collapsed room row to show: "Room X · Y beds · $Z/bed · $TOTAL/mo · N paid ████ %"
  - [x] 3.2 Calculate total monthly rent as beds × rent_per_bed
  - [x] 3.3 Add room-level summary in expanded state: "Room total: $X expected · $Y collected · $Z outstanding"
  - [x] 3.4 Apply consistent formatting across all properties

## Phase 2: Mobile CSS Overhaul

- [ ] 4. Global Mobile Styles Enhancement
  - [x] 4.1 Review and enhance existing mobile CSS in p2_helpers.jsx globalCSS
  - [x] 4.2 Add @media (max-width: 768px) breakpoint styles for all views
  - [ ] 4.3 Add @media (max-width: 480px) breakpoint for very small screens
  - [ ] 4.4 Ensure sidebar slide-in behavior works correctly on mobile

- [ ] 5. Reports Page Mobile Layout
  - [ ] 5.1 Convert Income Summary table to card layout on mobile (hide table headers)
  - [ ] 5.2 Convert Outstanding Balances table to card layout on mobile
  - [ ] 5.3 Convert Occupancy table to card layout on mobile
  - [ ] 5.4 Style cards with property accent color left border
  - [ ] 5.5 Make tab navigation horizontally scrollable on mobile (overflow-x: auto)
  - [ ] 5.6 Stack "Save Snapshot" and "Generate Obligations" buttons vertically on mobile
  - [ ] 5.7 Make "Export CSV" button full width on mobile

- [ ] 6. Students Page Mobile Layout
  - [ ] 6.1 Convert student table to card layout on mobile
  - [ ] 6.2 Each card shows: name, property·room, rent/paid amounts, status badge
  - [ ] 6.3 Hide column headers on mobile (display: none)
  - [ ] 6.4 Add property accent color left border to each card
  - [ ] 6.5 Ensure cards are tappable and open StudentProfile drawer

- [ ] 7. Dashboard Mobile Layout
  - [ ] 7.1 Convert KPI strip from 4 columns to 2×2 grid on mobile
  - [ ] 7.2 Stack property cards single column on mobile
  - [ ] 7.3 Convert "Attention Required" table to card layout on mobile
  - [ ] 7.4 Ensure all buttons and actions are touch-friendly (min 44px height)

- [ ] 8. Property Detail Mobile Layout
  - [ ] 8.1 Ensure room rows collapse cleanly on mobile
  - [ ] 8.2 Convert expanded student list to mini cards (not table rows)
  - [ ] 8.3 Stack action buttons (Add Room, Add Student, Record Payment) in 2-column grid on mobile
  - [ ] 8.4 Make buttons full width on very small screens (<480px)

- [ ] 9. Arrears Page Mobile Layout
  - [ ] 9.1 Stack aging bucket cards (0-30, 31-60, 60+) single column on mobile
  - [ ] 9.2 Convert arrears table to card layout on mobile
  - [ ] 9.3 Each card shows: student name, property·room, days overdue, amount, status

## Phase 3: Bar Chart Redesign

- [ ] 10. Enhanced Bar Chart Component
  - [ ] 10.1 Redesign bar chart in p4_dashboard.jsx to show two bars per property
  - [ ] 10.2 Expected bar: #38BDF8 (sky blue) at 70% opacity
  - [ ] 10.3 Collected bar: #F59E0B (amber/gold) at 100% opacity
  - [ ] 10.4 Add 6px gap between Expected and Collected bars
  - [ ] 10.5 Position value labels above each bar (10px gap, Expected left-aligned, Collected right-aligned)
  - [ ] 10.6 When collected = expected (100%), show single gold bar with ✓ in label
  - [ ] 10.7 Set minimum chart height to 240px, minimum property group width to 120px
  - [ ] 10.8 Add legend below chart: ■ Expected (sky blue), ■ Collected (amber)
  - [ ] 10.9 Convert to horizontal bars on mobile (property names left, bars extend right)

## Phase 4: Financial Hub - Enhanced Student Profile

- [ ] 11. Payment History Timeline
  - [ ] 11.1 Fetch full payment history for student using getPaymentsByStudent
  - [ ] 11.2 Render timeline with colored dots (green for full payment, amber for partial)
  - [ ] 11.3 Each entry shows: date, amount, method, receipt, recorded_by email
  - [ ] 11.4 Display "Total paid all time: $X across Y months" at bottom
  - [ ] 11.5 Sort payments most recent first

- [ ] 12. Balance Card Enhancement
  - [ ] 12.1 Fetch current month obligation for student
  - [ ] 12.2 Display: "MAY 2026 OBLIGATION · Due: $X · Paid: $Y · Balance: $Z"
  - [ ] 12.3 Show last payment date and method below balance
  - [ ] 12.4 Add ✓ icon when balance = 0 (fully paid)

- [ ] 13. Edit Payment Feature (Admin Only)
  - [ ] 13.1 Add ✏️ edit icon to each payment entry (Admin only)
  - [ ] 13.2 Make amount, method, date, receipt fields inline-editable on click
  - [ ] 13.3 Create `updatePayment` function in paymentService.js
  - [ ] 13.4 Update payment record with updated_at and edited_by fields
  - [ ] 13.5 Trigger obligation recalculation after payment edit
  - [ ] 13.6 Refresh payment timeline after successful edit

- [ ] 14. Delete Payment Feature (Admin Only)
  - [ ] 14.1 Add 🗑️ delete icon to each payment entry (Admin only)
  - [ ] 14.2 Show confirmation modal: "Delete payment of $X from [date]?"
  - [ ] 14.3 Create `deletePayment` function in paymentService.js
  - [ ] 14.4 Delete payment record from database
  - [ ] 14.5 Trigger obligation recalculation after deletion
  - [ ] 14.6 Refresh payment timeline and balance card

- [ ] 15. Generate Tenant Statement
  - [ ] 15.1 Add "Generate Statement" button at bottom of StudentProfile drawer
  - [ ] 15.2 Fetch 6 months of obligations and payments for student
  - [ ] 15.3 Build transaction list with running balance (debits and credits)
  - [ ] 15.4 Generate printable HTML statement with student details, transactions table, summary
  - [ ] 15.5 Trigger browser print dialog for PDF save

- [ ] 16. WhatsApp Integration
  - [ ] 16.1 Add WhatsApp icon next to phone number in StudentProfile header
  - [ ] 16.2 Link opens WhatsApp with pre-filled message: "wa.me/[country_code][phone]"
  - [ ] 16.3 Use country code from settings (default +263 for Zimbabwe)

## Phase 5: Financial Hub - Financials Tab

- [ ] 17. Create Financials Tab Component
  - [ ] 17.1 Create new Financials component in p6_reports.jsx
  - [ ] 17.2 Add "Financials" tab to Reports view navigation
  - [ ] 17.3 Set up state for filters, viewMode, and ledger data

- [ ] 18. Filter Bar Implementation
  - [ ] 18.1 Add Property dropdown (All + individual properties)
  - [ ] 18.2 Add Month picker showing last 6 months as buttons
  - [ ] 18.3 Add Student search input (filter by name)
  - [ ] 18.4 Add Status filter dropdown (All, Paid, Partial, Overdue)
  - [ ] 18.5 Apply filters to ledger query in real-time

- [ ] 19. Financial Ledger Table
  - [ ] 19.1 Query monthly_obligations joined with students, rooms, properties
  - [ ] 19.2 Display columns: Student | Property | Room | Month | Due | Paid | Balance | Status | Last Payment | Actions
  - [ ] 19.3 Format month as "May 2026" not "2026-05-01"
  - [ ] 19.4 Show edit/delete icons in Actions column (Admin only)
  - [ ] 19.5 Convert to card layout on mobile (hide headers)

- [ ] 20. Summary Strip
  - [ ] 20.1 Calculate total records shown after filtering
  - [ ] 20.2 Calculate sum of Due for filtered set
  - [ ] 20.3 Calculate sum of Paid for filtered set
  - [ ] 20.4 Calculate sum of Balance (arrears) for filtered set
  - [ ] 20.5 Calculate collection rate: (Paid / Due) × 100%
  - [ ] 20.6 Display summary in horizontal strip above ledger table

- [ ] 21. Quarterly View Toggle
  - [ ] 21.1 Add "Monthly / Quarterly" toggle button above ledger
  - [ ] 21.2 When Quarterly selected, group data by Q1, Q2, Q3, Q4
  - [ ] 21.3 Aggregate due, paid, balance by student per quarter
  - [ ] 21.4 Show one row per student per quarter with summed figures

## Phase 6: Calendar View

- [ ] 22. Create Calendar Component
  - [ ] 22.1 Create new file `src/parts/p8_calendar.jsx`
  - [ ] 22.2 Add "Calendar" nav item to sidebar (icon: 📅, between Students and Reports)
  - [ ] 22.3 Set up calendar state: currentMonth, selectedDay

- [ ] 23. Calendar Grid Rendering
  - [ ] 23.1 Build 42-cell grid (6 weeks × 7 days) starting on Sunday
  - [ ] 23.2 Render day numbers with proper styling for current month vs adjacent months
  - [ ] 23.3 Highlight today's date with gold border
  - [ ] 23.4 Make grid responsive: full-width on mobile, fixed width on desktop

- [ ] 24. Calendar Data Aggregation
  - [ ] 24.1 Fetch payments for displayed month from payments table
  - [ ] 24.2 Fetch obligations for displayed month from monthly_obligations table
  - [ ] 24.3 Fetch check-ins for displayed month from students table (check_in_date)
  - [ ] 24.4 Group data by date for each calendar cell

- [ ] 25. Colored Dot Indicators
  - [ ] 25.1 Add green dot if payments exist on that date
  - [ ] 25.2 Add red dot if unpaid obligations exist on that date
  - [ ] 25.3 Add gold dot if student check-ins exist on that date
  - [ ] 25.4 Position dots horizontally below day number (max 3 dots)

- [ ] 26. Month Navigation
  - [ ] 26.1 Add Previous/Next arrow buttons in calendar header
  - [ ] 26.2 Add "Today" button to jump to current month
  - [ ] 26.3 Display current month and year in header (e.g., "May 2026")
  - [ ] 26.4 Update calendar data when month changes

- [ ] 27. Day Panel (Click Handler)
  - [ ] 27.1 Make each calendar cell clickable
  - [ ] 27.2 On click, open day panel showing detailed transactions for that date
  - [ ] 27.3 Display all payments recorded on that date (student, property, amount, method)
  - [ ] 27.4 Display all students with obligations due on that date and their status
  - [ ] 27.5 On mobile, show day panel as bottom sheet; on desktop, show as side panel
  - [ ] 27.6 Add close button to day panel

- [ ] 28. Upcoming Strip
  - [ ] 28.1 Below calendar, add horizontal scroll strip showing next 7 days
  - [ ] 28.2 Each day shows: date, number of payments recorded, number of obligations due
  - [ ] 28.3 Example: "Today: 3 payments · Tomorrow: 0 · In 3 days: Rent due for 143 students"
  - [ ] 28.4 Make strip horizontally scrollable on mobile

## Phase 7: Settings Panel

- [ ] 29. Create Settings Component
  - [ ] 29.1 Create Settings panel component in p3_modals.jsx
  - [ ] 29.2 Add ⚙️ gear icon to sidebar footer (next to logout button, Admin only)
  - [ ] 29.3 Panel slides in from right on desktop, full-width on mobile
  - [ ] 29.4 Add close button (X) in panel header

- [ ] 30. System Settings Section
  - [ ] 30.1 Fetch system settings from settings table (system_name, currency_symbol, country_phone_code)
  - [ ] 30.2 Display editable fields for each setting
  - [ ] 30.3 Add "Save" button to update settings in database
  - [ ] 30.4 Show success toast on save

- [ ] 31. Authentication Section (Email Allowlist)
  - [ ] 31.1 Fetch allowed emails from settings table (category = 'auth')
  - [ ] 31.2 Display list of allowed emails with remove button (X) for each
  - [ ] 31.3 Add input field and "Add Email" button
  - [ ] 31.4 Validate email format before adding
  - [ ] 31.5 Insert new email into settings table with category = 'auth'
  - [ ] 31.6 Update ALLOWED_EMAILS array in p1_imports_context.jsx to read from database

- [ ] 32. Properties Section
  - [ ] 32.1 Display list of all properties with current names and accent colors
  - [ ] 32.2 Add inline edit for property name
  - [ ] 32.3 Add color picker for accent color
  - [ ] 32.4 Update properties table on save
  - [ ] 32.5 Refresh property data after update

- [ ] 33. Notifications Section
  - [ ] 33.1 Add toggle switches for future features (disabled for now)
  - [ ] 33.2 WhatsApp reminders toggle (disabled)
  - [ ] 33.3 Monthly snapshot auto-save toggle (disabled)
  - [ ] 33.4 Obligation auto-generation toggle (disabled)
  - [ ] 33.5 Show "Coming soon" label for disabled toggles

- [ ] 34. Danger Zone Section
  - [ ] 34.1 Add "Clear all monthly snapshots" button with red styling
  - [ ] 34.2 Show confirmation modal before clearing snapshots
  - [ ] 34.3 Add "Regenerate all obligations" button with red styling
  - [ ] 34.4 Show confirmation modal before regenerating obligations
  - [ ] 34.5 Execute RPC functions on confirm, show success/error toast

## Phase 8: Date Intelligence & Polish

- [ ] 35. Date Intelligence Throughout App
  - [ ] 35.1 Add today's date below "MAY 2026" in Dashboard header (format: "Thursday, 15 May 2026")
  - [ ] 35.2 Calculate "Last paid X days ago" in Arrears view and StudentProfile
  - [ ] 35.3 Color code days: green ≤30, amber 31-60, red 60+
  - [ ] 35.4 Add 📅 badge if check-in anniversary within 7 days
  - [ ] 35.5 Format all obligation months as "May 2026" not "2026-05-01"

- [ ] 36. Smart Date Filters
  - [ ] 36.1 Add date filter dropdown to Financials tab: This Month, Last Month, Last 3 Months, Last 6 Months, This Year, Custom Range
  - [ ] 36.2 Add date filter dropdown to Students page with same options
  - [ ] 36.3 Implement custom range with two date pickers (start and end)
  - [ ] 36.4 Apply date filters to queries and update displayed data

- [ ] 37. Mobile Responsiveness Final Pass
  - [ ] 37.1 Test all views on 375px screen width (iPhone SE)
  - [ ] 37.2 Verify no horizontal scroll on any page
  - [ ] 37.3 Ensure all buttons are touch-friendly (min 44px height)
  - [ ] 37.4 Test modals and drawers on mobile (full-width, proper z-index)
  - [ ] 37.5 Verify keyboard doesn't break layout on mobile input focus

- [ ] 38. Toast Notifications Enhancement
  - [ ] 38.1 Ensure all success actions show green toast
  - [ ] 38.2 Ensure all error actions show red toast
  - [ ] 38.3 Add toast for: room removed, payment edited, payment deleted, settings saved, email added/removed
  - [ ] 38.4 Position toasts correctly on mobile (bottom-right on desktop, bottom-center on mobile)

## Phase 9: Testing & Verification

- [ ] 39. Database Migration Verification
  - [ ] 39.1 Run sprint4_schema_updates.sql in Supabase SQL Editor
  - [ ] 39.2 Verify rooms.is_active column exists and defaults to true
  - [ ] 39.3 Verify payments.updated_at and payments.edited_by columns exist
  - [ ] 39.4 Verify settings table created with correct schema
  - [ ] 39.5 Insert initial settings records (system_name, currency_symbol, country_phone_code)

- [ ] 40. Admin User Setup
  - [ ] 40.1 Verify trevisdaradi@gmail.com is in ALLOWED_EMAILS array
  - [ ] 40.2 Provide SQL to client for setting trevisdaradi@gmail.com as ADMIN after first login
  - [ ] 40.3 Test login with new admin email (after client runs SQL)

- [ ] 41. Feature Testing Checklist
  - [ ] 41.1 Test Remove Room feature: verify student check, soft delete, error handling
  - [ ] 41.2 Test Edit Payment: verify obligation recalculation, updated_at/edited_by fields
  - [ ] 41.3 Test Delete Payment: verify obligation recalculation, confirmation modal
  - [ ] 41.4 Test Calendar: verify dots appear correctly, day panel shows correct data
  - [ ] 41.5 Test Financials tab: verify filters work, quarterly view aggregates correctly
  - [ ] 41.6 Test Settings panel: verify email add/remove, system settings save
  - [ ] 41.7 Test Generate Statement: verify 6-month data, running balance, print dialog

- [ ] 42. Mobile Testing Checklist
  - [ ] 42.1 Test Reports page on mobile: verify card layout, no squashed headers
  - [ ] 42.2 Test Students page on mobile: verify cards show all data clearly
  - [ ] 42.3 Test Dashboard on mobile: verify 2×2 KPI grid, horizontal bar chart
  - [ ] 42.4 Test Property Detail on mobile: verify room rows collapse, buttons stack
  - [ ] 42.5 Test Calendar on mobile: verify grid fits, day panel slides up from bottom
  - [ ] 42.6 Test Settings panel on mobile: verify full-width, all sections accessible

## Phase 10: Build & Deploy

- [ ] 43. Pre-Deployment Checks
  - [ ] 43.1 Run `npm run build` locally and verify no errors
  - [ ] 43.2 Test production build with `npm run preview`
  - [ ] 43.3 Verify all environment variables are set in Netlify
  - [ ] 43.4 Check that all new SQL migrations are documented

- [ ] 44. Git Commit & Push
  - [ ] 44.1 Stage all changes: `git add .`
  - [ ] 44.2 Commit with message: "sprint4: mobile overhaul, financial hub, calendar, remove room, settings panel, bar chart redesign, trevisdaradi admin"
  - [ ] 44.3 Push to main: `git push origin main`
  - [ ] 44.4 Verify Netlify auto-deploy triggers

- [ ] 45. Post-Deployment Verification
  - [ ] 45.1 Visit live site and verify mobile layout on real device
  - [ ] 45.2 Test Reports page mobile cards
  - [ ] 45.3 Test bar chart displays correctly
  - [ ] 45.4 Test Calendar loads and shows current month
  - [ ] 45.5 Test Settings panel opens (Admin only)
  - [ ] 45.6 Verify Remove Room button appears on empty rooms
  - [ ] 45.7 Test StudentProfile payment timeline and edit/delete features
  - [ ] 45.8 Verify trevisdaradi@gmail.com can log in

- [ ] 46. Client Handoff
  - [ ] 46.1 Provide SQL script for setting trevisdaradi@gmail.com as ADMIN
  - [ ] 46.2 Document new features in README or separate CHANGELOG
  - [ ] 46.3 Provide instructions for running sprint4_schema_updates.sql
  - [ ] 46.4 Share mobile testing checklist with client
  - [ ] 46.5 Schedule walkthrough call to demo new features

---

## Notes

- All tasks reference specific requirements from the sprint brief
- Database migrations must be run before deploying code changes
- Admin-only features should check `isAdmin` before rendering UI elements
- Mobile breakpoint is @media (max-width: 768px), very small is @media (max-width: 480px)
- All financial calculations must trigger obligation recalculation
- Toast notifications should be used for all user actions (success/error)
- Test on real mobile devices (375px width minimum) before deployment
