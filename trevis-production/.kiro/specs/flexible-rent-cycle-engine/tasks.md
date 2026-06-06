# Implementation Plan: Flexible Rent Cycle Engine

## Overview

This implementation plan follows a strict 6-phase approach to migrate from calendar-month billing to student-individualized billing cycles. Each phase must be completed and verified before proceeding to the next. This is a production system — **safety is paramount**.

**Critical Implementation Constraints:**
- Use JavaScript with JSDoc type annotations (NOT full TypeScript migration)
- Each phase must be separately testable on localhost:5173
- Implement phases sequentially — never combine phases
- Follow safety-first refactoring rules strictly
- Preserve all existing payment and student records
- Build new functionality in parallel before replacing old functionality

**Verification Requirements:**
After each phase, verify on localhost:5173 before proceeding:
1. Database changes preserve existing data
2. Existing functionality continues working
3. New features integrate without breaking current features
4. All tests pass

## Tasks

### PHASE 1: Database Schema Additions

- [x] 1. Create database migration file for rent cycle fields
  - [x] 1.1 Create migration file `supabase/sprint5.5_rent_cycle_schema.sql`
    - Add new fields to students table: `billing_anchor_date`, `coverage_end_date`, `next_due_date`, `daily_rate` (all nullable)
    - Add new fields to payments table: `coverage_start`, `coverage_end`, `coverage_days` (all nullable)
    - Include rollback plan in comments
    - Include verification queries in comments
    - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.2_

  - [x] 1.2 Create data population function
    - Write SQL function `populate_rent_cycle_fields()` to calculate and populate new fields from existing payment data
    - Function should process each active student with payments
    - Calculate billing_anchor_date from most recent payment
    - Calculate coverage_end_date based on payment amount and daily rate
    - Calculate next_due_date based on billing anchor
    - Include transaction safety and error handling
    - _Requirements: 1.4, 2.1, 2.2, 8.2_

  - [x] 1.3 Create verification queries
    - Write SQL queries to verify data integrity after migration
    - Check all existing payments preserved unchanged
    - Check all existing students preserved unchanged
    - Check new fields populated correctly for sample students
    - Document expected vs actual results
    - _Requirements: 8.3, 8.4, 8.5_

- [ ] 2. Execute and verify Phase 1 migration
  - [~] 2.1 Apply migration to local database
    - Run `sprint5.5_rent_cycle_schema.sql` on local Supabase
    - Verify schema changes applied successfully
    - Run verification queries
    - _Requirements: 8.1, 8.2_

  - [~] 2.2 Run data population function
    - Execute `populate_rent_cycle_fields()` function
    - Verify new fields populated for existing students
    - Check sample student records have correct coverage dates
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [~] 2.3 Phase 1 checkpoint - Verify database integrity
    - Confirm all existing payment records unchanged
    - Confirm all existing student records unchanged
    - Confirm new fields populated correctly
    - Verify existing dashboard still works on localhost:5173
    - Ensure all tests pass
    - **STOP: Get user approval before proceeding to Phase 2**
    - _Requirements: 7.4, 8.3, 8.4_


### PHASE 2: Coverage Calculation Engine (New Services)

