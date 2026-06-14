# PHASE 4B.9 - PERFORMANCE AUDIT

**Status**: 🔍 IN PROGRESS

---

## Executive Summary

### Current Architecture
- **Data Flow**: Single fetch → Build props → Distribute to components
- **Coverage Flow**: Per-component fetches on mount + refresh
- **KPI Flow**: Dashboard-only fetch on mount + refresh

### Performance Characteristics
✅ **Strengths**:
- Single `getProperties()` call at DataContext level
- Coverage fetches use `Promise.all()` for parallelization
- Proper loading states prevent flash of incorrect data
- Cancellation tokens prevent stale data overwrites

⚠️ **Issues Identified**:
1. **PropertyDetail refetches coverage** for every property switch (not cached)
2. **Dashboard refetches KPIs** on every prop change (could be cached)
3. **No request deduplication** - multiple components mounting = multiple fetches
4. **buildProps()** runs on every rawProps change (not memoized at context level)
5. **useEffect dependency arrays** cause unnecessary refetches

---

## Detailed Analysis

### 1. Data Fetching Flow (Initial Load)

```
Login
  ↓
DataProvider useEffect triggered (user changed)
  ↓
refresh() → getProperties() [SINGLE SUPABASE QUERY]
  ↓
rawProps stored in context
  ↓
AppInner useMemo → buildProps(rawProps) [COMPUTATION]
  ↓
props distributed to all views
  ↓
Dashboard useEffect → getDashboardKPIs() [SEPARATE SUPABASE QUERY]
  ↓
PropertyDetail useEffect → getStudentCoverageData() × N students [N PARALLEL QUERIES]
```

**Request Count (Cold Login)**:
- `getProperties()`: 1 query (fetches ALL students, rooms, payments)
- `getDashboardKPIs()`: 1 query (fetches students with coverage fields only)
- `getStudentCoverageData()`: N queries (where N = students in active property)

**Example with 137 students across 4 properties**:
- Dashboard view: 2 queries (properties + KPIs)
- Switch to PropertyDetail (30 students): +30 queries
- **Total**: 32 queries for one property

---

### 2. Re-render Analysis

#### Trigger: Payment Record

```
handleRecordPayment()
  ↓
recordPaymentWithCoverage() [UPDATE + REBUILD COVERAGE]
  ↓
refresh() called
  ↓
getProperties() → rawProps updated
  ↓
buildProps() recalculates (ALL properties)
  ↓
Dashboard useEffect [props] → getDashboardKPIs() [REFETCH]
  ↓
PropertyDetail useEffect [name, prop] → ALL coverage refetched [N QUERIES]
```

**Request Count (After Payment)**:
- `getProperties()`: 1 query
- `getDashboardKPIs()`: 1 query (Dashboard only)
- `getStudentCoverageData()`: N queries (if on PropertyDetail)

**Total**: 2 + N queries per refresh

---

### 3. Identified Performance Issues

#### Issue 1: PropertyDetail Coverage Refetch on Every Navigation
**Current Behavior**:
```javascript
// p5_views.jsx (PropertyDetail component)
useEffect(() => {
  async function fetchCoverage() {
    // Fetches coverage for EVERY student in property
    const coveragePromises = realStudents.map(async (student) => {
      const coverageData = await CoverageDB.getStudentCoverageData(student.id);
      // ...
    });
    await Promise.all(coveragePromises);
  }
  fetchCoverage();
}, [name, prop]); // Refetch when property changes
```

**Problem**:
- Navigate to New House (30 students) → 30 coverage queries
- Back to Dashboard → coverage discarded
- Navigate to New House again → **ANOTHER 30 coverage queries** (no cache)

**Impact**: Duplicate queries when navigating between views

**Solution**: Implement coverage cache at App level, pass down to PropertyDetail

---

#### Issue 2: Dashboard KPI Refetch on Every Props Change
**Current Behavior**:
```javascript
// p4_dashboard.jsx
useEffect(() => {
  async function fetchKPIs() {
    const kpis = await CoverageDB.getDashboardKPIs();
    setCoverageKPIs(kpis);
  }
  fetchKPIs();
}, [props]); // Refetch when ANY property changes
```

**Problem**:
- Record payment for Student A → props change → KPIs refetch
- Add room to Property B → props change → KPIs refetch
- Update student notes → props change → KPIs refetch

**Impact**: Unnecessary KPI queries when props change doesn't affect coverage

**Solution**: Only refetch KPIs when coverage-related fields change (not all props changes)

---

#### Issue 3: buildProps() Not Memoized at Context Level
**Current Behavior**:
```javascript
// App.jsx
const props = useMemo(() => {
  if (!isConfigured || rawProps.length === 0) return DEMO_PROPS;
  return buildProps(rawProps);
}, [rawProps]);
```

**Problem**:
- `buildProps()` is expensive (aggregates rooms, students, calculates totals)
- Runs on EVERY rawProps reference change
- Not cached at DataContext level → every component gets new reference

**Impact**: Unnecessary recalculations, triggers downstream useEffect hooks

**Solution**: Memoize buildProps at DataContext level, only pass transformed props

---

#### Issue 4: No Request Deduplication
**Current Behavior**:
- Dashboard mounts → fetches KPIs
- PropertyDetail mounts → fetches coverage for 30 students
- If user navigates quickly, both fetches happen simultaneously

**Problem**:
- No check for "already fetching"
- Race conditions possible (stale data overwrites newer data)
- Cancellation tokens help but don't prevent duplicate requests

**Impact**: Wasted network bandwidth, potential stale data

**Solution**: Implement request deduplication layer (SWR pattern or React Query)

---

#### Issue 5: Excessive useEffect Dependencies
**Current Behavior**:
```javascript
// Dashboard
useEffect(() => {
  fetchKPIs();
}, [props]); // Entire props object

// PropertyDetail
useEffect(() => {
  fetchCoverage();
}, [name, prop]); // Entire prop object
```

**Problem**:
- `props` and `prop` are objects → change on every rawProps update
- Even if only `notes` field changes → full refetch
- No granular dependency tracking

**Impact**: Over-fetching, unnecessary re-renders

**Solution**: Use specific dependencies (e.g., `props.map(p => p.students).flat().length`)

---

## Performance Metrics

### Before Optimization (Estimated)

**Cold Login (Dashboard View)**:
- Time: ~1-2 seconds
- Requests:
  - `getProperties()`: 1 query (500-800ms)
  - `getDashboardKPIs()`: 1 query (200-400ms)
  - **Total**: 2 queries

**Navigate to PropertyDetail (30 students)**:
- Time: ~2-3 seconds
- Requests:
  - `getStudentCoverageData()`: 30 queries (50-100ms each, parallel)
  - **Total**: 30 queries (batched in Promise.all)

**Record Payment + Refresh**:
- Time: ~2-3 seconds
- Requests:
  - `recordPaymentWithCoverage()`: 1 mutation (300-500ms)
  - `getProperties()`: 1 query (500-800ms)
  - `getDashboardKPIs()`: 1 query (200-400ms)
  - `getStudentCoverageData()`: 30 queries (if on PropertyDetail)
  - **Total**: 33 requests

**Navigate Property → Dashboard → Back to Same Property**:
- Requests:
  - First visit: 30 coverage queries
  - Back to dashboard: 0 queries (already fetched)
  - Return to property: **ANOTHER 30 coverage queries** (no cache)
  - **Total**: 60 queries for same data

---

## Optimization Plan

### Phase 1: Coverage Caching (HIGH IMPACT)
**Goal**: Eliminate duplicate coverage fetches when revisiting properties

**Implementation**:
1. Create `coverageCache` at App level (Map: studentId → coverage)
2. Pass cache to PropertyDetail
3. Only fetch if not in cache OR stale (>5 minutes)
4. Invalidate cache on refresh()

**Expected Impact**:
- Navigate New House → 30 queries
- Back to Dashboard → 0 queries
- Return to New House → **0 queries** (cached)
- **Reduction**: 50% fewer coverage queries

---

### Phase 2: KPI Query Optimization (MEDIUM IMPACT)
**Goal**: Only refetch KPIs when coverage data changes, not all props changes

**Implementation**:
1. Track coverage version (timestamp or hash)
2. Only refetch KPIs if coverage version changed
3. Alternative: Use SWR with stale-while-revalidate

**Expected Impact**:
- Record payment → KPIs refetch (valid)
- Update room notes → **No KPI refetch** (optimization)
- **Reduction**: 30-40% fewer KPI queries

---

### Phase 3: buildProps() Context Memoization (MEDIUM IMPACT)
**Goal**: Prevent unnecessary recalculations and downstream re-renders

**Implementation**:
1. Move buildProps() into DataContext
2. Memoize with useMemo([rawProps])
3. Pass transformed props from context
4. Components receive stable reference

**Expected Impact**:
- Fewer unnecessary re-renders
- Faster prop updates
- **Reduction**: 20-30% fewer recalculations

---

### Phase 4: Request Deduplication (LOW IMPACT, HIGH COMPLEXITY)
**Goal**: Prevent duplicate in-flight requests

**Implementation**:
1. Track in-flight requests (Map: key → Promise)
2. Return existing Promise if already fetching
3. Clear on completion/error

**Expected Impact**:
- Prevents race conditions
- Marginal performance improvement (edge case)
- **Reduction**: 5-10% fewer queries (fast navigation only)

---

### Phase 5: Granular Dependencies (LOW IMPACT)
**Goal**: Reduce over-fetching from coarse dependencies

**Implementation**:
1. Replace `[props]` with `[props.map(p => p.students).flat().length]`
2. Replace `[name, prop]` with `[name, prop?.students?.length]`

**Expected Impact**:
- Fewer unnecessary refetches
- **Reduction**: 10-15% fewer queries

---

## Immediate Actions (Phase 4B.9)

### Step 1: Add Performance Logging
**Goal**: Measure current baseline before optimization

**Implementation**:
```javascript
// Add to all data fetching functions
console.time('[Perf] getProperties');
const { data } = await getProperties();
console.timeEnd('[Perf] getProperties');
```

**Locations**:
- `p1_imports_context.jsx` → DataProvider refresh()
- `p4_dashboard.jsx` → Dashboard fetchKPIs()
- `p5_views.jsx` → PropertyDetail fetchCoverage()

---

### Step 2: Measure Cold Login Performance
**Goal**: Establish baseline metrics

**Test Script**:
1. Clear browser cache
2. Open DevTools Network tab
3. Login
4. Wait for Dashboard to load
5. Record:
   - Total requests count
   - Total load time
   - Request waterfall

**Baseline Target**:
- Cold login: <2 seconds
- Total requests: <10 (Dashboard view)

---

### Step 3: Measure Navigation Performance
**Goal**: Identify cache misses

**Test Script**:
1. Navigate to PropertyDetail (New House)
2. Count coverage queries
3. Back to Dashboard
4. Return to PropertyDetail (New House)
5. Count coverage queries again

**Baseline Target**:
- First visit: 30 queries (acceptable)
- Second visit: **30 queries** (ISSUE - should be 0)

---

### Step 4: Implement Coverage Cache (High Priority)
**Goal**: Eliminate 50% of coverage queries

**Implementation** (see Step 1 below)

---

## Step 1: Implement Coverage Cache

### Changes Required

#### 1. Add Cache State to App.jsx
```javascript
// App.jsx (AppInner component)
const [coverageCache, setCoverageCache] = useState(new Map()); // studentId → coverage
const [coverageCacheTimestamp, setCoverageCacheTimestamp] = useState(Date.now());

// Invalidate cache on refresh
const handleRefreshWithCacheInvalidation = useCallback(async () => {
  setCoverageCache(new Map()); // Clear cache
  setCoverageCacheTimestamp(Date.now()); // Force refetch
  await refresh();
}, [refresh]);
```

