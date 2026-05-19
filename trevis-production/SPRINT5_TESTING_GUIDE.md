# Sprint 5 Testing Guide 🧪

**Server Status:** ✅ Running at http://localhost:5173/  
**Test Environment:** Local development with Supabase backend

## 🗄️ Required SQL Scripts (Run in Supabase SQL Editor)

### **CRITICAL: Run these Sprint 5 scripts in order:**

#### 1. Performance Indexes (REQUIRED)
```sql
-- File: supabase/sprint5_performance_indexes.sql
-- Purpose: Optimize database performance for production
-- Impact: Faster queries across all tables
```

#### 2. Student Transfers Table (REQUIRED)
```sql
-- File: supabase/sprint5_student_transfers.sql  
-- Purpose: Enable room transfer functionality with audit trails
-- Impact: Adds student_transfers table and execute_student_transfer function
```

### **How to Apply:**
1. Open Supabase Dashboard → SQL Editor
2. Copy content from `supabase/sprint5_performance_indexes.sql`
3. Run the script
4. Copy content from `supabase/sprint5_student_transfers.sql`
5. Run the script
6. Verify tables exist: `student_transfers` should be created

---

## 🎯 Sprint 5 Deliverables Testing Checklist

### ✅ **1. Student Transfer Between Rooms**

**Test Steps:**
1. Navigate to any property (e.g., "Eastgate Apartments")
2. Click on a student to open their profile
3. Look for **"🔄 Transfer Room"** button (Admin only)
4. Click Transfer Room → Should open 3-step modal:
   - **Step 1:** Select target property
   - **Step 2:** Select available room + add reason
   - **Step 3:** Confirm transfer details
5. Complete transfer → Should show success and refresh data
6. Check **Transfer History** section in student profile

**Expected Results:**
- ✅ Transfer button visible for admins
- ✅ Multi-step modal with property/room selection
- ✅ Available rooms show bed capacity and rent
- ✅ Transfer history displays with timestamps
- ✅ Rent changes update current month obligation

---

### ✅ **2. Full Inline Editing of All Fields**

**Test Steps:**

#### **Student Profile Fields:**
1. Open any student profile
2. **Click on student name** → Should become editable input
3. **Click on phone number** → Should become phone input
4. **Click on ID number** → Should become text input  
5. **Click on check-in date** → Should become date picker
6. **Click on notes** → Should become textarea
7. Make changes and press Enter or click away → Should save

#### **Payment Records:**
1. In student profile, find payment history
2. **Click on payment amount** → Should become number input
3. **Click on payment date** → Should become date picker
4. **Click on payment method** → Should become dropdown
5. **Click on receipt number** → Should become text input
6. **Click on notes** → Should become text input
7. Changes should save automatically on blur

**Expected Results:**
- ✅ All fields become editable on click (admin only)
- ✅ Appropriate input types (date picker, dropdown, etc.)
- ✅ Auto-save on blur with loading indicators
- ✅ Error handling with rollback on failure
- ✅ Optimistic UI updates during save

---

### ✅ **3. Mobile Calendar Identical to Desktop**

**Test Steps:**
1. Navigate to **Calendar** tab
2. **Desktop Test:** Verify full calendar grid with 7 columns
3. **Mobile Test:** 
   - Resize browser to mobile width (< 768px)
   - OR use browser dev tools mobile view
   - Calendar should maintain full 7-column grid
   - Touch targets should be 44px minimum
4. **Click on any date** → Should open day panel
5. **Mobile Day Panel:** Should slide up from bottom
6. **Swipe down** on day panel → Should close

**Expected Results:**
- ✅ Desktop: Full calendar grid visible
- ✅ Mobile: Identical grid layout (not simplified)
- ✅ Mobile: Bottom sheet day panel
- ✅ Mobile: Touch-optimized interaction
- ✅ Consistent event indicators across devices

---

### ✅ **4. UNASSIGNED Records Show as Empty Beds**

