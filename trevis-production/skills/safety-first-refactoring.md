# Safety First Refactoring Rules

You are modifying a production property management system.

Before making any changes:

1. Never modify more than one subsystem at a time.
2. Never rewrite existing working functionality unless explicitly required.
3. Preserve all current payment records.
4. Preserve all current student records.
5. Preserve all current reports unless instructed otherwise.
6. Create migration scripts instead of destructive schema changes.
7. Every database change must be backward compatible.
8. Every new field must allow null values initially.
9. Existing monthly billing logic must continue functioning until the new rent-cycle engine is verified.
10. Build new functionality in parallel before replacing old functionality.

Execution Order:

Phase 1:

* Schema additions only

Phase 2:

* New calculations only

Phase 3:

* New dashboard metrics

Phase 4:

* Report updates

Phase 5:

* Remove legacy code only after verification

Never combine all phases into one implementation.

If uncertain:
STOP and explain the risk before changing code.
