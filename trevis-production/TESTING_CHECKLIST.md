# Sprint 5 - Testing Checklist

## 🚀 Quick Start

1. **Run SQL Script First** (CRITICAL!)
   - Open Supabase Dashboard → SQL Editor
   - Copy/paste from `supabase/sprint5_fix_updated_at.sql`
   - Click "Run"
   - Verify success message: "✅ updated_at column added successfully"

2. **Open Localhost**
   - Dev server is running at: http://localhost:5173
   - Login with your credentials

---

## ✅ Testing Checklist

### Test 1: Student Inline Editing (Fix #1 + #4)
**What to test**: Student name, phone, ID editing should work without errors

**Steps**:
1. Navigate to any property
2. Click on a student to open their profile
3. Click on the student's name → Edit it → Click outside
4. ✅ **Expected**: Name updates without "updated_at" error
5. Click on phone number → Edit it → Click outside
6. ✅ **Expected**: Phone updates successfully
7. Click on ID number → Edit it → Click outside
8. ✅ **Expected**: ID updates successfully

**Status**: [ ] Pass [ ] Fail

**Notes**: _______________________________________

---

### Test 2: UNASSIGNED Records Display (Fix #2)
**What to test**: UNASSIGNED records should show as "Empty bed"

**Steps**:
1. Navigate to any property (e.g., King Fisher)
2. Expand a room that has empty beds
3. Look for records that were previously "UNASSIGNED-KF-R12"
4. ✅ **Expected**: They now show as "Empty bed" in italic/muted style
5. Try clicking on "Empty bed" record
6. ✅ **Expected**: Nothing happens (not clickable)

**Status**: [ ] Pass [ ] Fail

**Notes**: _______________________________________

---

### Test 3: Students List Clickability (Fix #3)
**What to test**: Clicking students in global Students tab should open their profile

**Steps**:
1. Click on "Students" tab in sidebar (global list)
2. Find any active student in the list
3. Click on the student row
4. ✅ **Expected**: Student profile panel slides in from right
5. Close profile and try clicking another student
6. ✅ **Expected**: Profile opens for that student
7. Try clicking on a VACANT or "Empty bed" record
8. ✅ **Expected**: Nothing happens (not clickable)

**Status**: [ ] Pass [ ] Fail

**Notes**: _______________________________________

---

### Test 4: Payment Date Inline Editing (Fix #4)
**What to test**: Payment date should be editable with date picker

**Steps**:
1. Open any student profile
2. Scroll to "Payment History" section
3. Find a payment record (e.g., "$130 paid on 15 Jan 2025")
4. As admin, click on the date "15 Jan 2025"
5. ✅ **Expected**: Date picker input appears
6. Change the date to a different date
7. Click outside the date picker
8. ✅ **Expected**: Date updates and payment recalculates for correct month
9. Verify the payment moved to the correct month group

**Status**: [ ] Pass [ ] Fail

**Notes**: _______________________________________

---

### Test 5: Transfer Modal Property Dropdown (Fix #5)
**What to test**: Property dropdown should show all available properties

**Steps**:
1. Open any student profile
2. Click "🔄 Transfer Room" button (admin only)
3. Look at Step 1: "Select Target Property"
4. ✅ **Expected**: See "Found X properties" message (where X > 0)
5. Click on the Property dropdown
6. ✅ **Expected**: See list of properties (excluding current property)
7. If dropdown is empty:
   - Open browser DevTools (F12) → Console tab
   - Look for "Fetched properties:" log
   - Check if error messages appear
   - Take screenshot and note error

**Status**: [ ] Pass [ ] Fail

**Notes**: _______________________________________

---

### Test 6: Mobile Calendar (Already Working)
**What to test**: Calendar should show full 7-column grid on mobile

**Steps**:
1. Open browser DevTools (F12)
2. Click "Toggle device toolbar" (phone icon) or press Ctrl+Shift+M
3. Select "iPhone 12 Pro" or similar mobile device
4. Navigate to "Calendar" tab
5. ✅ **Expected**: See full 7-column calendar grid (Sun-Sat)
6. Verify all days are visible
7. Try clicking on a day with payments
8. ✅ **Expected**: Day panel slides up from bottom

**Status**: [ ] Pass [ ] Fail

**Notes**: _______________________________________

---

## 🐛 If Tests Fail

### Test 1 Fails (Student Editing)
- **Check**: Did you run the SQL script?
- **Check**: Browser console for errors
- **Check**: Supabase connection status

### Test 2 Fails (UNASSIGNED Display)
- **Check**: Are there actually UNASSIGNED records in the database?
- **Check**: Browser console for errors
- **Note**: May need to refresh data

### Test 3 Fails (Students Clickability)
- **Check**: Browser console for errors
- **Check**: Is student profile panel component working?
- **Try**: Click student from property view first to verify profile works

### Test 4 Fails (Payment Date Editing)
- **Check**: Are you logged in as admin?
- **Check**: Browser console for errors
- **Check**: Date format in database (should be YYYY-MM-DD)

### Test 5 Fails (Transfer Modal)
- **Check**: Browser console for "Fetched properties:" log
- **Check**: Supabase connection
- **Check**: Properties table has `is_active` column
- **Check**: Properties exist with `is_active = true`
- **SQL Check**: `SELECT id, name, is_active FROM properties;`

### Test 6 Fails (Mobile Calendar)
- **Check**: Browser DevTools device emulation is active
- **Check**: Screen width is < 768px
- **Try**: Refresh page in mobile view

---

## 📊 Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Student Inline Editing | [ ] | |
| 2. UNASSIGNED Display | [ ] | |
| 3. Students Clickability | [ ] | |
| 4. Payment Date Editing | [ ] | |
| 5. Transfer Modal Dropdown | [ ] | |
| 6. Mobile Calendar | [ ] | |

---

## 🎯 Success Criteria

**All tests must pass** for Sprint 5 to be considered complete.

If any test fails:
1. Note the specific error in the "Notes" column
2. Check browser console for error messages
3. Take screenshots if helpful
4. Report back with specific details

---

## 📝 Additional Testing

### Cross-Browser Testing
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if available)

### Mobile Device Testing
- [ ] iOS Safari
- [ ] Android Chrome

### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] Inline editing response < 1 second
- [ ] No console errors or warnings

---

## ✅ Sign-Off

**Tester**: _______________________

**Date**: _______________________

**Overall Status**: [ ] All Pass [ ] Some Failures

**Ready for Production**: [ ] Yes [ ] No

**Notes**: 
_____________________________________________
_____________________________________________
_____________________________________________