- [ ] 3. Create rent cycle calculator service
  - [~] 3.1 Create `src/services/rentCycleCalculator.js`
    - Implement RentCycleCalculator class with JSDoc annotations
    - Add `calculateCoverage(amount, monthlyRent)` method - returns coverage days, daily rate, payment type
    - Add `calculateCoveragePeriod(paymentDate, coverageDays)` method - returns coverage start/end dates
    - Add `calculateNextDueDate(coverageEnd, billingAnchorDay)` method - returns next due date
    - Add `calculateDailyRate(monthlyRent)` method - returns daily rate (monthlyRent / 30)
    - Include input validation and error handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write unit tests for RentCycleCalculator
    - Test full month payment gives exactly 30 days coverage
    - Test partial payment gives proportional coverage
    - Test overpayment extends coverage beyond 30 days
    - Test daily rate calculation accuracy
    - Test edge cases (zero amount, negative values, very large amounts)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4. Create payment processor service
  - [~] 4.1 Create `src/services/paymentProcessor.js`
    - Implement PaymentProcessor class with JSDoc annotations
    - Constructor accepts RentCycleCalculator instance
    - Add `processPayment(payment, student)` async method - calculates and returns billing data
    - Integrate with RentCycleCalculator for coverage calculations
    - Calculate billing anchor date from payment date
    - Calculate next due date after coverage period
    - Return complete billing update object
    - _Requirements: 1.1, 1.2, 1.3, 5.4_

  - [ ]* 4.2 Write unit tests for PaymentProcessor
    - Test payment processing updates billing anchor correctly
    - Test coverage period calculation from payment
    - Test next due date calculation
    - Test integration with RentCycleCalculator
    - Mock Supabase client for isolated testing
    - _Requirements: 1.1, 1.2, 1.3, 5.4, 5.5_


- [~] 5. Phase 2 checkpoint - Verify calculation engines
  - Verify RentCycleCalculator produces correct coverage calculations
  - Verify PaymentProcessor integrates correctly with calculator
  - Run unit tests and ensure all pass
  - Test with sample data (e.g., $150 payment on $150/month rent = 30 days)
  - **STOP: Get user approval before proceeding to Phase 3**
  - _Requirements: 2.1, 2.2, 2.3_

### PHASE 3: Student Status Classification Engine

- [ ] 6. Create status classifier service
  - [~] 6.1 Create `src/services/statusClassifier.js`
    - Implement StatusClassifier class with JSDoc annotations
    - Add `classifyStatus(coverageEndDate, currentDate)` method
    - Return status: CURRENT (>7 days), EXPIRING_SOON (1-7 days), OVERDUE (<1 day)
    - Calculate days remaining or days overdue
    - Return display text for UI rendering
    - Add `getStatusCounts(students)` method for dashboard metrics
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

  - [ ]* 6.2 Write unit tests for StatusClassifier
    - Test CURRENT status for coverage > 7 days in future
    - Test EXPIRING_SOON status for 1-7 days in future
    - Test OVERDUE status for past coverage dates
    - Test days remaining calculation accuracy
    - Test days overdue calculation accuracy
    - Test status counts aggregation
    - Test edge case: coverage ends today
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 7. Enhance student service with status integration
  - [~] 7.1 Update `src/services/studentService.js`
    - Add import for StatusClassifier
    - Create `getStudentsWithStatus(propertyId)` function
    - Fetch students with coverage_end_date from database
    - Enhance each student record with status classification
    - Add `formatCoveragePeriod(student)` helper function
    - Return students with statusInfo, coveragePeriod, dailyRateFormatted
    - Keep existing functions unchanged (parallel operation)
    - _Requirements: 3.1, 3.2, 3.3, 4.4, 7.1, 7.4_


  - [ ]* 7.2 Write integration tests for enhanced student service
    - Test getStudentsWithStatus returns correct status classifications
    - Test coverage period formatting
    - Test daily rate formatting
    - Mock database responses
    - Verify existing functions still work unchanged
    - _Requirements: 3.1, 3.2, 3.3, 4.4_

- [~] 8. Phase 3 checkpoint - Verify status engine
  - Verify StatusClassifier correctly classifies test students
  - Verify getStudentsWithStatus enhances records correctly
  - Run all unit and integration tests
  - Test status calculations with sample coverage dates
  - Verify existing studentService functions unchanged
  - **STOP: Get user approval before proceeding to Phase 4**
  - _Requirements: 3.1, 3.2, 3.3, 7.1, 7.4_

### PHASE 4: Dashboard and UI Integration

- [ ] 9. Update dashboard KPI metrics
  - [~] 9.1 Update `src/parts/p4_dashboard.jsx` KPI strip
    - Import StatusClassifier
    - Modify Dashboard component to use getStudentsWithStatus
    - Update KPI calculations to use new status classifications
    - Replace "Outstanding" metric with status-based metrics
    - Update "Current" stat to show students with >7 days coverage
    - Update "Expiring Soon" stat to show students with 1-7 days coverage  
    - Update "Overdue" stat to show students with expired coverage
    - Keep existing "Collection Rate" stat unchanged
    - Add subtitle labels: "7+ days remaining", "1-7 days remaining", "Coverage expired"
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [~] 9.2 Update property card metrics in dashboard
    - Update property-level metrics to reflect new status system
    - Show Current/Expiring/Overdue counts per property
    - Update "Alerts" badge to show count of Expiring Soon + Overdue
    - Keep existing collected/arrears calculations unchanged
    - _Requirements: 4.1, 4.2, 4.3_


- [ ] 10. Update room list view to show coverage status
  - [~] 10.1 Update room list in property view (likely in `src/parts/p5_views.jsx`)
    - Display coverage status badge next to student names
    - Show "X days remaining" or "X days overdue" label
    - Use color coding: green (Current), amber (Expiring Soon), red (Overdue)
    - Add coverage end date tooltip on hover
    - Keep existing layout and other data unchanged
    - _Requirements: 4.4_

- [ ] 11. Update student profile view to show coverage details
  - [~] 11.1 Add coverage information card to student profile drawer
    - Create new "Coverage" section in student profile
    - Display billing anchor date
    - Display current coverage period (start - end dates)
    - Display next due date
    - Display daily rate with formatting
    - Show coverage status with visual indicator
    - Position coverage card prominently (after basic info, before payments)
    - _Requirements: 4.5_

  - [~] 11.2 Update payment history display in student profile
    - Add coverage dates to each payment entry
    - Show "Coverage: [start] - [end]" for each payment
    - Display coverage days count
    - Keep existing payment amount, date, method unchanged
    - _Requirements: 4.5, 5.5_

- [ ] 12. Add payment preview to payment recording form
  - [~] 12.1 Update payment modal in `src/parts/p3_modals.jsx`
    - Import RentCycleCalculator
    - Add real-time payment preview when amount entered
    - Show coverage days calculation
    - Show resulting coverage end date
    - Display daily rate
    - Add "Full Month" badge when amount ≈ monthly rent
    - Show green preview box with coverage details
    - Keep existing payment form fields unchanged
    - _Requirements: 5.1, 5.2, 5.3_


  - [ ]* 12.2 Write integration tests for payment preview
    - Test preview appears when amount entered
    - Test coverage calculation accuracy
    - Test full month detection
    - Test preview updates on amount change
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 13. Update payment recording to save coverage data
  - [~] 13.1 Enhance `recordPayment` in `src/services/paymentService.js`
    - Import PaymentProcessor and RentCycleCalculator
    - After payment recorded, calculate coverage data
    - Update payment record with coverage_start, coverage_end, coverage_days
    - Update student record with billing_anchor_date, coverage_end_date, next_due_date, daily_rate
    - Use PaymentProcessor.processPayment for calculations
    - Keep existing payment recording logic for month_year, receipt, etc.
    - _Requirements: 1.1, 1.2, 1.3, 5.4, 5.5, 7.4_

  - [ ]* 13.2 Write integration tests for enhanced payment recording
    - Test payment updates coverage fields in payments table
    - Test payment updates student billing fields
    - Test billing anchor set correctly from payment date
    - Test coverage end date calculated correctly
    - Verify existing payment data preserved
    - _Requirements: 5.4, 5.5, 7.4, 8.3_

- [~] 14. Phase 4 checkpoint - Verify dashboard integration on localhost:5173
  - Open localhost:5173 and verify all 5 success criteria from sprint 5.5-success-criteria.md:
    1. Dashboard KPI strip shows Current, Expiring Soon, Overdue with real numbers (not zeroes/dashes)
    2. Room list shows student with "X days remaining" next to status badge
    3. Student profile shows Coverage card with period and daily rate
    4. Payment modal shows green preview box with coverage days when amount entered
    5. Verify payment recording updates coverage fields in database
  - Verify existing dashboard features still work (collection rates, property cards, charts)
  - Verify no console errors
  - Run all tests and ensure passing
  - **STOP: Get user approval before proceeding to Phase 5**
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.4, 5.5_


### PHASE 5: Arrears Management and Report Updates

- [ ] 15. Update arrears view with new status buckets
  - [~] 15.1 Update `src/parts/p7_arrears.jsx` to use status classifications
    - Import StatusClassifier
    - Replace existing arrears logic with status-based bucketing
    - Create "Current" bucket for students with >7 days coverage
    - Create "Expiring Soon" bucket for students with 1-7 days remaining
    - Create "0-30 Days Overdue" bucket for recently overdue
    - Create "31-60 Days Overdue" bucket for moderately overdue
    - Create "60+ Days Overdue" bucket for severely overdue
    - Display days remaining/overdue for each student
    - Show coverage end date for each student
    - Update bucket counts and totals
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 15.2 Write integration tests for arrears bucketing
    - Test students placed in correct buckets based on coverage dates
    - Test bucket counts accurate
    - Test days remaining/overdue displayed correctly
    - Test bucket transitions as dates change
    - _Requirements: 6.3, 6.4_

- [ ] 16. Update report service for dual reporting strategy
  - [~] 16.1 Update `src/services/reportService.js`
    - Keep existing `generateCashBasisReport` unchanged for financial reports
    - Add new `generateCoverageReport(reportDate)` function
    - Coverage report uses coverage_end_date for operational views
    - Coverage report includes status classifications
    - Coverage report shows days remaining/overdue
    - Ensure financial reports continue using payment received dates
    - Document the dual reporting strategy in comments
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_


  - [ ]* 16.2 Write tests for dual reporting strategy
    - Test cash-basis reports unchanged from existing format
    - Test coverage reports use status classifications
    - Test financial reports use payment received dates
    - Test operational reports use coverage periods
    - Verify backward compatibility with existing report queries
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 17. Update reports view UI
  - [~] 17.1 Update `src/parts/p6_reports.jsx` to show both report types
    - Add toggle/tabs for "Financial Reports" vs "Operational Reports"
    - Financial reports continue using existing cash-basis format
    - Add new operational report view showing coverage-based status
    - Display coverage periods in operational view
    - Show status classifications in operational view
    - Keep existing financial report format unchanged
    - _Requirements: 10.1, 10.2, 10.3_

- [~] 18. Phase 5 checkpoint - Verify arrears and reports on localhost:5173
  - Open localhost:5173 and verify:
    - Arrears page shows four bucket cards with correct counts
    - Expiring Soon bucket shows students with 1-7 days remaining
    - Overdue buckets (0-30, 31-60, 60+) show correct students
    - Reports page financial tab shows unchanged cash-basis reports
    - Reports page operational tab shows coverage-based reports
  - Verify existing financial reports unchanged
  - Run all tests and ensure passing
  - **STOP: Get user approval before proceeding to Phase 6**
  - _Requirements: 6.1, 6.2, 6.3, 10.1, 10.2, 10.3_


### PHASE 6: Property-Based Testing and Verification

- [ ] 19. Set up property-based testing framework
  - [~] 19.1 Install fast-check library
    - Add fast-check to package.json dev dependencies
    - Install using `npm install --save-dev fast-check`
    - Configure Vitest to work with fast-check
    - _Requirements: Testing strategy_

- [ ] 20. Write property-based tests for coverage calculations
  - [ ]* 20.1 Property test: Daily Rate Calculation (Property 5)
    - **Property 5: Daily Rate Calculation**
    - **Validates: Requirements 2.2**
    - Test: For any positive monthly rent, daily rate = monthlyRent / 30
    - Use fc.float for monthly rent generation (range: 1-5000)
    - Run 100 iterations minimum
    - _Requirements: 2.2_

  - [ ]* 20.2 Property test: Coverage Days Calculation (Property 6)
    - **Property 6: Coverage Days Calculation**
    - **Validates: Requirements 2.1**
    - Test: For any valid payment amount and daily rate, coverage days = round(amount / dailyRate)
    - Generate random payment amounts and monthly rents
    - Run 100 iterations minimum
    - _Requirements: 2.1_

  - [ ]* 20.3 Property test: Full Payment Coverage (Property 7)
    - **Property 7: Full Payment Coverage**
    - **Validates: Requirements 2.3**
    - Test: When payment amount equals monthly rent, coverage = exactly 30 days
    - Generate random monthly rent values
    - Test with exact matches and near-matches (within $1)
    - Run 100 iterations minimum
    - _Requirements: 2.3_

  - [ ]* 20.4 Property test: Proportional Coverage (Property 8)
    - **Property 8: Proportional Coverage**
    - **Validates: Requirements 2.4**
    - Test: For payment < monthly rent, coverage days < 30 proportionally
    - Generate payment amounts between 0.1x and 0.9x monthly rent
    - Run 100 iterations minimum
    - _Requirements: 2.4_


  - [ ]* 20.5 Property test: Overpayment Extended Coverage (Property 9)
    - **Property 9: Overpayment Extended Coverage**
    - **Validates: Requirements 2.5**
    - Test: For payment > monthly rent, coverage days > 30 proportionally
    - Generate payment amounts between 1.1x and 3x monthly rent
    - Run 100 iterations minimum
    - _Requirements: 2.5_

- [ ] 21. Write property-based tests for status classification
  - [ ]* 21.1 Property test: Status Classification Rules (Property 10)
    - **Property 10: Status Classification Rules**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Test: Status = CURRENT when coverage > 7 days, EXPIRING_SOON when 1-7 days, OVERDUE when past
    - Generate random coverage dates across all ranges
    - Run 100 iterations minimum
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 21.2 Property test: Days Remaining Calculation (Property 11)
    - **Property 11: Days Remaining Calculation**
    - **Validates: Requirements 3.4**
    - Test: For any coverage end date and current date, daysRemaining = coverageEnd - current
    - Generate random date pairs
    - Run 100 iterations minimum
    - _Requirements: 3.4_

  - [ ]* 21.3 Property test: Days Overdue Calculation (Property 12)
    - **Property 12: Days Overdue Calculation**
    - **Validates: Requirements 3.5**
    - Test: For overdue students, daysOverdue = current - coverageEnd
    - Generate random past coverage dates
    - Run 100 iterations minimum
    - _Requirements: 3.5_

- [ ] 22. Write property-based tests for billing cycle management
  - [ ]* 22.1 Property test: Billing Anchor Date Assignment (Property 1)
    - **Property 1: Billing Anchor Date Assignment**
    - **Validates: Requirements 1.1**
    - Test: For any payment date, billing anchor = day-of-month of payment date
    - Generate random payment dates
    - Run 100 iterations minimum
    - _Requirements: 1.1_


  - [ ]* 22.2 Property test: Coverage End Date Calculation (Property 2)
    - **Property 2: Coverage End Date Calculation**
    - **Validates: Requirements 1.2**
    - Test: Coverage end date = payment date + coverage days
    - Generate random payment dates and coverage day values
    - Run 100 iterations minimum
    - _Requirements: 1.2_

  - [ ]* 22.3 Property test: Next Due Date Calculation (Property 3)
    - **Property 3: Next Due Date Calculation**
    - **Validates: Requirements 1.3**
    - Test: Next due date = next occurrence of billing anchor day after coverage end
    - Generate random coverage end dates and anchor days
    - Run 100 iterations minimum
    - _Requirements: 1.3_

- [ ] 23. Write property-based tests for data integrity
  - [ ]* 23.1 Property test: Payment History Preservation (Property 4)
    - **Property 4: Payment History Preservation**
    - **Validates: Requirements 1.5, 8.3**
    - Test: Migration preserves all payment data exactly
    - Generate sample payment datasets
    - Run migration simulation
    - Verify all original data unchanged
    - Run 100 iterations minimum
    - _Requirements: 1.5, 8.3_

  - [ ]* 23.2 Property test: Student Data Preservation (Property 18)
    - **Property 18: Student Data Preservation**
    - **Validates: Requirements 8.4**
    - Test: Migration preserves all student data exactly
    - Generate sample student datasets
    - Run migration simulation
    - Verify all original data unchanged
    - Run 100 iterations minimum
    - _Requirements: 8.4_

  - [ ]* 23.3 Property test: Parallel System Operation (Property 17)
    - **Property 17: Parallel System Operation**
    - **Validates: Requirements 7.1, 7.4**
    - Test: New calculations don't modify existing monthly billing fields
    - Generate billing calculations
    - Verify new fields populated without touching existing fields
    - Run 100 iterations minimum
    - _Requirements: 7.1, 7.4_


