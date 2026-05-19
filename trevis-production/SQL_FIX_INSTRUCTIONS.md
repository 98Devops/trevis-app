# SQL Fix Instructions - Critical System Fixes

## ⚠️ SQL Syntax Error Fixed

The original SQL had a PostgreSQL syntax error. I've created corrected versions.

---

## 🎯 Option 1: Run Corrected Complete Script

**File**: `supabase/sprint5_critical_fixes_corrected.sql`

1. Open Supabase SQL Editor
2. Copy entire contents of `sprint5_critical_fixes_corrected.sql`
3. Paste and click "Run"
4. Should execute without errors

---

## 🎯 Option 2: Run Step-by-Step (Recommended)

**File**: `supabase/STEP_BY_STEP_FIXES.sql`

### Step 1: Fix Foreign Key Constraints
```sql
-- Copy and run this section:
ALTER TABLE student_transfers 
DROP CONSTRAINT IF EXISTS student_transfers_from_room_id_fkey;

ALTER TABLE student_transfers 
DROP CONSTRAINT IF EXISTS student_transfers_to_room_id_fkey;

ALTER TABLE student_transfers 
ADD CONSTRAINT student_transfers_from_room_id_fkey 
FOREIGN KEY (from_room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE student_transfers 
ADD CONSTRAINT student_transfers_to_room_id_fkey 
FOREIGN KEY (to_room_id) REFERENCES rooms(id) ON DELETE CASCADE;
```

### Step 2: Clean UNASSIGNED Records
```sql
-- Copy and run this section:
DELETE FROM students 
WHERE full_name LIKE 'UNASSIGNED%' 
   OR full_name LIKE '%UNASSIGNED%';
```

### Step 3: Update Transfer Function
```sql
-- Copy the entire CREATE OR REPLACE FUNCTION from STEP_BY_STEP_FIXES.sql
-- (It's too long to include here, but it's in the file)
```

### Step 4: Verify Everything Works
```sql
-- Copy and run the verification queries from STEP_BY_STEP_FIXES.sql
```

---

## ✅ What These Fixes Do

1. **Foreign Key Constraints**: Allows room deletion without breaking transfers
2. **UNASSIGNED Cleanup**: Removes ghost records for accurate bed counts
3. **Transfer Function**: Enables same-property transfers (Room 8 → Room 9)
4. **System Reliability**: Bulletproof database integrity

---

## 🧪 After Running SQL

Test these features:

1. **Same-Property Transfer**:
   - Open student in NEW HOUSE Room 8
   - Transfer to Room 9 in same property
   - Should work without errors

2. **Room Deletion**:
   - Try deleting an empty room
   - Should work without foreign key errors

3. **UNASSIGNED Records**:
   - Check Students list
   - Should show no "Empty bed" entries

---

## 🚨 If You Still Get Errors

1. **Check Supabase connection**
2. **Run step-by-step** instead of complete script
3. **Copy exact SQL** from STEP_BY_STEP_FIXES.sql
4. **Check browser console** for detailed error messages

---

## 📞 Support

If any step fails:
- Note the exact error message
- Check which step failed
- Try running individual SQL statements
- Verify table structure matches expectations

**The system will be bulletproof once these SQL fixes are applied!** 🎯