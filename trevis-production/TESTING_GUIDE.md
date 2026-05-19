# 🧪 Historical Payment Data - Testing Guide

**Server**: http://localhost:5173/  
**Status**: ✅ Running and ready for testing

---

## Quick Test Scenarios

### 🎯 Test 1: Bethel Mudavanhu - February 2026 Payment

**Steps**:
1. Open http://localhost:5173/
2. Sign in with your credentials
3. Click on **King Fisher** property card
4. Click on **Room 1**
5. Click on **Bethel Mudavanhu** student name

**Expected Result**:
- Payment History section shows **"February 2026"** header
- Under that header: **"$110 | 16 Feb 2026 | Cash"**
- Month header shows total: **"February 2026 [$110]"**

---

### 🎯 Test 2: Elizabeth Moyo - January 2024 Payment

**Steps**:
1. Navigate to **The Chase** property
2. Click on **Room 2**
3. Click on **Elizabeth Moyo** student name

**Expected Result**:
- Payment History section shows **"January 2024"** header
- Under that header: **"$130 | 01 Jan 2024"** (with payment method)
- This is the oldest payment in the system

---

### 🎯 Test 3: Backdated Payment Warning

**Steps**:
1. Click **"Record Payment"** button (top right or in property view)
2. Select any property and student
3. Enter an amount (e.g., 100)
4. Change the **Date** field to a past month (e.g., March 2026)

**Expected Result**:
- An **amber warning box** appears below the date field
- Warning text: **"⚠ Recording payment for March 2026 — historical records will update"**
- Warning disappears when you change date back to current month

---

### 🎯 Test 4: Finances Page - Month Filter

**Steps**:
1. Click **"Finances"** in the sidebar
2. Scroll down to the **Date Range** section
3. Click **"Last 3 Months"** button

**Expected Result**:
- Shows payments from **March, April, May 2026**
- Student list updates to show only students with payments in that range
- Try other filters: "This Month", "Last Month", "Last 6 Months"

---

### 🎯 Test 5: Calendar - February 2026 Historical Dots

**Steps**:
1. Click **"Calendar"** in the sidebar
2. Click **"← Prev"** button multiple times to navigate to **February 2026**
3. Look for **green dots (●)** on calendar days

**Expected Result**:
- Green payment dots appear on days with payments (e.g., 16th, 23rd, 25th, 26th)
- Click on a day with a dot
- **Day Panel** opens showing payment details for that date
- Shows student name, property, room, amount, and payment method

---

### 🎯 Test 6: Multiple Payments - Month Grouping

**Steps**:
1. Find a student with payments across multiple months
2. Click on that student to open their profile

**Expected Result**:
- Payments are **grouped by month** with headers
- Each month section shows:
  - Month name and year (e.g., "May 2026")
  - Total amount paid in that month
  - Individual payment entries with exact dates
- Months are sorted **newest first** (May 2026 before April 2026)

---

## Visual Indicators to Look For

### ✅ Payment History Grouping
```
Payment History                    Last paid 5 days ago
├─ May 2026 [$130]
│  └─ $130 | 15 May 2026 | EcoCash
├─ April 2026 [$130]
│  └─ $130 | 10 Apr 2026 | Cash
└─ February 2026 [$110]
   └─ $110 | 16 Feb 2026 | Bank Transfer

Total paid all time: $370 across 3 payments
```

### ⚠ Backdated Payment Warning
```
┌─────────────────────────────────────────────────────┐
│ ⚠ Recording payment for March 2026 — historical    │
│   records will update                               │
└─────────────────────────────────────────────────────┘
```

### 📅 Calendar Dots
- **Green dot (●)** = Payment recorded
- **Red dot (●)** = Overdue obligation
- **Gold dot (●)** = Check-in date

---

## Common Issues & Solutions

### Issue: Payment history not showing
**Solution**: 
- Check browser console for errors (F12)
- Verify you're signed in
- Refresh the page (Ctrl+R)

### Issue: Dates showing as raw ISO format
**Solution**: 
- This means `formatMonth` isn't working
- Check browser console for JavaScript errors

### Issue: Backdated warning not appearing
**Solution**:
- Make sure you're selecting a date in a **past month**, not just a past day
- Example: If today is May 17, 2026, select any date in April 2026 or earlier

### Issue: Calendar dots not showing for historical months
**Solution**:
- Verify the payment dates in the database are correct
- Check that you're navigating to the correct month
- Try refreshing the page after navigating

---

## Browser Console Commands (for debugging)

Open browser console (F12) and try these:

```javascript
// Check if formatMonth is working
console.log(new Date('2026-02-16').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
// Should output: "February 2026"

// Check current date
console.log(new Date().toISOString().split('T')[0]);
// Should output: "2026-05-17"
```

---

## After Testing

### ✅ If All Tests Pass:
1. Document any observations
2. Ready to commit and push to GitHub
3. Proceed with deployment

### ❌ If Issues Found:
1. Note the specific test that failed
2. Document the expected vs actual behavior
3. Check browser console for errors
4. Report back with details

---

## Quick Reference

**Dev Server**: http://localhost:5173/  
**Test Users**:
- admin@trevis.co.zw / admin1234
- manager@trevis.co.zw / manager1234

**Key Test Students**:
- Bethel Mudavanhu (King Fisher, Room 1) - Feb 2026 payment
- Elizabeth Moyo (The Chase, Room 2) - Jan 2024 payment

**Date Range**: January 2024 → March 2026

---

**Ready to test!** 🚀

Open http://localhost:5173/ in your browser and start with Test 1.
