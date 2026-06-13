# Database Migration Strategy

All migrations must be additive.

Allowed:

ALTER TABLE students ADD COLUMN billing_anchor_date date;

ALTER TABLE students ADD COLUMN next_due_date date;

ALTER TABLE students ADD COLUMN coverage_end_date date;

Not Allowed:

DROP COLUMN
DROP TABLE
RENAME TABLE

Migration Process:

Step 1:
Create new fields.

Step 2:
Populate existing records.

Step 3:
Verify calculations.

Step 4:
Switch application logic.

Step 5:
Remove legacy logic only after approval.

Every migration must include:

* rollback plan
* verification query
* expected result

No destructive migrations are permitted.