- [ ] 24. Write property-based tests for dashboard and UI
  - [ ]* 24.1 Property test: Dashboard Status Counts (Property 13)
    - **Property 13: Dashboard Status Counts**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Test: Dashboard counts accurately reflect Current, Expiring Soon, Overdue student counts
    - Generate random student collections with various coverage dates
    - Run 100 iterations minimum
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 24.2 Property test: Payment Preview Coverage Display (Property 14)
    - **Property 14: Payment Preview Coverage Display**
    - **Validates: Requirements 5.1, 5.2**
    - Test: Preview shows correct coverage days and end date for any non-zero payment
    - Generate random payment amounts and monthly rents
    - Run 100 iterations minimum
    - _Requirements: 5.1, 5.2_

  - [ ]* 24.3 Property test: Coverage Data Storage (Property 15)
    - **Property 15: Coverage Data Storage**
    - **Validates: Requirements 5.5**
    - Test: Payment records include correct coverage start, end, and days
    - Generate random payment scenarios
    - Verify stored coverage data matches calculations
    - Run 100 iterations minimum
    - _Requirements: 5.5_

  - [ ]* 24.4 Property test: Arrears Bucketing (Property 16)
    - **Property 16: Arrears Bucketing**
    - **Validates: Requirements 6.3**
    - Test: Overdue students placed in correct time buckets (0-30, 31-60, 60+)
    - Generate students with various overdue durations
    - Run 100 iterations minimum
    - _Requirements: 6.3_

- [ ] 25. Write property-based tests for data formatting
  - [ ]* 25.1 Property test: Coverage Period Formatting (Property 20)
    - **Property 20: Coverage Period Formatting**
    - **Validates: Requirements 9.4**
    - Test: Pretty printer formats coverage periods into human-readable date ranges
    - Generate random coverage start/end date pairs
    - Run 100 iterations minimum
    - _Requirements: 9.4_


  - [ ]* 25.2 Property test: Parser Round-trip (Property 19)
    - **Property 19: Parser Round-trip Property**
    - **Validates: Requirements 9.5**
    - Test: Parse → format → parse produces equivalent coverage data
    - Generate random payment records
    - Verify round-trip consistency
    - Run 100 iterations minimum
    - _Requirements: 9.5_

- [~] 26. Run comprehensive test suite
  - Run all property-based tests (minimum 100 iterations each)
  - Run all unit tests
  - Run all integration tests
  - Verify all tests pass
  - Generate test coverage report
  - Document any test failures and fix before proceeding
  - _Requirements: All_

- [~] 27. Final end-to-end verification on localhost:5173
  - Complete all 5 verification steps from sprint 5.5-success-criteria.md:
    1. Dashboard KPI strip shows Current, Expiring Soon, Overdue with real numbers
    2. Room list shows "X days remaining" next to student status badges
    3. Student profile shows Coverage card with period and daily rate
    4. Payment preview shows coverage calculation when entering amount
    5. Arrears page shows correct bucketing by status
  - Test with multiple students having different coverage scenarios
  - Verify financial reports unchanged (cash-basis)
  - Verify operational reports show coverage-based data
  - Check for console errors
  - Verify database integrity (no data loss)
  - Test error handling (invalid inputs, edge cases)
  - Performance check: status calculations < 1 second
  - _Requirements: All_

