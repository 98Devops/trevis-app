# Requirements Document

## Introduction

The Flexible Rent Cycle Engine is a comprehensive billing system for the Trevis property management application that replaces the current calendar-month billing assumption with individualized billing cycles based on each student's payment date. This system will track rent coverage periods, calculate due dates, and manage student statuses according to their actual payment dates rather than fixed monthly periods.

## Glossary

- **Trevis_System**: The property management application for student housing
- **Student**: A person who rents accommodation and makes rent payments
- **Coverage_Period**: The date range during which a student's rent payment provides accommodation
- **Payment_Date**: The date when a student makes a rent payment
- **Coverage_End_Date**: The last date covered by a student's current rent payment
- **Next_Due_Date**: The date when the next rent payment becomes due
- **Billing_Anchor_Date**: The recurring day of the month when a student's rent is due
- **Daily_Rate**: The per-day cost of accommodation calculated from monthly rent
- **Rent_Cycle_Engine**: The new system component that calculates coverage and due dates
- **Monthly_Billing_System**: The existing system that assumes all billing starts on the 1st
- **Payment_Coverage**: The number of days a payment amount covers based on daily rate
- **Status_Engine**: The component that determines if a student is current, expiring, or overdue
- **Dashboard**: The main interface showing student statuses and metrics
- **Parser**: A component that processes payment data into coverage calculations
- **Pretty_Printer**: A component that formats coverage data for display

## Requirements

### Requirement 1: Individual Billing Cycle Tracking

**User Story:** As a property manager, I want each student to have their own billing cycle based on when they pay, so that rent due dates are calculated correctly from their payment date.

#### Acceptance Criteria

1. WHEN a student makes a payment, THE Rent_Cycle_Engine SHALL set their Billing_Anchor_Date to the payment date day-of-month
2. THE Rent_Cycle_Engine SHALL calculate Coverage_End_Date as payment date plus payment coverage days
3. **THE Coverage_End_Date SHALL be the primary billing truth for all operational decisions** (system of record)
4. THE Rent_Cycle_Engine SHALL calculate Next_Due_Date as the next occurrence of Billing_Anchor_Date after Coverage_End_Date
5. WHILE a student has an active tenancy, THE Rent_Cycle_Engine SHALL maintain their individual billing schedule
6. FOR ALL students with valid payment records, THE System SHALL preserve existing payment history during migration
7. **WHEN a payment is made before Coverage_End_Date, THE Rent_Cycle_Engine SHALL extend coverage from the existing Coverage_End_Date, never discarding prepaid days**
8. **THE Rent_Cycle_Engine SHALL never allow prepaid coverage days to be lost or overwritten**

### Requirement 2: Payment Coverage Calculation

**User Story:** As a property manager, I want to calculate how many days a payment covers, so that I can determine coverage periods accurately.

#### Acceptance Criteria

1. WHEN a payment amount is received, THE Rent_Cycle_Engine SHALL calculate coverage days as payment amount divided by Daily_Rate
2. THE Rent_Cycle_Engine SHALL calculate Daily_Rate as monthly rent divided by 30 days
3. WHEN a full monthly rent is paid, THE Rent_Cycle_Engine SHALL provide exactly 30 days coverage
4. WHEN a partial payment is made, THE Rent_Cycle_Engine SHALL provide proportional coverage days
5. WHEN an overpayment is made, THE Rent_Cycle_Engine SHALL extend coverage beyond 30 days
6. FOR ALL payment calculations, rounding coverage days to whole numbers SHALL preserve accuracy within 1 day

### Requirement 3: Student Status Classification

**User Story:** As a property manager, I want to see each student's current status, so that I can identify who needs attention.

#### Acceptance Criteria

1. WHILE Coverage_End_Date is more than 7 days in the future, THE Status_Engine SHALL classify the student as Current
2. WHILE Coverage_End_Date is 1 to 7 days in the future, THE Status_Engine SHALL classify the student as Expiring Soon
3. WHEN Coverage_End_Date is in the past, THE Status_Engine SHALL classify the student as Overdue
4. THE Status_Engine SHALL calculate days remaining as Coverage_End_Date minus current date
5. THE Status_Engine SHALL calculate days overdue as current date minus Coverage_End_Date for overdue students
6. **WHEN a student status is CHECKED_OUT, THE Status_Engine SHALL exclude them from all status calculations and dashboard metrics**
7. **THE Status_Engine SHALL only process students with status ACTIVE for operational metrics**

### Requirement 4: Dashboard Integration

**User Story:** As a property manager, I want to see updated metrics on my dashboard, so that I can monitor the property status at a glance.

#### Acceptance Criteria

1. **THE Dashboard SHALL derive all metrics from Coverage_End_Date, not from calendar months**
2. THE Dashboard SHALL display current count of students in Current status
3. THE Dashboard SHALL display current count of students in Expiring Soon status
4. THE Dashboard SHALL display current count of students in Overdue status
5. **THE Dashboard SHALL exclude CHECKED_OUT students from all metric calculations**
6. WHEN viewing a student in the room list, THE Dashboard SHALL show their coverage status and days remaining
7. WHEN viewing a student profile, THE Dashboard SHALL display their Coverage_Period and Daily_Rate

