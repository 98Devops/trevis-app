# Requirements Document: Sprint 5 — Production-Ready Trevis

## Introduction

Sprint 5 transforms Trevis from a functional demo into a production-grade business tool. This document specifies requirements for six critical areas: database performance optimization, student room transfers with audit trails, comprehensive inline data editing, mobile calendar feature parity, proper handling of unassigned bed records, and database health maintenance. These requirements ensure every data entry point from the original spreadsheet exists in the app, with fast performance, reliable data handling, and full mobile parity.

## Glossary

- **System**: The Trevis student accommodation management application
- **Transfer_Service**: Backend service handling student room transfers
- **Payment_Service**: Backend service managing payment records and balance calculations
- **Calendar_Component**: Frontend component rendering calendar grid and events
- **Health_Check_Service**: Backend service performing database integrity checks
- **Database_Layer**: PostgreSQL database with Supabase
- **UNASSIGNED_Record**: Placeholder student record with full_name starting with "UNASSIGNED-"
- **Mobile_View**: Application view on devices with screen width ≤ 768px
- **Desktop_View**: Application view on devices with screen width > 768px
- **Error_Boundary**: React component that catches and handles component errors
- **Inline_Edit**: UI pattern allowing direct editing of displayed values
- **Touch_Target**: Interactive UI element with minimum 44px × 44px dimensions
- **Audit_Trail**: Historical record of data changes with timestamp and user
- **Balance_Recalculation**: Process of updating monthly_obligations based on payment changes
- **Property_Summary_View**: Database view aggregating property financial data

## Requirements

### Requirement 1: Database Performance Optimization

**User Story:** As a system administrator, I want fast database query performance, so that users experience responsive application behavior even with large datasets.

#### Acceptance Criteria

1. THE System SHALL create btree indexes on payments(student_id, month_year)
2. THE System SHALL create btree indexes on students(room_id, status)
3. THE System SHALL create btree indexes on monthly_obligations(student_id, month, status)
4. THE System SHALL create btree indexes on rooms(property_id, is_active)
5. WHEN querying student lists, THE System SHALL use selective column queries to reduce payload size by at least 60%
6. WHEN displaying lists with more than 50 items, THE System SHALL implement pagination with limit and offset
7. WHEN loading student profiles, THE System SHALL load payment history and obligations on-demand rather than with initial page load
8. WHEN executing indexed queries on tables with 1000+ records, THE System SHALL complete queries in less than 100ms

### Requirement 2: Frontend Query Optimization

**User Story:** As a user, I want the application to load quickly, so that I can access information without delays.

#### Acceptance Criteria

1. WHEN fetching student lists, THE System SHALL select only required columns (id, full_name, phone, status, room_id, rooms.room_number, rooms.rent_per_bed)
2. WHEN fetching student details, THE System SHALL include all related data (rooms, properties, payments, monthly_obligations) in a single query
3. WHEN loading property data, THE System SHALL cache property information in React Context to avoid repeated fetches
4. WHEN paginating lists, THE System SHALL use limit and offset parameters with default page size of 50 records
5. THE System SHALL order query results by relevant columns (e.g., full_name ascending for student lists)

### Requirement 3: Error Boundary Implementation

**User Story:** As a user, I want the application to remain functional when errors occur, so that one component failure doesn't crash the entire application.

#### Acceptance Criteria

1. THE System SHALL wrap Dashboard component in an error boundary
2. THE System SHALL wrap PropertyDetail component in an error boundary
3. THE System SHALL wrap Students component in an error boundary
4. THE System SHALL wrap Reports component in an error boundary
5. THE System SHALL wrap Calendar component in an error boundary
6. THE System SHALL wrap Finances component in an error boundary
7. WHEN an error boundary catches an error, THE System SHALL log the error with component name and stack trace to console
8. WHEN an error boundary catches an error, THE System SHALL display a fallback UI with component name and refresh option
9. WHEN a user clicks refresh in error boundary fallback, THE System SHALL remount the component with fresh data
10. WHEN an error occurs in one component, THE System SHALL allow other components to continue functioning normally

### Requirement 4: Student Room Transfer Service

**User Story:** As an administrator, I want to transfer students between rooms, so that I can accommodate student requests and optimize room occupancy.

#### Acceptance Criteria

