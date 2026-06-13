This sprint replaces the calendar-month billing model with a student-relative tenancy cycle engine. This is a fundamental change to the financial core of the system. Read everything before touching any code. Do not push to GitHub until all verification steps pass on localhost.

THE BUSINESS RULE — UNDERSTAND THIS FIRST
Every student has their own billing clock that starts the day they pay. A student who pays on 19 June has coverage from 19 June to 18 July. They are not overdue on 1 July. They are overdue on 19 July. The system must track each student's individual coverage window, not a shared calendar month.
Reports stay on cash basis — income reported by the calendar month the payment was received. Operations (who is overdue, days remaining) use the coverage window.

VERIFICATION SEQUENCE — DO THIS BEFORE COMMITTING
Run the build:
bash node build_app.cjs
npm run dev
Open localhost:5173 and confirm in order:

Dashboard KPI strip shows Current, Expiring Soon, Overdue with real numbers from the database — not zeroes, not dashes
Click King Fisher → expand Room 1 → Bethel Mudavanhu shows "29 days remaining" or similar coverage label next to her status badge
Click Bethel's name → Student Profile drawer opens → Coverage card shows her coverage period and daily rate → Payment history entry shows coverage dates
Click + Record Payment → select any student with $150/month rent → type 150 in amount → green preview box appears showing "30 days coverage"
Go to Arrears → four bucket cards visible → Expiring Soon bucket shows students with 1–7 days remaining → 0–30 overdue shows students with expired coverage

If any of these five checks fail, fix it before proceeding. Do not push if any check fails.
Once all five pass: