# Sprint 4 Testing Guide

## 🎯 Overview
This guide provides a comprehensive checklist for testing all Sprint 4 features before deployment.

---

## 📱 Mobile Responsive Testing

### Breakpoints to Test
- **Desktop**: 1920px, 1440px, 1024px
- **Tablet**: 768px
- **Mobile**: 480px, 375px, 320px

### Features to Verify

#### 1. Sidebar Navigation
- [ ] Hamburger menu appears on mobile (≤768px)
- [ ] Sidebar slides in from left with overlay
- [ ] Clicking overlay closes sidebar
- [ ] All navigation items visible and clickable
- [ ] Property list scrollable if many properties
- [ ] User profile section visible at bottom
- [ ] Logout button works

#### 2. Dashboard
- [ ] KPI grid: 4 columns → 2×2 (tablet) → 1 column (phone)
- [ ] Property cards: 2 columns → 1 column (mobile)
- [ ] Bar chart: vertical bars → horizontal bars (mobile)
- [ ] Attention Required table → cards (mobile)
- [ ] Quick action buttons wrap properly
- [ ] Today's date displays correctly

#### 3. Students Page
- [ ] Table → cards on mobile
- [ ] Student cards show all info (name, property, room, balance)
- [ ] Clicking student opens profile drawer
- [ ] Add Student button accessible

#### 4. Calendar Page
- [ ] Desktop: 42-cell grid (7×6) displays properly
- [ ] Mobile: vertical list of days with events
- [ ] Event dots visible (green, red, gold)
- [ ] Day panel opens on click
- [ ] Upcoming events strip scrolls horizontally (desktop)
- [ ] Upcoming events list (mobile)
- [ ] Month navigation works (prev/next/today)

#### 5. Finances Page
- [ ] Summary KPI cards: 4 columns → 2×2 → 1 column
- [ ] Aging buckets wrap properly
- [ ] Table → cards on mobile
- [ ] DateRangeFilter buttons wrap
- [ ] Property filter dropdown accessible
- [ ] Bulk actions visible when items selected

#### 6. Reports Page
- [ ] Report tabs scroll horizontally on mobile
- [ ] Tables → cards on mobile
- [ ] Export buttons full-width on mobile

#### 7. Modals & Drawers
- [ ] StudentProfile: full-width on mobile
- [ ] Settings panel: full-width on mobile
- [ ] Payment modal: full-width on mobile
- [ ] Add Student wizard: full-width on mobile
- [ ] Day panel (Calendar): bottom sheet on mobile

---

## 🎨 Feature Testing

### 1. Dashboard Property Cards (Clickable)
- [ ] Click "Arrears" metric → navigates to Finances with property filtered
- [ ] Click "Alerts" metric → navigates to Finances with property filtered
- [ ] Property filter persists when navigating to Finances
- [ ] Clicking property name still opens PropertyDetail

