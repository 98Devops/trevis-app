


# Implementation Plan: Sprint 5 — Production-Ready Trevis

## Overview

This implementation plan transforms Trevis from a functional demo into a production-grade business tool. The plan covers six critical areas: database performance optimization with indexes and query improvements, student room transfer service with audit trails, comprehensive inline data editing for all fields, mobile calendar feature parity with full grid rendering, proper handling of unassigned bed records, and database health maintenance utilities. All tasks build incrementally to ensure data integrity, performance, and mobile parity.

## Tasks

### Section 1: Database Performance & Reliability Foundation

- [ ] 1. Create database performance indexes and error boundaries
  - [x] 1.1 Create database migration file for performance indexes
    - Create `supabase/sprint5_performance_indexes.sql`
    - Add btree indexes on payments(student_id, month_year)
    - Add btree indexes on payments(payment_date)
    - Add btree indexes on payments(payment_method)
    - Add btree indexes on students(room_id, status)
    - Add btree indexes on students(status)
    - Add btree indexes on students(check_in_date)
    - Add btree indexes on monthly_obligations(student_id, month, status)
    - Add btree indexes on monthly_obligations(status)
    - Add btree indexes on monthly_obligations(month)
    - Add btree indexes on rooms(property_id, is_active)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 26.1-26.10_

  - [x] 1.2 Create ErrorBoundary component
    - Create `src/components/ErrorBoundary.jsx`
    - Implement React error boundary with getDerivedStateFromError
    - Implement componentDidCatch with console logging
    - Create fallback UI with component name and refresh button
    - Add remount functionality on refresh click
    - Export ErrorBoundary component
    - _Requirements: 3.7, 3.8, 3.9_

  - [x] 1.3 Wrap main application components in error boundaries
    - Wrap Dashboard component in ErrorBoundary in App.jsx
    - Wrap PropertyDetail component in ErrorBoundary
    - Wrap Students component in ErrorBoundary
    - Wrap Reports component in ErrorBoundary
    - Wrap Calendar component in ErrorBoundary
    - Wrap Finances component in ErrorBoundary
    - Test error boundary isolation (one component error doesn't crash others)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.10_

- [ ] 2. Checkpoint - Verify indexes and error boundaries
  - Run the performance index migration on Supabase
  - Verify all indexes created successfully using Supabase dashboard
  - Test error boundary by throwing test error in Dashboard
  - Confirm error boundary displays fallback UI
  - Confirm other components continue functioning
  - Ensure all tests pass, ask the user if questions arise.

### Section 2: Student Transfer Service with Audit Trails

- [ ] 3. Create student_transfers table and transfer service
  - [x] 3.1 Create database migration for student_transfers table
    - Create `supabase/sprint5_student_transfers.sql`
    - Create student_transfers table with id, student_id, from_room_id, to_room_id
    - Add transfer_date (default CURRENT_DATE), reason (optional text)
    - Add performed_by (foreign key to auth.users), created_at (default now())
    - Add constraint: from_room_id != to_room_id
    - Create index on student_transfers(student_id)
    - Create index on student_transfers(transfer_date)
    - Set up CASCADE DELETE when student is deleted
    - _Requirements: 24.1-24.12_

  - [x] 3.2 Create transferService.js with core transfer functions
    - Create `src/services/transferService.js`
    - Implement getAvailableRooms(propertyId) function
    - Query rooms with bed_capacity > occupied_beds
    - Calculate occupiedBeds counting UNASSIGNED records
    - Exclude VACATED students from occupied count
    - Return room details: id, roomNumber, bedCapacity, occupiedBeds, availableBeds, rentPerBed, propertyName
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.3 Implement executeTransfer function in transferService
    - Add executeTransfer(transferRequest) function to transferService.js
    - Validate student status is ACTIVE
    - Validate target room has available bed capacity
    - Validate fromRoomId != toRoomId
    - Return error messages for validation failures
    - Begin Supabase transaction
    - Insert record into student_transfers table
    - Update student.room_id to target room
    - If rent differs, update current month obligation amount_due
    - Commit transaction atomically
    - Return TransferResult with success, transferId, obligationUpdated
    - Handle errors with rollback and error message
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.1-5.10_

  - [x] 3.4 Implement getTransferHistory function in transferService
    - Add getTransferHistory(studentId) function to transferService.js
    - Query student_transfers table with JOIN to rooms and properties
    - Select from_room_id, to_room_id, room numbers, property names
    - Select transfer_date, reason, performed_by (user email)
    - Order by transfer_date DESC (most recent first)
    - Return array of Transfer objects
    - _Requirements: 7.1-7.7_

- [ ] 4. Build student transfer UI flow
  - [ ] 4.1 Add Transfer Room button to StudentProfile component
    - Open `src/parts/p3_modals.jsx` and locate StudentProfile component
    - Add "Transfer Room" button in student profile header
    - Add state for transfer modal: isTransferOpen, transferStep, selectedProperty, selectedRoom, transferReason
    - Create handleTransferClick function to open transfer modal
    - _Requirements: 6.1_

  - [ ] 4.2 Create property selector step in transfer modal
    - Add property selector dropdown in transfer modal
    - Fetch all properties with available beds using transferService
    - Display property names in dropdown
    - On property selection, set selectedProperty state
    - Move to room selector step
    - _Requirements: 6.2_

  - [ ] 4.3 Create room selector step in transfer modal
    - Add room selector dropdown showing rooms in selected property
    - Call getAvailableRooms(selectedProperty) from transferService
    - Display room options with format: "Room X — Y beds free — $Z/bed"
    - On room selection, set selectedRoom state
    - Move to confirmation step
    - _Requirements: 6.3, 6.4_

  - [ ] 4.4 Create transfer confirmation card
    - Display from/to details: current room → target room
    - Show property names for both rooms
    - If rent differs, display amber warning: "Rent will change from $X to $Y"
    - Add optional reason text field
    - Add "Confirm Transfer" and "Cancel" buttons
    - _Requirements: 6.5, 6.6_

  - [ ] 4.5 Implement transfer execution and completion
    - On confirm, call executeTransfer from transferService
    - Pass studentId, fromRoomId, toRoomId, transferDate, reason, performedBy
    - Display success confirmation message
    - Refresh student profile data
    - Refresh room lists in PropertyDetail
    - Close transfer modal
    - On error, display error message and keep modal open
    - _Requirements: 6.7, 6.8, 6.10_

  - [ ] 4.6 Add transfer history section to StudentProfile
    - Add "Transfer History" section below student details
    - Call getTransferHistory(studentId) on profile open
    - Display transfer records with from/to room numbers and property names
    - Show transfer date, reason (if provided), performed by user email
    - Order by date descending (most recent first)
    - _Requirements: 7.1-7.7_

- [ ] 5. Checkpoint - Test student transfer flow
  - Run student_transfers migration on Supabase
  - Verify table and indexes created successfully
  - Test transfer flow: select property → select room → confirm
  - Verify transfer record created in student_transfers table
  - Verify student.room_id updated correctly
  - Verify obligation updated when rent differs
  - Verify transfer history displays correctly
  - Test validation: full room, same room, inactive student
  - Ensure all tests pass, ask the user if questions arise.

### Section 3: Inline Editing for All Data Entry Fields

- [ ] 6. Create inline editing infrastructure
  - [x] 6.1 Create InlineEditField component
    - Create `src/components/InlineEditField.jsx`
    - Accept props: value, type (text/phone/date/number/select/textarea), onSave, validation
    - Implement click-to-edit behavior
    - Show input control on click (text input, date picker, select dropdown, textarea)
    - Implement auto-save on blur
    - Show optimistic UI update before server confirmation
    - Revert to original value on save failure with error message
    - _Requirements: 8.10, 8.11, 8.12, 8.13_

  - [ ] 6.2 Add inline editing to student profile fields
    - Open `src/parts/p3_modals.jsx` and locate StudentProfile component
    - Replace static text with InlineEditField for full_name
    - Add InlineEditField for phone, national_id
    - Add InlineEditField for emergency_contact_name, emergency_contact_phone
    - Add InlineEditField for check_in_date (date picker)
    - Add InlineEditField for payment_plan (select dropdown)
    - Add InlineEditField for notes (textarea)
    - Add InlineEditField for status (select dropdown)
    - Implement onSave handlers calling studentService.updateStudent
    - _Requirements: 8.1-8.9_

- [ ] 7. Implement payment editing service and UI
  - [ ] 7.1 Create payment edit functions in paymentService
    - Open `src/services/paymentService.js`
    - Add updatePayment(paymentId, updates, userId) function
    - Validate payment_date is not in future
    - Validate amount > 0
    - Validate payment_method is one of allowed values (Cash, EcoCash, Bank Transfer, Zipit, Swipe)
    - Recalculate month_year from payment_date (YYYY-MM format)
    - Update payment record with updated_at and edited_by
    - Call recalculateBalances() for affected months
    - Return success/error result
    - _Requirements: 10.1-10.10_

  - [ ] 7.2 Implement balance recalculation logic
    - Add recalculateMonthlyObligation(studentId, monthYear) function to paymentService
    - Sum all payment amounts for student and month
    - Update monthly_obligations.amount_paid
    - Set status to PAID if amount_paid >= amount_due
    - Set status to PARTIAL if 0 < amount_paid < amount_due
    - Set status to OVERDUE if amount_paid = 0
    - Update student status based on current month obligation
    - _Requirements: 11.1-11.10_

  - [ ] 7.3 Add inline editing to payment records in StudentProfile
    - Locate payment history section in StudentProfile component
    - Add InlineEditField for payment_date (date picker)
    - Add InlineEditField for amount (number input)
    - Add InlineEditField for payment_method (select dropdown)
    - Add InlineEditField for receipt_number (text input)
    - Add InlineEditField for notes (textarea)
    - Show amber warning when payment_date changes to different month
    - Implement onSave handlers calling paymentService.updatePayment
    - _Requirements: 9.1-9.10_

- [ ] 8. Add inline editing for room details
  - [ ] 8.1 Add inline editing to room fields in PropertyDetail
    - Open `src/parts/p5_views.jsx` and locate PropertyDetail component
    - Add InlineEditField for room_number (Admin only)
    - Add InlineEditField for bed_capacity (Admin only)
    - Add InlineEditField for rent_per_bed (Admin only)
    - Add InlineEditField for notes (Admin only)
    - Validate bed_capacity >= current occupied beds
    - Validate rent_per_bed > 0
    - Show warning when rent_per_bed changes about impact on future obligations
    - Restrict editing to users with admin role
    - Implement onSave handlers calling propertyService.updateRoom
    - _Requirements: 12.1-12.8_

- [ ] 9. Checkpoint - Test inline editing
  - Test student profile field editing (name, phone, dates, notes)
  - Test payment editing with date changes
  - Verify amber warning displays for backdated payments
  - Verify balance recalculation after payment edits
  - Test room editing (Admin only)
  - Verify validation errors display correctly
  - Verify optimistic UI updates and error rollback
  - Ensure all tests pass, ask the user if questions arise.

### Section 4: Mobile Calendar Feature Parity

- [ ] 10. Implement mobile calendar grid rendering
  - [ ] 10.1 Create mobile calendar grid layout
    - Open `src/parts/p8_calendar.jsx` and locate Calendar component
    - Add responsive breakpoint detection: mobile (≤768px), tablet (769-1024px), desktop (≥1025px)
    - Create renderMobileCalendarGrid function
    - Generate 42 cells (6 weeks × 7 days) for mobile view
    - Display weekday labels: Sun, Mon, Tue, Wed, Thu, Fri, Sat
    - Display month and year label
    - Align first day of month to correct weekday column
    - Display empty cells for days outside current month
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.9, 13.10_

  - [ ] 10.2 Apply mobile calendar responsive styles
    - Add CSS media query for mobile (max-width: 768px)
    - Set grid to 7 columns: `grid-template-columns: repeat(7, 1fr)`
    - Set cell min-height to 44px (touch target minimum)
    - Set cell padding to 4px
    - Set font size to 11px
    - Set event dot size to 5px
    - Add CSS for tablet (769-1024px) and desktop (≥1025px) breakpoints
    - Desktop: cell min-height 90px, padding 8px, font 13px, dot 6px
    - _Requirements: 13.5, 13.6, 13.7, 13.8, 16.1-16.10_

  - [ ] 10.3 Implement mobile calendar event indicators
    - Calculate events for each day: payments, obligations, check-ins
    - Exclude students with status VACANT or VACATED
    - Exclude UNASSIGNED records (full_name LIKE 'UNASSIGNED%')
    - Display green dot for days with payments
    - Display red dot for days with overdue obligations
    - Display gold dot for days with check-ins
    - Display multiple dots when day has multiple event types
    - Highlight today's date with distinct styling
    - _Requirements: 14.1-14.9_

- [ ] 11. Implement mobile calendar day panel
  - [ ] 11.1 Create mobile day panel bottom sheet component
    - Add state for day panel: isPanelOpen, selectedDate, dayEvents
    - Create renderDayPanel function returning bottom sheet UI
    - Position bottom sheet at bottom of screen
    - Set height to 70% of screen height
    - Add drag handle at top of panel
    - Implement slide-up animation on open (CSS transition)
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 11.2 Implement day panel swipe-to-close gesture
    - Add touch event listeners: touchstart, touchmove, touchend
    - Track vertical swipe distance
    - Close panel when swipe down exceeds threshold (100px)
    - Add smooth closing animation
    - _Requirements: 15.5_

  - [ ] 11.3 Display day events in mobile day panel
    - Fetch all payments for selected date
    - Fetch all obligations for selected date
    - Fetch all check-ins for selected date
    - Display events grouped by type (Payments, Obligations, Check-ins)
    - Show student name, property, room number, amount for each event
    - Enable scrolling within day panel
    - _Requirements: 15.6, 15.7, 15.8, 15.9, 15.10_

  - [ ] 11.4 Wire day panel to calendar cell clicks
    - Add onClick handler to calendar cells
    - On cell click, set selectedDate and fetch day events
    - Open day panel with slide-up animation
    - Close day panel on backdrop click or swipe down
    - _Requirements: 15.1_

- [ ] 12. Checkpoint - Test mobile calendar
  - Test mobile calendar on device with width ≤768px
  - Verify 7-column grid with 42 cells renders correctly
  - Verify touch targets are minimum 44px × 44px
  - Verify event dots display correctly (green, red, gold)
  - Test day panel opens on cell tap
  - Test swipe-to-close gesture
  - Verify day events display correctly in panel
  - Test responsive breakpoints (mobile, tablet, desktop)
  - Ensure all tests pass, ask the user if questions arise.

### Section 5: Unassigned Student Handling

- [ ] 13. Implement UNASSIGNED record filtering and display
  - [ ] 13.1 Add UNASSIGNED record identification utility
    - Open `src/parts/p2_helpers.jsx`
    - Add isUnassignedRecord(student) function
    - Check if full_name starts with "UNASSIGNED-"
    - Return boolean
    - _Requirements: 17.1_

  - [ ] 13.2 Update student list queries to filter UNASSIGNED records
    - Open `src/services/studentService.js`
    - Add filter to student list queries: `full_name NOT LIKE 'UNASSIGNED%'`
    - Apply filter to Students view query
    - Apply filter to Finances view query
    - Apply filter to Arrears report query
    - Apply filter to all financial reports
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [ ] 13.3 Update room capacity calculations to include UNASSIGNED
    - Open `src/services/propertyService.js`
    - Update occupiedBeds calculation to include UNASSIGNED records
    - Count students where status != 'VACATED' (includes UNASSIGNED)
    - Update availableBeds calculation: bed_capacity - occupiedBeds
    - _Requirements: 18.5_

  - [ ] 13.4 Create UNASSIGNED record display component
    - Open `src/parts/p5_views.jsx` and locate room student list
    - Detect UNASSIGNED records using isUnassignedRecord helper
    - Display "Empty bed" label with grey VACANT badge
    - Add "+ Assign Student" button
    - On click, open Add Student wizard with room_id pre-filled
    - _Requirements: 17.3, 17.4, 17.5, 17.6_

  - [ ] 13.5 Update property summary view to exclude UNASSIGNED
    - Create `supabase/sprint5_property_summary_update.sql`
    - Update v_property_summary view definition
    - Add filter: `full_name NOT LIKE 'UNASSIGNED%'`
    - Exclude UNASSIGNED from active_students count
    - Exclude UNASSIGNED from expected, collected, arrears calculations
    - Exclude UNASSIGNED from overdue_count
    - _Requirements: 25.1-25.10, 18.6, 18.7, 18.8_

- [ ] 14. Checkpoint - Test UNASSIGNED handling
  - Verify UNASSIGNED records filtered from Students list
  - Verify UNASSIGNED records filtered from Finances view
  - Verify UNASSIGNED records filtered from Reports
  - Verify UNASSIGNED records display as "Empty bed" in room views
  - Verify "+ Assign Student" button pre-fills room ID
  - Verify room capacity includes UNASSIGNED in occupied count
  - Verify property summary excludes UNASSIGNED from financial totals
  - Ensure all tests pass, ask the user if questions arise.

### Section 6: Database Health Maintenance

- [ ] 15. Create database health check functions
  - [ ] 15.1 Create health check SQL functions
    - Create `supabase/sprint5_health_checks.sql`
    - Create fix_missing_checkin_dates() function
    - Find students with null check_in_date and status ACTIVE
    - Exclude UNASSIGNED records
    - Set check_in_date to created_at date
    - Return count and student IDs
    - _Requirements: 19.1-19.7_

  - [ ] 15.2 Create orphaned obligations cleanup function
    - Add cleanup_orphaned_obligations() function to health check SQL
    - Find monthly_obligations where student_id not in students table
    - Delete orphaned records
    - Return count and obligation IDs
    - _Requirements: 20.1-20.5_

  - [ ] 15.3 Create missing obligations generation function
    - Add generate_missing_obligations() function to health check SQL
    - Find active students without current month obligation
    - Exclude UNASSIGNED records
    - Create obligation with amount_due from room rent_per_bed
    - Set amount_paid to 0, status to OVERDUE
    - Set month to current month (date_trunc), due_date to first of month
    - Return count and student IDs
    - _Requirements: 21.1-21.10_

  - [ ] 15.4 Create view accuracy check function
    - Add check_view_accuracy() function to health check SQL
    - Query pg_views to get v_property_summary definition
    - Check for filter condition: `full_name NOT LIKE 'UNASSIGNED%'`
    - Return passed true/false with details
    - _Requirements: 22.1-22.5_

- [ ] 16. Create health check service and UI
  - [ ] 16.1 Create healthCheckService.js
    - Create `src/services/healthCheckService.js`
    - Implement runHealthChecks() function
    - Call all health check SQL functions
    - Aggregate results into health report
    - Calculate total issue count
    - Return complete health report with details and affected records
    - _Requirements: 23.1-23.8_

  - [ ] 16.2 Add health check panel to Settings
    - Open `src/parts/p9_settings.jsx` and locate SettingsPanel component
    - Add "Database Health" section
    - Add "Run Health Check" button
    - Display health report results: passed/failed checks, issue counts
    - Show affected records for each check
    - Add "Auto-Fix Issues" button to apply repairs
    - Display success/error messages after auto-fix
    - _Requirements: 23.1-23.8_

- [ ] 17. Checkpoint - Test database health checks
  - Run health check SQL migration on Supabase
  - Test fix_missing_checkin_dates() function
  - Test cleanup_orphaned_obligations() function
  - Test generate_missing_obligations() function
  - Test check_view_accuracy() function
  - Test health check UI in Settings panel
  - Verify auto-fix applies repairs correctly
  - Ensure all tests pass, ask the user if questions arise.

### Section 7: Frontend Query Optimization

- [ ] 18. Optimize frontend queries for performance
  - [ ] 18.1 Implement selective column queries in studentService
    - Open `src/services/studentService.js`
    - Update student list query to select only required columns
    - Select: id, full_name, phone, status, room_id, rooms(room_number, rent_per_bed)
    - Add pagination with limit 50 and offset parameters
    - Add orderBy full_name ascending
    - _Requirements: 2.1, 2.4, 2.5_

  - [ ] 18.2 Implement on-demand loading for student details
    - Update StudentProfile to load payment history on open (not on page load)
    - Load monthly_obligations on-demand when profile opens
    - Use single query with joins for student details: `*, rooms(*, properties(*)), payments(*), monthly_obligations(*)`
    - _Requirements: 1.7, 2.2_

  - [ ] 18.3 Implement property data caching in React Context
    - Open `src/parts/p1_imports_context.jsx` and locate DataProvider
    - Add property data to context state
    - Cache property information to avoid repeated fetches
    - Invalidate cache on property updates
    - _Requirements: 2.3_

- [ ] 19. Final checkpoint - Complete system test
  - Run all database migrations on Supabase
  - Verify all indexes created successfully
  - Test complete student transfer flow
  - Test inline editing for all fields (students, payments, rooms)
  - Test mobile calendar on device ≤768px
  - Test UNASSIGNED record filtering and display
  - Test database health checks and auto-fix
  - Verify query performance improvements
  - Test error boundaries with simulated errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All database migrations should be run on Supabase before testing related features
- Error boundaries ensure one component failure doesn't crash the entire application
- Student transfers are atomic transactions with full audit trails
- Inline editing uses optimistic UI updates for better user experience
- Mobile calendar has full feature parity with desktop (7-column grid, event indicators, day panel)
- UNASSIGNED records are filtered from user-facing views but counted in room capacity
- Database health checks can be run manually or scheduled for automated maintenance
- Query optimization reduces payload size by 60-70% through selective column queries
- All tasks reference specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback opportunities

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "3.1"] },
    { "id": 2, "tasks": ["3.2", "6.1"] },
    { "id": 3, "tasks": ["3.3", "3.4", "4.1", "6.2"] },
    { "id": 4, "tasks": ["4.2", "7.1", "13.1"] },
    { "id": 5, "tasks": ["4.3", "7.2", "13.2", "13.3"] },
    { "id": 6, "tasks": ["4.4", "7.3", "10.1"] },
    { "id": 7, "tasks": ["4.5", "8.1", "10.2"] },
    { "id": 8, "tasks": ["4.6", "10.3", "11.1"] },
    { "id": 9, "tasks": ["11.2", "13.4"] },
    { "id": 10, "tasks": ["11.3", "13.5", "15.1"] },
    { "id": 11, "tasks": ["11.4", "15.2"] },
    { "id": 12, "tasks": ["15.3", "15.4"] },
    { "id": 13, "tasks": ["16.1"] },
    { "id": 14, "tasks": ["16.2", "18.1"] },
    { "id": 15, "tasks": ["18.2", "18.3"] }
  ]
}
```
