# Quick Test Guide - Sprint 4

## 🚀 Server Running
**URL**: http://localhost:5173/

---

## 🎯 Quick Feature Test Checklist

### 1. Mobile Responsive (5 min)
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test breakpoints:
   - 1920px (Desktop) ✓
   - 768px (Tablet) ✓
   - 480px (Mobile) ✓
4. Check:
   - [ ] Sidebar slides in on mobile
   - [ ] KPI grid adapts (4→2×2→1 column)
   - [ ] Tables become cards
   - [ ] Charts become horizontal bars

### 2. Dashboard (3 min)
1. Check today's date displays below month
2. Click property card "Arrears" metric
   - [ ] Should navigate to Finances with property filtered
3. Click property card "Alerts" metric
   - [ ] Should navigate to Finances with property filtered
4. Check bar chart:
   - [ ] Sky blue for Expected
   - [ ] Amber for Collected
   - [ ] Gold bar with ✓ if 100%

### 3. Students Page (2 min)
1. Click any student row
   - [ ] Should open StudentProfile drawer
2. Check mobile view (≤768px)
   - [ ] Table becomes cards

### 4. Calendar Page (5 min)
1. Click "Calendar" in navigation (📅 icon)
2. Check:
   - [ ] 42-cell grid displays
   - [ ] Today's cell has gold border
   - [ ] Event dots visible (green, red, gold)
3. Click any day with events
   - [ ] Day panel opens with event details
4. Check "Upcoming" strip
   - [ ] Shows next 7 days
5. Test mobile view
   - [ ] Vertical list of days with events

### 5. Finances Page (5 min)
1. Click "Finances" in navigation
2. Check summary cards:
   - [ ] Students (total + in arrears)
   - [ ] Due
   - [ ] Paid
   - [ ] Balance (with rate)
3. Check aging buckets:
   - [ ] ALL, 0-30, 31-60, 60+ days
4. Check DateRangeFilter:
   - [ ] This Month, Last Month, etc.
5. Check Days column:
   - [ ] Color-coded (green ≤30, amber 31-60, red 60+)
6. Select students with checkboxes
   - [ ] Bulk actions appear
7. Click student row
   - [ ] Opens StudentProfile

### 6. StudentProfile (5 min)
1. Click any student to open profile
2. Check:
   - [ ] "Last paid X days ago" with color
   - [ ] Lease anniversary badge (if within 7 days)
   - [ ] Payment history timeline
   - [ ] Edit payment button (Admin only)
   - [ ] Delete payment button (Admin only)
   - [ ] Print Statement button
   - [ ] WhatsApp button
3. Test mobile view
   - [ ] Full-width drawer

### 7. Settings Panel (3 min) - Admin Only
1. Click gear icon (⚙️) in sidebar footer
2. Check sections:
   - [ ] System Settings (name, currency, phone code)
   - [ ] Allowed Logins (email chips)
   - [ ] Properties (4 properties with color pickers)
   - [ ] Danger Zone (clear snapshots, regenerate)
3. Test mobile view
   - [ ] Full-width drawer

### 8. Remove Room (2 min) - Admin Only
1. Click any property card
2. Scroll to a room
3. Click "Remove Room" button
4. Check:
   - [ ] Confirmation modal appears
   - [ ] Shows student count
   - [ ] Cannot remove if students exist (error toast)
   - [ ] Can remove if empty (success toast)

---

## 🔐 Test Accounts

### Admin Account
- Email: `tfrsuperfx@gmail.com` or `trevisdaradi@gmail.com`
- Can see all features
- Can remove rooms
- Can access Settings

### Manager Account
- Email: (any manager email)
- Limited to assigned property
- Cannot remove rooms
- Cannot access Settings

---

## 🐛 Common Issues & Fixes

### Issue: Blank white page
**Fix**: Check browser console (F12) for errors

### Issue: "Cannot read property of undefined"
**Fix**: Refresh page, check Supabase connection

### Issue: Settings not saving
**Note**: Settings panel uses mock data (not persisted to DB yet)

### Issue: Mobile view not working
**Fix**: Clear browser cache, hard refresh (Ctrl+Shift+R)

---

## 📱 Mobile Testing

### Quick Mobile Test (Chrome DevTools)
1. Press F12 to open DevTools
2. Press Ctrl+Shift+M to toggle device toolbar
3. Select device: iPhone 12 Pro or Pixel 5
4. Test all features

### Real Device Testing
1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Start server with: `npm run dev -- --host`
3. Visit: `http://YOUR_IP:5173` on mobile device
4. Test all features

---

## ✅ Quick Pass/Fail Checklist

### Must Pass
- [ ] Dashboard loads without errors
- [ ] Can navigate to all pages
- [ ] Students clickable everywhere
- [ ] Mobile responsive (768px, 480px)
- [ ] Calendar displays correctly
- [ ] Finances shows all students
- [ ] Settings panel opens (Admin only)

### Nice to Have
- [ ] Smooth animations
- [ ] No console errors
- [ ] Fast load times (< 2s)
- [ ] Touch-friendly on mobile

---

## 🚀 Next Steps After Testing

### If All Tests Pass
1. Run `npm run build`
2. Test with `npm run preview`
3. Commit and push to Git
4. Deploy to Netlify
5. Test on live site

### If Issues Found
1. Note the issue
2. Check browser console
3. Check SPRINT4_TESTING_GUIDE.md
4. Fix and re-test

---

## 📞 Quick Reference

**Dev Server**: http://localhost:5173/
**Stop Server**: Ctrl+C in terminal
**Restart Server**: `npm run dev`
**Build**: `npm run build`
**Preview Build**: `npm run preview`

---

**Last Updated**: Sprint 4 Complete
**Status**: Ready to test ✅