1. WHEN querying available rooms, THE Transfer_Service SHALL return only rooms with available bed capacity greater than 0
2. WHEN querying available rooms, THE Transfer_Service SHALL include room details (id, roomNumber, bedCapacity, occupiedBeds, availableBeds, rentPerBed, propertyName)
3. WHEN calculating occupied beds, THE Transfer_Service SHALL count UNASSIGNED_Records as occupied beds
4. WHEN calculating occupied beds, THE Transfer_Service SHALL exclude students with status VACATED
5. WHEN executing a transfer, THE Transfer_Service SHALL validate that student status is ACTIVE
6. WHEN executing a transfer, THE Transfer_Service SHALL validate that target room has available bed capacity
7. WHEN executing a transfer, THE Transfer_Service SHALL validate that fromRoomId is different from toRoomId
8. IF target room has no available beds, THEN THE Transfer_Service SHALL return error "Target room is full"
9. IF student is not ACTIVE, THEN THE Transfer_Service SHALL return error "Student not found or inactive"
10. IF fromRoomId equals toRoomId, THEN THE Transfer_Service SHALL return error indicating same room transfer is invalid

### Requirement 5: Student Transfer Execution

**User Story:** As an administrator, I want transfer operations to be atomic and auditable, so that data integrity is maintained and changes are traceable.

#### Acceptance Criteria

1. WHEN executing a transfer, THE Transfer_Service SHALL create a record in student_transfers table with all transfer details
2. WHEN executing a transfer, THE Transfer_Service SHALL update student.room_id to the target room ID
3. WHEN executing a transfer where rent amounts differ, THE Transfer_Service SHALL update current month obligation amount_due to new rent amount
4. WHEN executing a transfer, THE Transfer_Service SHALL commit all database changes atomically in a single transaction
5. IF any transfer operation fails, THEN THE Transfer_Service SHALL rollback all changes
6. WHEN a transfer completes successfully, THE Transfer_Service SHALL return TransferResult with success true and transferId
7. WHEN a transfer fails, THE Transfer_Service SHALL return TransferResult with success false and error message
8. THE Transfer_Service SHALL record performed_by user ID in student_transfers table
9. THE Transfer_Service SHALL record transfer_date in student_transfers table
10. THE Transfer_Service SHALL enforce constraint that from_room_id and to_room_id must be different

### Requirement 6: Student Transfer UI Flow

**User Story:** As an administrator, I want an intuitive transfer interface, so that I can quickly move students between rooms.

#### Acceptance Criteria

1. WHEN viewing a student profile, THE System SHALL display a "Transfer Room" button
2. WHEN clicking "Transfer Room", THE System SHALL display a property selector dropdown showing all properties with available beds
3. WHEN selecting a property, THE System SHALL display a room selector dropdown showing rooms in that property
4. WHEN displaying room options, THE System SHALL show room number with format "Room X — Y beds free — $Z/bed"
5. WHEN selecting a room, THE System SHALL display a confirmation card showing from/to details
6. WHEN rent amounts differ between rooms, THE System SHALL display a rent change warning in confirmation card
7. WHEN confirming transfer, THE System SHALL execute the transfer and display success confirmation
8. WHEN transfer fails, THE System SHALL display error message and keep transfer modal open
9. THE System SHALL provide an optional reason field in the transfer confirmation step
10. WHEN transfer completes, THE System SHALL refresh student profile and room lists

### Requirement 7: Transfer History Display

**User Story:** As an administrator, I want to view student transfer history, so that I can track room changes over time.

#### Acceptance Criteria

1. WHEN viewing a student profile, THE System SHALL display transfer history section
2. WHEN displaying transfer history, THE System SHALL show from room number and property name
3. WHEN displaying transfer history, THE System SHALL show to room number and property name
4. WHEN displaying transfer history, THE System SHALL show transfer date
5. WHEN displaying transfer history, THE System SHALL show reason if provided
6. WHEN displaying transfer history, THE System SHALL show performed by user email
7. THE System SHALL order transfer history by transfer date descending (most recent first)

### Requirement 8: Inline Editing for Student Profile Fields

**User Story:** As an administrator, I want to edit student information directly in the profile view, so that I can quickly update details without opening separate forms.

#### Acceptance Criteria