### Requirement 5: Payment Recording Integration

**User Story:** As a property manager, I want to see coverage preview when recording payments, so that I can verify the payment covers the intended period.

#### Acceptance Criteria

1. WHEN entering a non-zero payment amount, THE Trevis_System SHALL display a preview showing coverage days
2. THE Trevis_System SHALL display the resulting Coverage_End_Date in the preview
3. WHEN the payment amount is within a few dollars of monthly rent, THE Trevis_System SHALL show exactly 30 days coverage
4. **WHEN payment_date is before existing Coverage_End_Date, THE Rent_Cycle_Engine SHALL extend coverage from Coverage_End_Date, preserving all prepaid days**
5. **WHEN payment_date is after existing Coverage_End_Date, THE Rent_Cycle_Engine SHALL calculate coverage from payment_date**
6. WHEN the payment is recorded, THE Rent_Cycle_Engine SHALL update the student's coverage dates
7. THE Trevis_System SHALL store the payment with associated coverage start and end dates

### Requirement 11: Early Payment and Prepaid Coverage Protection

**User Story:** As a property manager, I want early payments to extend existing coverage, so that students never lose prepaid days.

#### Acceptance Criteria

1. **WHEN a student makes a payment before their Coverage_End_Date, THE Rent_Cycle_Engine SHALL start the new coverage period on (Coverage_End_Date + 1)**
2. **THE Rent_Cycle_Engine SHALL never reset coverage from payment_date when existing coverage is still active**
3. **FOR ALL early payments, THE System SHALL preserve 100% of prepaid days**
4. WHEN showing payment preview for early payment, THE Trevis_System SHALL display: "Extends coverage from [existing_end_date] to [new_end_date]"
5. THE Rent_Cycle_Engine SHALL calculate new Coverage_End_Date as: existing_Coverage_End_Date + calculated_coverage_days
6. **THE System SHALL treat Coverage_End_Date as immutable once set, only allowing forward extension**

### Requirement 6: Arrears Management

**User Story:** As a property manager, I want to see students grouped by their payment status, so that I can prioritize collection activities.

#### Acceptance Criteria

1. THE Trevis_System SHALL display Current students in a dedicated section
2. THE Trevis_System SHALL display Expiring Soon students showing days remaining
3. THE Trevis_System SHALL display Overdue students in time-based buckets (0-30 days, 31-60 days, etc.)
4. WHEN a student's status changes, THE Trevis_System SHALL move them to the appropriate section
5. THE Trevis_System SHALL show accurate counts for each status category

### Requirement 7: Parallel System Operation

**User Story:** As a system administrator, I want the new rent cycle engine to operate alongside existing billing, so that we can verify accuracy before switching over.

#### Acceptance Criteria

1. THE Rent_Cycle_Engine SHALL calculate coverage using new logic without affecting existing Monthly_Billing_System
2. THE Trevis_System SHALL store both old and new billing calculations during transition period
3. WHILE both systems operate, THE Trevis_System SHALL use Monthly_Billing_System for student status determination
4. THE Rent_Cycle_Engine SHALL populate new database fields without modifying existing fields
5. WHEN migration is complete, THE Trevis_System SHALL switch to Rent_Cycle_Engine calculations

### Requirement 8: Data Migration Safety

**User Story:** As a system administrator, I want all existing data preserved during the migration, so that no payment or student information is lost.

#### Acceptance Criteria

1. THE Migration_Process SHALL add new database columns without dropping existing columns
2. THE Migration_Process SHALL populate new fields from existing payment and student data while keeping original records intact until migration completes
3. THE Migration_Process SHALL preserve all existing payment records exactly as stored
4. THE Migration_Process SHALL preserve all existing student records exactly as stored
5. IF migration fails, THEN THE Trevis_System SHALL rollback to previous state without data loss

### Requirement 9: Payment Data Processing

**User Story:** As a developer, I want to parse payment records into coverage calculations, so that the system can process payment history accurately.

#### Acceptance Criteria

1. WHEN payment records are processed, THE Parser SHALL extract payment date, amount, and student information
2. THE Parser SHALL validate payment data before processing coverage calculations
3. IF invalid payment data is encountered, THEN THE Parser SHALL return descriptive error messages
4. THE Pretty_Printer SHALL format coverage periods into human-readable date ranges
5. FOR ALL valid payment records, parsing then formatting then parsing SHALL produce equivalent coverage data (round-trip property)

### Requirement 10: Report Compatibility

**User Story:** As a property manager, I want existing financial reports to continue working, so that accounting processes are not disrupted.

#### Acceptance Criteria

1. THE Trevis_System SHALL continue generating monthly income reports using payment received dates
2. THE Trevis_System SHALL maintain cash-basis accounting for financial reporting
3. WHILE using rent cycle engine for operations, THE Trevis_System SHALL preserve monthly report formats
4. THE Trevis_System SHALL show individual student coverage periods in operational views
5. THE Trevis_System SHALL maintain backward compatibility with existing report queries