- [~] 28. Final checkpoint - Production readiness verification
  - All property-based tests passing (100+ iterations each)
  - All unit tests passing
  - All integration tests passing
  - All 5 success criteria verified on localhost:5173
  - No console errors or warnings
  - Database migration tested and verified
  - Existing data preserved (payments, students, financial reports)
  - Documentation updated
  - Performance acceptable
  - Ensure all tests pass, ask the user if questions arise
  - **READY FOR PRODUCTION: Get final user approval before deployment**


## Notes

### Task Marking and Implementation Rules

- **Tasks marked with `*` are OPTIONAL** and can be skipped for faster MVP delivery
- **Test-related sub-tasks are marked optional** to allow flexibility in testing approach
- **Core implementation tasks are NOT optional** and must be completed
- **Property-based tests (all marked `*`)** validate universal correctness properties
- **Unit tests (marked `*`)** validate specific examples and edge cases
- **Integration tests (marked `*`)** validate system interactions

### Phase Dependencies

- **Each phase MUST be completed before the next phase begins**
- **Checkpoint tasks require user verification** before proceeding
- **Phase 1 affects database only** - no code changes
- **Phase 2-3 create new services** - existing code unchanged
- **Phase 4-5 integrate new services** - parallel operation with existing features
- **Phase 6 validates everything** - comprehensive testing

### Requirements Traceability

- Every task references specific requirement numbers from requirements.md
- Property-based tests validate design properties from design.md
- Checkpoint tasks ensure incremental verification
- Each phase builds on previous phase without breaking existing functionality

### Verification Strategy

After each phase checkpoint, verify on localhost:5173:
1. **Database integrity**: Existing data preserved
2. **Functionality**: Existing features work unchanged
3. **Integration**: New features integrate smoothly
4. **Tests**: All tests pass
5. **Performance**: Response times acceptable

### Safety-First Principles Applied

1. **Additive-only migrations**: No data loss possible
2. **Parallel operation**: Old and new systems coexist
3. **Incremental rollout**: One phase at a time
4. **Comprehensive testing**: Property-based + unit + integration
5. **User checkpoints**: Approval required between phases
6. **Rollback capability**: Each phase can be reverted

### Technical Stack

- **Language**: JavaScript with JSDoc type annotations
- **Testing**: Vitest + fast-check (property-based testing)
- **Database**: PostgreSQL (Supabase)
- **Frontend**: React (existing components)
- **Services**: New service classes for rent cycle logic

### Property-Based Testing Configuration

- **Library**: fast-check (JavaScript PBT library)
- **Minimum iterations**: 100 per property test
- **Tag format**: `Feature: flexible-rent-cycle-engine, Property {number}: {property_text}`
- **Test categories**: Coverage calculations, status classification, billing cycles, data integrity


## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.2"]
    },
    {
      "id": 2,
      "tasks": ["3.1", "4.1"]
    },
    {
      "id": 3,
      "tasks": ["3.2", "4.2", "6.1"]
    },
    {
      "id": 4,
      "tasks": ["6.2", "7.1"]
    },
    {
      "id": 5,
      "tasks": ["7.2", "9.1", "9.2"]
    },
    {
      "id": 6,
      "tasks": ["10.1", "11.1", "11.2", "12.1"]
    },
    {
      "id": 7,
      "tasks": ["12.2", "13.1"]
    },
    {
      "id": 8,
      "tasks": ["13.2", "15.1", "16.1"]
    },
    {
      "id": 9,
      "tasks": ["15.2", "16.2", "17.1"]
    },
    {
      "id": 10,
      "tasks": ["19.1"]
    },
    {
      "id": 11,
      "tasks": ["20.1", "20.2", "20.3", "20.4", "20.5"]
    },
    {
      "id": 12,
      "tasks": ["21.1", "21.2", "21.3"]
    },
    {
      "id": 13,
      "tasks": ["22.1", "22.2", "22.3"]
    },
    {
      "id": 14,
      "tasks": ["23.1", "23.2", "23.3"]
    },
    {
      "id": 15,
      "tasks": ["24.1", "24.2", "24.3", "24.4"]
    },
    {
      "id": 16,
      "tasks": ["25.1", "25.2"]
    }
  ]
}
```