1. THE System SHALL provide inline editing for student full_name field
2. THE System SHALL provide inline editing for student phone field
3. THE System SHALL provide inline editing for student national_id field
4. THE System SHALL provide inline editing for student emergency_contact_name field
5. THE System SHALL provide inline editing for student emergency_contact_phone field
6. THE System SHALL provide inline editing for student check_in_date field
7. THE System SHALL provide inline editing for student payment_plan field
8. THE System SHALL provide inline editing for student notes field
9. THE System SHALL provide inline editing for student status field
10. WHEN a user clicks an editable field, THE System SHALL display an input control appropriate for the field type
11. WHEN a user blurs an edited field, THE System SHALL save the new value automatically
12. WHEN saving an edited field, THE System SHALL display optimistic UI update before server confirmation
13. IF saving fails, THEN THE System SHALL revert to original value and display error message

### Requirement 9: Inline Editing for Payment Records

**User Story:** As an administrator, I want to edit payment records, so that I can correct data entry errors and update historical information.

#### Acceptance Criteria

1. THE System SHALL provide inline editing for payment payment_date field
2. THE System SHALL provide inline editing for payment amount field
3. THE System SHALL provide inline editing for payment payment_method field
4. THE System SHALL provide inline editing for payment receipt_number field
5. THE System SHALL provide inline editing for payment notes field
6. WHEN editing payment_date, THE System SHALL validate that date is not in the future
7. WHEN editing amount, THE System SHALL validate that amount is a positive number
8. WHEN editing payment_method, THE System SHALL restrict values to allowed methods (Cash, EcoCash, Bank Transfer, Zipit, Swipe)
9. WHEN payment_date changes to a different month, THE System SHALL display amber warning about historical record updates
10. WHEN payment_date changes, THE System SHALL automatically recalculate month_year field

### Requirement 10: Payment Edit Service

**User Story:** As a system, I want to maintain data consistency when payments are edited, so that financial calculations remain accurate.

#### Acceptance Criteria

1. WHEN updating a payment, THE Payment_Service SHALL validate that payment_date is not in the future
2. WHEN updating a payment, THE Payment_Service SHALL validate that amount is greater than 0
3. WHEN updating a payment, THE Payment_Service SHALL validate that payment_method is one of allowed values
4. WHEN payment_date changes, THE Payment_Service SHALL recalculate month_year as substring of payment_date (YYYY-MM format)
5. WHEN updating a payment, THE Payment_Service SHALL set updated_at to current timestamp
6. WHEN updating a payment, THE Payment_Service SHALL set edited_by to current user ID
7. WHEN payment_date or amount changes, THE Payment_Service SHALL recalculate monthly_obligations for affected months
8. WHEN monthly_obligations change, THE Payment_Service SHALL update student status based on current month obligation
9. WHEN payment update fails, THE Payment_Service SHALL rollback all changes
10. WHEN payment update succeeds, THE Payment_Service SHALL return success true

### Requirement 11: Balance Recalculation

**User Story:** As a system, I want to automatically recalculate balances when payments change, so that financial data remains accurate.

#### Acceptance Criteria

1. WHEN a payment is updated, THE System SHALL recalculate monthly_obligations for the old month_year
2. WHEN a payment is updated, THE System SHALL recalculate monthly_obligations for the new month_year if different
3. WHEN recalculating an obligation, THE System SHALL sum all payment amounts for that student and month
4. WHEN recalculating an obligation, THE System SHALL update amount_paid to the sum of payments
5. WHEN amount_paid equals or exceeds amount_due, THE System SHALL set obligation status to PAID
6. WHEN amount_paid is greater than 0 but less than amount_due, THE System SHALL set obligation status to PARTIAL
7. WHEN amount_paid is 0, THE System SHALL set obligation status to OVERDUE
8. WHEN current month obligation status is PAID, THE System SHALL set student status to PAID
9. WHEN current month obligation status is OVERDUE, THE System SHALL set student status to OVERDUE
10. WHEN current month obligation status is PARTIAL, THE System SHALL set student status to ACTIVE

### Requirement 12: Inline Editing for Room Details

**User Story:** As an administrator, I want to edit room information, so that I can update room configurations and pricing.

#### Acceptance Criteria

1. THE System SHALL provide inline editing for room room_number field (Admin only)
2. THE System SHALL provide inline editing for room bed_capacity field (Admin only)
3. THE System SHALL provide inline editing for room rent_per_bed field (Admin only)
4. THE System SHALL provide inline editing for room notes field (Admin only)
5. WHEN editing bed_capacity, THE System SHALL validate that new capacity is not less than current occupied beds
6. WHEN editing rent_per_bed, THE System SHALL validate that amount is a positive number
7. WHEN rent_per_bed changes, THE System SHALL display warning about impact on future obligations
8. THE System SHALL restrict room editing to users with admin role