#### 2. Update PropertyDetail to Use Cache
```javascript
// p5_views.jsx (PropertyDetail component)
export function PropertyDetail({ 
  name, props, coverageCache, setCoverageCache, coverageCacheTimestamp,
  onBack, onOpenPay, onAddStudent, onAddRoom, onStudentClick, isAdmin, onExport, onRemoveRoom 
}) {
  useEffect(() => {
    let cancelled = false;
    
    async function fetchCoverage() {
      setIsLoadingCoverage(true);
      const newCoverageMap = new Map(coverageCache); // Start with cache
      
      const realStudents = prop.rooms.flatMap(r => 
        r.students.filter(s => {
          const isVacantPlaceholder = s.id && (
            String(s.id).startsWith('vacant-') || 
            s.status === 'VACANT' || 
            s.status === 'VACATED'
          );
          return !isVacantPlaceholder && s.id;
        })
      );
      
      // Only fetch students NOT in cache
      const studentsToFetch = realStudents.filter(s => !coverageCache.has(s.id));
      
      console.log(`[Phase4B.9] Coverage cache: ${coverageCache.size} cached, ${studentsToFetch.length} to fetch`);
      
      if (studentsToFetch.length > 0) {
        const coveragePromises = studentsToFetch.map(async (student) => {
          try {
            const coverageData = await CoverageDB.getStudentCoverageData(student.id);
            if (coverageData && coverageData.status === 'ACTIVE') {
              const classification = classifyStudent(coverageData);
              return { studentId: student.id, classification };
            }
          } catch (err) {
            console.error(`[Phase4B.9] Coverage fetch failed for ${student.name}:`, err.message);
          }
          return null;
        });
        
        const results = await Promise.all(coveragePromises);
        
        // Update cache with new results
        results.forEach(result => {
          if (result && !cancelled) {
            newCoverageMap.set(result.studentId, result.classification);
          }
        });
        
        // Update cache in App state
        if (!cancelled) {
          setCoverageCache(newCoverageMap);
        }
      }
      
      if (!cancelled) {
        console.log(`[Phase4B.9] Coverage hydrated: ${newCoverageMap.size} students classified`);
        setCoverageMap(newCoverageMap);
        setIsLoadingCoverage(false);
      }
    }
    
    if (prop && prop.rooms) {
      fetchCoverage();
    }
    
    return () => { cancelled = true; };
  }, [name, prop, coverageCache, setCoverageCache, coverageCacheTimestamp]); // Cache deps added
  
  // ... rest of component
}
```

#### 3. Pass Cache Props Through App.jsx
```javascript
// App.jsx
{view === "property" && selProp && (
  <ErrorBoundary componentName="PropertyDetail">
    <PropertyDetail 
      name={selProp} 
      props={visibleProps} 
      coverageCache={coverageCache}
      setCoverageCache={setCoverageCache}
      coverageCacheTimestamp={coverageCacheTimestamp}
      onBack={handleBack}
      onOpenPay={()=>{setPaymentProp(activePropObj);setShowPayment(true);}}
      onAddStudent={()=>{if(isAdmin){setAddStudentProp(selProp);setShowAddStudent(true);}}}
      onAddRoom={()=>{if(isAdmin&&activePropObj){setAddRoomPropId(activePropObj.id);setAddRoomPropName(activePropObj.name);setShowAddRoom(true);}}}
      onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}}
      onExport={handlePropertyExport}
      onRemoveRoom={handleRemoveRoom}
      isAdmin={isAdmin} 
    />
  </ErrorBoundary>
)}
```

#### 4. Update All handleRecordPayment Calls
```javascript
// App.jsx
const handleRecordPayment = async (propName, studentId, payment) => {
  if (isConfigured) {
    const { recordPaymentWithCoverage } = await import('./services/coverageDatabaseService.js');
    await recordPaymentWithCoverage({
      studentId,
      amount: payment.amount,
      paymentDate: payment.date,
      paymentMethod: payment.method,
      receiptNumber: payment.receipt,
      notes: payment.notes,
      recordedBy: user?.id
    });
    
    // Invalidate cache and refresh
    await handleRefreshWithCacheInvalidation();
  }
};
```

---

## Expected Results (After Phase 1)

### Before Cache:
```
Navigate New House → 30 coverage queries
Back to Dashboard → 0 queries
Return to New House → 30 coverage queries (DUPLICATE)
Total: 60 queries
```

### After Cache:
```
Navigate New House → 30 coverage queries (cache miss)
Back to Dashboard → 0 queries
Return to New House → 0 coverage queries (CACHE HIT ✅)
Total: 30 queries (50% reduction)
```

---

## Success Criteria

### Performance Targets
✅ Cold login under 2 seconds  
✅ No duplicate coverage fetches when revisiting same property  
✅ Dashboard KPIs refetch only on coverage changes, not all props changes  
✅ Total request count reduced by 40-50%

### Monitoring
- Add performance logging to all data fetches
- Track request counts before/after optimization
- Measure load times in DevTools Network tab

---

## Next Steps

1. ✅ Complete performance audit (this document)
2. ⏳ Add performance logging (Step 1)
3. ⏳ Measure baseline metrics (Step 2)
4. ⏳ Implement coverage cache (Step 3)
5. ⏳ Measure improvement (Step 4)
6. ⏳ Implement KPI optimization if needed (Phase 2)

---

**Phase 4B.9 Status**: AUDIT COMPLETE, READY FOR IMPLEMENTATION