**Test Steps:**
1. Navigate to any property with rooms
2. Look for rooms with **"Empty bed"** entries
3. **Should NOT see:** Ghost students named "UNASSIGNED-room-X-Y"
4. **Should see:** "Empty bed" with "Assign Student" option
5. Check **Students** global list → Should exclude UNASSIGNED records
6. **Room capacity:** Should count UNASSIGNED as occupied for availability

**Expected Results:**
- ✅ UNASSIGNED records display as "Empty bed"
- ✅ No ghost students in listings
- ✅ Proper bed capacity calculations
- ✅ Clean student lists without UNASSIGNED entries

---

### ✅ **5. Performance Indexes Applied**

**Test Steps:**
1. **SQL Verification:** Run in Supabase SQL Editor:
```sql
-- Check if indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%sprint5%';
```

2. **Performance Test:** 
   - Navigate between properties quickly
   - Open multiple student profiles
   - Filter students by status
   - Should feel responsive

**Expected Results:**
- ✅ All Sprint 5 indexes created successfully
- ✅ Fast page loads and navigation
- ✅ Quick student profile loading
- ✅ Responsive filtering and search

---

### ✅ **6. Every Data Entry Point Available**

**Test Comprehensive Data Entry:**

#### **Student Management:**
- ✅ Add new student (multi-step wizard)
- ✅ Edit all student fields inline
- ✅ Record payments with all fields
- ✅ Transfer students between rooms
- ✅ Remove students (admin)

#### **Payment Management:**
- ✅ Record payments (amount, date, method, receipt, notes)
- ✅ Edit existing payments inline
- ✅ Delete payments (admin)
- ✅ Historical payment tracking

#### **Room Management:**
- ✅ Add new rooms
- ✅ Edit room details
- ✅ Remove empty rooms (admin)
- ✅ Capacity and rent management

**Expected Results:**
- ✅ All spreadsheet fields editable in app
- ✅ No data entry gaps
- ✅ Complete CRUD operations
- ✅ Proper validation and error handling

---

## 🔍 **Detailed Testing Scenarios**

### **Scenario 1: Complete Student Lifecycle**
1. **Add Student:** Use + Add Student button
2. **Record Payment:** Use + Record Payment  
3. **Edit Details:** Use inline editing on all fields
4. **Transfer Room:** Use Transfer Room workflow
5. **View History:** Check payment and transfer history

### **Scenario 2: Mobile Experience**
1. **Switch to mobile view** (browser dev tools)
2. **Navigate calendar** → Should work identically to desktop
3. **Use inline editing** → Should work with touch
4. **Complete transfer** → Should work on mobile

### **Scenario 3: Admin vs Regular User**
1. **Login as admin** → Should see all edit buttons
2. **Login as manager** → Should see limited editing
3. **Test permissions** → Inline editing should respect roles

---

## 🚨 **Troubleshooting**

### **If Transfer Button Missing:**
- ✅ Ensure you're logged in as admin
- ✅ Check if `student_transfers` table exists in Supabase
- ✅ Verify `execute_student_transfer` function is created

### **If Inline Editing Not Working:**
- ✅ Check browser console for errors
- ✅ Verify admin permissions
- ✅ Test with different field types

### **If Mobile Calendar Issues:**
- ✅ Clear browser cache
- ✅ Test in different browsers
- ✅ Check responsive breakpoints

---

## 📊 **Success Criteria**

**Sprint 5 is successful when:**
- ✅ All 6 deliverables function as described
- ✅ No console errors during testing
- ✅ Mobile experience matches desktop
- ✅ All data entry points work correctly
- ✅ Performance feels responsive
- ✅ Transfer workflow completes successfully

---

## 🎉 **Ready for Production**

Once all tests pass:
1. ✅ Apply SQL scripts to production Supabase
2. ✅ Deploy application build
3. ✅ Verify all functionality in production
4. ✅ Train users on new features

**Happy Testing! 🚀**