### Requirement 13: Mobile Calendar Grid Rendering

**User Story:** As a mobile user, I want to view a full calendar grid, so that I can see all days and events in the month.

#### Acceptance Criteria

1. WHEN viewing calendar on mobile, THE Calendar_Component SHALL render a 7-column grid
2. WHEN rendering mobile calendar, THE Calendar_Component SHALL generate exactly 42 cells (6 weeks)
3. WHEN rendering mobile calendar, THE Calendar_Component SHALL display weekday labels (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
4. WHEN rendering mobile calendar, THE Calendar_Component SHALL display month and year label
5. WHEN rendering calendar cells, THE Calendar_Component SHALL ensure minimum touch target of 44px × 44px per cell
6. WHEN rendering calendar cells, THE Calendar_Component SHALL use cell padding of 4px on mobile
7. WHEN rendering calendar cells, THE Calendar_Component SHALL use font size of 11px on mobile
8. WHEN rendering event dots, THE Calendar_Component SHALL use dot size of 5px on mobile
9. THE Calendar_Component SHALL align first day of month to correct weekday column
10. THE Calendar_Component SHALL display empty cells for days outside current month

### Requirement 14: Mobile Calendar Event Indicators

**User Story:** As a mobile user, I want to see event indicators on calendar days, so that I can identify days with payments, obligations, or check-ins.

#### Acceptance Criteria

1. WHEN a day has payments, THE Calendar_Component SHALL display a green dot indicator
2. WHEN a day has overdue obligations, THE Calendar_Component SHALL display a red dot indicator
3. WHEN a day has check-ins, THE Calendar_Component SHALL display a gold dot indicator
4. WHEN a day has multiple event types, THE Calendar_Component SHALL display all applicable dot indicators
5. WHEN calculating events, THE Calendar_Component SHALL exclude students with status VACANT
6. WHEN calculating events, THE Calendar_Component SHALL exclude students with status VACATED
7. WHEN calculating events, THE Calendar_Component SHALL exclude UNASSIGNED_Records
8. WHEN displaying today's date, THE Calendar_Component SHALL highlight the cell with distinct styling
9. THE Calendar_Component SHALL display event indicators exactly as desktop calendar

### Requirement 15: Mobile Calendar Day Panel

**User Story:** As a mobile user, I want to view day details in a bottom sheet, so that I can see all events for a selected day.

#### Acceptance Criteria

1. WHEN a user taps a calendar day, THE Calendar_Component SHALL open a day panel as a bottom sheet
2. WHEN opening day panel, THE Calendar_Component SHALL slide up from bottom with smooth animation
3. WHEN displaying day panel, THE Calendar_Component SHALL occupy 70% of screen height
4. WHEN displaying day panel, THE Calendar_Component SHALL show a drag handle at the top
5. WHEN a user swipes down on day panel, THE Calendar_Component SHALL close the panel
6. WHEN displaying day panel, THE Calendar_Component SHALL show all payments for that day
7. WHEN displaying day panel, THE Calendar_Component SHALL show all obligations for that day
8. WHEN displaying day panel, THE Calendar_Component SHALL show all check-ins for that day
9. WHEN displaying events in day panel, THE Calendar_Component SHALL show student name, property, room, and amount
10. WHEN day panel is open, THE Calendar_Component SHALL allow scrolling within the panel

### Requirement 16: Responsive Calendar Breakpoints

**User Story:** As a user on any device, I want the calendar to adapt to my screen size, so that I have an optimal viewing experience.

#### Acceptance Criteria

1. WHEN screen width is 768px or less, THE System SHALL apply mobile calendar styles
2. WHEN screen width is between 769px and 1024px, THE System SHALL apply tablet calendar styles
3. WHEN screen width is 1025px or greater, THE System SHALL apply desktop calendar styles
4. WHEN in mobile view, THE Calendar_Component SHALL use cell min-height of 44px
5. WHEN in desktop view, THE Calendar_Component SHALL use cell min-height of 90px
6. WHEN in mobile view, THE Calendar_Component SHALL use cell padding of 4px
7. WHEN in desktop view, THE Calendar_Component SHALL use cell padding of 8px
8. WHEN in mobile view, THE Calendar_Component SHALL use font size of 11px
9. WHEN in desktop view, THE Calendar_Component SHALL use font size of 13px
10. THE System SHALL maintain 7-column grid layout across all breakpoints

### Requirement 17: UNASSIGNED Record Identification

**User Story:** As a system, I want to distinguish UNASSIGNED records from real students, so that placeholder records don't appear in user-facing views.

#### Acceptance Criteria

1. THE System SHALL identify UNASSIGNED_Records by full_name starting with "UNASSIGNED-"
2. THE System SHALL set status to VACANT for all UNASSIGNED_Records
3. WHEN displaying UNASSIGNED_Records in room views, THE System SHALL show label "Empty bed"
4. WHEN displaying UNASSIGNED_Records in room views, THE System SHALL show grey VACANT badge
5. WHEN displaying UNASSIGNED_Records in room views, THE System SHALL show "+ Assign Student" button
6. WHEN clicking "+ Assign Student", THE System SHALL pre-fill Add Student wizard with the room ID
7. THE System SHALL format UNASSIGNED_Record full_name as "UNASSIGNED-{room_id}-{bed_number}"

### Requirement 18: UNASSIGNED Record Filtering

**User Story:** As a user, I want to see only real students in lists and reports, so that placeholder records don't clutter my views.

#### Acceptance Criteria

1. WHEN querying student lists, THE System SHALL filter out records where full_name LIKE 'UNASSIGNED%'
2. WHEN displaying Finances view, THE System SHALL filter out UNASSIGNED_Records
3. WHEN generating Arrears report, THE System SHALL filter out UNASSIGNED_Records
4. WHEN generating financial reports, THE System SHALL filter out UNASSIGNED_Records
5. WHEN calculating room capacity, THE System SHALL include UNASSIGNED_Records as occupied beds
6. WHEN calculating property summary statistics, THE System SHALL exclude UNASSIGNED_Records from active student count
7. WHEN calculating property summary statistics, THE System SHALL exclude UNASSIGNED_Records from financial totals
8. THE Property_Summary_View SHALL include filter condition "full_name NOT LIKE 'UNASSIGNED%'"

### Requirement 19: Database Health Check - Missing Check-in Dates

**User Story:** As an administrator, I want to identify and fix students without check-in dates, so that historical data is complete.

#### Acceptance Criteria

1. WHEN running health check, THE Health_Check_Service SHALL identify students with null check_in_date
2. WHEN identifying students, THE Health_Check_Service SHALL filter for status ACTIVE
3. WHEN identifying students, THE Health_Check_Service SHALL exclude UNASSIGNED_Records
4. WHEN fixing missing check-in dates, THE Health_Check_Service SHALL set check_in_date to created_at date
5. WHEN health check completes, THE Health_Check_Service SHALL return count of students fixed
6. WHEN health check completes, THE Health_Check_Service SHALL return list of affected student IDs
7. IF no issues found, THEN THE Health_Check_Service SHALL return passed true with message "All active students have check-in dates"

### Requirement 20: Database Health Check - Orphaned Obligations

**User Story:** As an administrator, I want to identify and remove orphaned obligation records, so that database integrity is maintained.

#### Acceptance Criteria

1. WHEN running health check, THE Health_Check_Service SHALL identify monthly_obligations where student_id does not exist in students table
2. WHEN fixing orphaned obligations, THE Health_Check_Service SHALL delete records where student_id is invalid
3. WHEN health check completes, THE Health_Check_Service SHALL return count of records deleted
4. WHEN health check completes, THE Health_Check_Service SHALL return list of affected obligation IDs
5. IF no issues found, THEN THE Health_Check_Service SHALL return passed true with message "No orphaned obligation records found"

### Requirement 21: Database Health Check - Missing Current Month Obligations

**User Story:** As an administrator, I want to ensure all active students have current month obligations, so that financial tracking is complete.

#### Acceptance Criteria

1. WHEN running health check, THE Health_Check_Service SHALL identify active students without current month obligation record
2. WHEN identifying students, THE Health_Check_Service SHALL filter for status ACTIVE
3. WHEN identifying students, THE Health_Check_Service SHALL exclude UNASSIGNED_Records
4. WHEN fixing missing obligations, THE Health_Check_Service SHALL create obligation record with amount_due from room rent_per_bed
5. WHEN creating obligation, THE Health_Check_Service SHALL set amount_paid to 0
6. WHEN creating obligation, THE Health_Check_Service SHALL set status to OVERDUE
7. WHEN creating obligation, THE Health_Check_Service SHALL set month to current month (date_trunc)
8. WHEN creating obligation, THE Health_Check_Service SHALL set due_date to first day of current month
9. WHEN health check completes, THE Health_Check_Service SHALL return count of obligations created
10. IF no issues found, THEN THE Health_Check_Service SHALL return passed true with message "All active students have current month obligations"

### Requirement 22: Database Health Check - View Accuracy

**User Story:** As an administrator, I want to verify that database views correctly exclude UNASSIGNED records, so that summary data is accurate.

#### Acceptance Criteria

1. WHEN running health check, THE Health_Check_Service SHALL verify v_property_summary view definition
2. WHEN verifying view, THE Health_Check_Service SHALL check for filter condition "full_name NOT LIKE 'UNASSIGNED%'"
3. IF view includes correct filter, THEN THE Health_Check_Service SHALL return passed true
4. IF view missing filter, THEN THE Health_Check_Service SHALL return passed false with details about required update
5. WHEN health check completes, THE Health_Check_Service SHALL return view name in affected records if update needed

### Requirement 23: Database Health Check Execution

**User Story:** As an administrator, I want to run comprehensive health checks, so that I can identify and fix database issues.

#### Acceptance Criteria

1. WHEN executing health check, THE Health_Check_Service SHALL run all health check functions
2. WHEN executing health check, THE Health_Check_Service SHALL return a complete health report
3. WHEN generating health report, THE Health_Check_Service SHALL include results from all checks
4. WHEN generating health report, THE Health_Check_Service SHALL calculate total issue count as sum of all check issue counts
5. WHEN generating health report, THE Health_Check_Service SHALL include details array for each check
6. WHEN generating health report, THE Health_Check_Service SHALL include affected records array for each check
7. WHEN auto-fix is enabled, THE Health_Check_Service SHALL apply repairs for all fixable issues
8. WHEN auto-fix fails, THE Health_Check_Service SHALL log error and continue with remaining checks

### Requirement 24: Student Transfers Table Schema

**User Story:** As a system, I want to store transfer history in a dedicated table, so that audit trails are maintained.

#### Acceptance Criteria

1. THE Database_Layer SHALL create student_transfers table with id as primary key
2. THE Database_Layer SHALL create student_transfers table with student_id as foreign key to students(id)
3. THE Database_Layer SHALL create student_transfers table with from_room_id as foreign key to rooms(id)
4. THE Database_Layer SHALL create student_transfers table with to_room_id as foreign key to rooms(id)
5. THE Database_Layer SHALL create student_transfers table with transfer_date as date field with default CURRENT_DATE
6. THE Database_Layer SHALL create student_transfers table with reason as optional text field
7. THE Database_Layer SHALL create student_transfers table with performed_by as foreign key to auth.users(id)
8. THE Database_Layer SHALL create student_transfers table with created_at as timestamptz with default now()
9. THE Database_Layer SHALL enforce constraint that from_room_id and to_room_id must be different
10. THE Database_Layer SHALL create index on student_transfers(student_id)
11. THE Database_Layer SHALL create index on student_transfers(transfer_date)
12. THE Database_Layer SHALL cascade delete student_transfers when student is deleted

### Requirement 25: Property Summary View Update

**User Story:** As a system, I want the property summary view to exclude UNASSIGNED records, so that dashboard statistics are accurate.

#### Acceptance Criteria

1. THE Property_Summary_View SHALL filter students where full_name NOT LIKE 'UNASSIGNED%'
2. THE Property_Summary_View SHALL count active students excluding UNASSIGNED_Records
3. THE Property_Summary_View SHALL calculate expected amount excluding UNASSIGNED_Records
4. THE Property_Summary_View SHALL calculate collected amount excluding UNASSIGNED_Records
5. THE Property_Summary_View SHALL calculate arrears excluding UNASSIGNED_Records
6. THE Property_Summary_View SHALL count overdue obligations excluding UNASSIGNED_Records
7. THE Property_Summary_View SHALL join students with status ACTIVE
8. THE Property_Summary_View SHALL join rooms with is_active true
9. THE Property_Summary_View SHALL join monthly_obligations for current month only
10. THE Property_Summary_View SHALL group results by property id, name, and color_accent

### Requirement 26: Performance Index Creation

**User Story:** As a system, I want database indexes on frequently queried columns, so that query performance is optimized.

#### Acceptance Criteria

1. THE Database_Layer SHALL create index idx_payments_student_month on payments(student_id, month_year)
2. THE Database_Layer SHALL create index idx_payments_date on payments(payment_date)
3. THE Database_Layer SHALL create index idx_payments_method on payments(payment_method)
4. THE Database_Layer SHALL create index idx_students_room_status on students(room_id, status)
5. THE Database_Layer SHALL create index idx_students_status on students(status)
6. THE Database_Layer SHALL create index idx_students_checkin on students(check_in_date)
7. THE Database_Layer SHALL create index idx_obligations_student_month on monthly_obligations(student_id, month)
8. THE Database_Layer SHALL create index idx_obligations_status on monthly_obligations(status)
9. THE Database_Layer SHALL create index idx_obligations_month on monthly_obligations(month)
10. THE Database_Layer SHALL create index idx_rooms_property_active on rooms(property_id, is_active)

### Requirement 27: Error Handling for Transfer Operations

**User Story:** As a user, I want clear error messages when transfers fail, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN transfer validation fails, THE System SHALL return descriptive error message
2. WHEN target room is full, THE System SHALL return error "Target room is full (X/Y beds occupied)"
3. WHEN student is not found, THE System SHALL return error "Student not found or inactive"
4. WHEN target room is not found, THE System SHALL return error "Target room not found"
5. WHEN database transaction fails, THE System SHALL rollback all changes
6. WHEN database transaction fails, THE System SHALL return error with exception message
7. WHEN displaying transfer error, THE System SHALL show error toast with message
8. WHEN displaying transfer error, THE System SHALL keep transfer modal open with current selections
9. WHEN target room is full, THE System SHALL suggest alternative rooms with available beds

### Requirement 28: Error Handling for Payment Edits

**User Story:** As a user, I want clear warnings when editing payments, so that I understand the impact of my changes.

#### Acceptance Criteria

1. WHEN editing payment date to prior month, THE System SHALL display amber warning banner
2. WHEN displaying backdated payment warning, THE System SHALL show message "Recording payment for [Month] — historical records will update"
3. WHEN payment date is in future, THE System SHALL prevent save and display error "Payment date cannot be in future"
4. WHEN payment amount is zero or negative, THE System SHALL prevent save and display error "Amount must be positive"
5. WHEN balance recalculation fails, THE System SHALL rollback payment update
6. WHEN balance recalculation fails, THE System SHALL display error "Failed to update payment — balance recalculation error"
7. WHEN payment update fails, THE System SHALL preserve original payment data
8. WHEN payment update fails, THE System SHALL log error for admin review

### Requirement 29: Error Handling for Database Queries

**User Story:** As a user, I want graceful handling of slow or failed queries, so that I can continue working even when database issues occur.

#### Acceptance Criteria

1. WHEN query exceeds 30 second timeout, THE System SHALL cancel the query
2. WHEN query times out, THE System SHALL display error "Query took too long — try filtering or searching"
3. WHEN query times out, THE System SHALL suggest using search or property filter
4. WHEN query times out, THE System SHALL automatically apply pagination with smaller page size
5. WHEN loading large datasets, THE System SHALL display loading skeleton during query execution
6. WHEN query fails with database error, THE System SHALL display user-friendly error message
7. WHEN query fails, THE System SHALL log technical error details to console

### Requirement 30: Concurrent Edit Conflict Resolution

**User Story:** As a user, I want to be notified when my edits conflict with another user's changes, so that I can decide how to resolve the conflict.

#### Acceptance Criteria

1. WHEN updating a record, THE System SHALL use optimistic locking with updated_at timestamp
2. WHEN checking for conflicts, THE System SHALL verify updated_at matches expected value
3. IF record was modified by another user, THEN THE System SHALL return error "Record was modified by another user"
4. WHEN conflict detected, THE System SHALL fetch latest record data
5. WHEN conflict detected, THE System SHALL display diff showing current value, user's edit, and latest value
6. WHEN conflict detected, THE System SHALL ask user "Overwrite latest changes?" or "Cancel your edit"
7. IF user chooses overwrite, THEN THE System SHALL force update with new timestamp
8. IF user chooses cancel, THEN THE System SHALL discard user's changes and show latest data