### 2. Bar Chart Redesign
- [ ] Expected bar: solid sky blue (#38BDF8)
- [ ] Collected bar: amber (#F59E0B)
- [ ] When 100% collected: single gold bar with ✓
- [ ] Value labels positioned above bars
- [ ] Desktop: vertical grouped bars
- [ ] Mobile: horizontal bars with labels
- [ ] Legend shows correct colors

### 3. Remove Room Feature (Admin Only)
- [ ] "Remove Room" button visible only for Admin
- [ ] Button appears in PropertyDetail room footer
- [ ] Clicking shows confirmation modal
- [ ] Modal shows student count
- [ ] Cannot remove room with active students (error toast)
- [ ] Can remove empty room (success toast)
- [ ] Page refreshes after removal
- [ ] Room disappears from list

### 4. Enhanced StudentProfile
- [ ] Opens as slide-in drawer from right
- [ ] Shows student info (name, property, room, check-in date)
- [ ] Balance card shows rent and balance
- [ ] Payment history timeline displays
- [ ] "Last paid X days ago" with color coding (green ≤30, amber 31-60, red 60+)
- [ ] Lease anniversary badge appears when within 7 days
- [ ] Edit payment button (Admin only)
- [ ] Delete payment button (Admin only) with confirmation
- [ ] Print Statement button generates PDF
- [ ] WhatsApp button opens WhatsApp with pre-filled message
- [ ] Record Payment button opens payment modal
- [ ] Remove Student button (Admin only) with confirmation

### 5. Finances Page (Renamed from Arrears)
- [ ] Navigation shows "Finances" (not "Arrears")
- [ ] Summary shows: Students, Due, Paid, Balance (with rate)
- [ ] Shows ALL students (not just those with arrears)
- [ ] Aging buckets: ALL, 0-30, 31-60, 60+ days
- [ ] Property filter dropdown works
- [ ] DateRangeFilter presets work (This Month, Last Month, etc.)
- [ ] Days column color-coded (green ≤30, amber 31-60, red 60+)
- [ ] Checkbox selection works
- [ ] Bulk actions appear when items selected
- [ ] "Record Payment" bulk action
- [ ] "Send Reminder" bulk action
- [ ] "Export Selected" downloads CSV
- [ ] Clicking student opens profile drawer

### 6. Calendar View
- [ ] Calendar appears in navigation between Students and Finances
- [ ] Icon: 📅
- [ ] 42-cell grid (6 weeks × 7 days)
- [ ] Current month displays correctly
- [ ] Today's cell has gold border
- [ ] Event dots: green (payments), red (overdue), gold (check-ins)
- [ ] Clicking day opens day panel
- [ ] Day panel shows: payments, obligations, check-ins
- [ ] "View in Finances" link works
- [ ] Upcoming events strip (next 7 days)
- [ ] Month navigation: prev, next, today buttons
- [ ] Mobile: vertical list of days with events
- [ ] Mobile: day panel as modal

### 7. Settings Panel (Admin Only)
- [ ] Gear icon (⚙️) visible in sidebar footer (Admin only)
- [ ] Clicking opens settings drawer from right
- [ ] System Settings section:
  - [ ] System name input
  - [ ] Currency symbol input
  - [ ] Country phone code input
  - [ ] Save button
- [ ] Allowed Logins section:
  - [ ] Email chips display
  - [ ] Add email input and button
  - [ ] Remove email button (except own email)
  - [ ] Cannot remove own email
- [ ] Properties section:
  - [ ] List of 4 properties
  - [ ] Editable name input
  - [ ] Color picker
  - [ ] Save button per property
- [ ] Danger Zone section:
  - [ ] Clear Monthly Snapshots button with confirmation
  - [ ] Regenerate All Obligations button with confirmation
- [ ] Close button (✕) works
- [ ] Clicking overlay closes drawer

### 8. Date Intelligence
- [ ] Dashboard: Today's date below month label
- [ ] StudentProfile: "Last paid X days ago" with color
- [ ] StudentProfile: Lease anniversary badge (within 7 days)
- [ ] Finances: Days column color-coded
- [ ] Finances: DateRangeFilter component
- [ ] Calendar: Proper date formatting

### 9. Room Financial Display
- [ ] PropertyDetail room footer shows 4 columns:
  - [ ] Expected (rent × beds)
  - [ ] Collected (sum of paid)
  - [ ] Outstanding (expected - collected)
  - [ ] Rate (percentage)
- [ ] Values color-coded (green for collected, red for outstanding)
- [ ] Monospace font for financial figures
- [ ] Remove Room button below stats (Admin only)

### 10. Students Clickable Everywhere
- [ ] Dashboard "Attention Required" table rows clickable
- [ ] Dashboard "Attention Required" mobile cards clickable
- [ ] Students page table rows clickable
- [ ] Students page mobile cards clickable
- [ ] Calendar check-ins clickable
- [ ] Finances table rows clickable
- [ ] All clicks open StudentProfile drawer

---

## 🔐 Role-Based Access Testing

### Admin User
- [ ] Can see "Remove Room" button
- [ ] Can see Settings gear icon
- [ ] Can edit payments in StudentProfile
- [ ] Can delete payments in StudentProfile
- [ ] Can remove students
- [ ] Can add students
- [ ] Can add rooms
- [ ] Can access all properties

### Manager User
- [ ] Cannot see "Remove Room" button
- [ ] Cannot see Settings gear icon
- [ ] Cannot edit payments
- [ ] Cannot delete payments
- [ ] Cannot remove students
- [ ] Cannot add students
- [ ] Cannot add rooms
- [ ] Can only see assigned property

---

## 🧪 Data Validation Testing

### 1. Remove Room
- [ ] Cannot remove room with active students
- [ ] Error message: "Cannot remove room with active students"
- [ ] Can remove room with 0 students
- [ ] Success message: "Room removed successfully"

### 2. Payment Recording
- [ ] Amount must be positive number
- [ ] Date cannot be in future
- [ ] Receipt number optional
- [ ] Notes optional
- [ ] Payment method required

### 3. Student Management
- [ ] Full name required
- [ ] Phone number format validation
- [ ] Check-in date required
- [ ] Room selection required
- [ ] Property selection required

---

## 📊 Performance Testing

### Load Times
- [ ] Dashboard loads in < 2 seconds
- [ ] Calendar loads in < 2 seconds
- [ ] Finances page loads in < 2 seconds
- [ ] StudentProfile opens in < 500ms
- [ ] Settings panel opens in < 500ms

### Smooth Animations
- [ ] Sidebar slide-in smooth
- [ ] Modal fade-in smooth
- [ ] Drawer slide-in smooth
- [ ] Bar chart animation smooth
- [ ] No layout shifts on load

---

## 🌐 Browser Testing

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Firefox Mobile (Android)

---

## 🐛 Known Issues & Limitations

### Current Limitations
1. Settings panel changes are not persisted to database (mock data)
2. Bulk payment recording shows alert (not implemented)
3. WhatsApp integration requires phone number format
4. PDF print uses browser print dialog

### Future Enhancements
1. Real-time updates with Supabase subscriptions
2. Email notifications for overdue payments
3. SMS reminders via Twilio
4. Advanced reporting with charts
5. Property-level permissions for managers

---

## ✅ Pre-Deployment Checklist

### Code Quality
- [x] All diagnostics clean (no errors)
- [x] No console errors in browser
- [x] All imports resolved
- [x] No unused variables
- [x] Proper error handling

### Database
- [ ] Run `supabase/sprint4_schema_updates.sql`
- [ ] Run `supabase/sprint4_settings_seed.sql`
- [ ] Verify `trevisdaradi@gmail.com` in allowlist
- [ ] Test with real data

### Build
- [ ] Run `npm run build`
- [ ] No build errors
- [ ] Bundle size reasonable (< 1MB)
- [ ] Test with `npm run preview`

### Environment
- [ ] Verify `.env` has correct Supabase URL
- [ ] Verify `.env` has correct Supabase anon key
- [ ] Netlify environment variables set

### Final Checks
- [ ] All features working on localhost
- [ ] Mobile responsive on all breakpoints
- [ ] Admin features restricted properly
- [ ] Manager features restricted properly
- [ ] No broken links
- [ ] No missing images

---

## 🚀 Deployment Steps

1. **Build locally**
   ```bash
   npm run build
   ```

2. **Test production build**
   ```bash
   npm run preview
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "sprint4: complete - mobile overhaul, calendar, settings, date intelligence"
   git push origin main
   ```

4. **Deploy to Netlify**
   - Netlify auto-deploys from main branch
   - Monitor build logs
   - Verify deployment success

5. **Post-deployment testing**
   - Visit live site
   - Test all features
   - Test on real mobile devices
   - Verify database connections

6. **Client handoff**
   - Share live URL
   - Provide admin credentials
   - Share SQL scripts
   - Document new features

---

## 📞 Support

If you encounter any issues during testing:
1. Check browser console for errors
2. Verify Supabase connection
3. Check network tab for failed requests
4. Review SPRINT4_STATUS.md for known issues

---

**Last Updated**: Sprint 4 Complete
**Version**: 1.0.0
**Status**: Ready for deployment ✅
