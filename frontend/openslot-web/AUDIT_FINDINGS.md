# OpenSlot Web - Logic Audit Findings

## CRITICAL ISSUES

### 1. Race Condition: Hold Expiration Timer
**Location:** `App.tsx:175` - `PaymentPage` component  
**Issue:** Hold expiration timeout fires but doesn't prevent duplicate `releaseHold` API calls
```typescript
useEffect(() => { 
  if (!hold || !session) return; 
  const delay = Math.max(0, new Date(hold.expiresAtUtc).getTime() - Date.now()); 
  const timeout = window.setTimeout(() => { 
    if (!expirationReleaseSent.current) { 
      expirationReleaseSent.current = true; 
      void api.releaseHold(hold.holdId, session.accessToken).catch(() => undefined) 
    } 
  }, delay + 100); 
  return () => window.clearTimeout(timeout) 
}, [hold, session])
```
**Problem:** If user clicks "Hủy thanh toán" at the exact moment the timer expires, both `cancelPayment()` and the timer's `releaseHold()` will fire → 2 API calls for same hold

**Fix:** Check ref before ANY releaseHold call, not just in timer

---

### 2. Missing Error Boundary
**Location:** Entire app  
**Issue:** No React Error Boundary wrapping the app → unhandled component errors will crash the entire UI
**Impact:** User sees blank white screen on any render error

---

### 3. Countdown Timer Memory Leak
**Location:** `App.tsx:174` - `PaymentPage` countdown interval  
**Issue:** If component unmounts during hold, interval keeps running forever
```typescript
useEffect(() => { 
  if (!hold) return; 
  const update = () => setSecondsLeft(...); 
  update(); 
  const interval = window.setInterval(update, 1_000); 
  return () => window.clearInterval(interval) 
}, [hold])
```
**Problem:** `setSecondsLeft` called on unmounted component → React warning + memory leak

**Fix:** Add cleanup check or use ref to track mounted state

---

### 4. Geocoding Cache Corruption
**Location:** `api.ts:33-36` - `readGeocodeCache()`  
**Issue:** Malformed JSON in localStorage will return `{}` silently, losing all cached locations
```typescript
function readGeocodeCache(): Record<string, GeocodedLocation> {
  try { return JSON.parse(localStorage.getItem(geocodeCacheKey) ?? '{}') as Record<string, GeocodedLocation> }
  catch { return {} }
}
```
**Problem:** No error reporting, user loses performance benefit of cache without knowing

---

### 5. Session activeRole Not Validated on Load
**Location:** `App.tsx:57-62` - `getStoredSession()` and `saveSession()`  
**Issue:** User can manually edit localStorage to set `activeRole: "Admin"` even if they don't have Admin in `user.roles[]`
```typescript
function getStoredSession(): Session | null { 
  try { return JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Session | null } 
  catch { return null } 
}
```
**Problem:** No validation that `session.activeRole` is actually in `session.user.roles[]` when loading from storage

**Fix:** Always call `activePortalRole(session)` after reading from localStorage

---

## HIGH PRIORITY ISSUES

### 6. Missing Null Check: Slot Availability Update
**Location:** `App.tsx:176` - `PaymentPage` real-time listener  
**Issue:** If slot is null when update arrives, `setSlot(current => current ? {...} : current)` is safe, but UI doesn't re-fetch slot if it failed to load initially
**Impact:** User stuck on "Đang tải thông tin thanh toán..." forever if initial fetch fails

---

### 7. Phone Validation Insufficient
**Location:** `App.tsx:48` - `isValidPhone()` and `normalizePhone()`  
**Issue:** Accepts fake numbers like `0000000000` or `0111111111`
```typescript
const isValidPhone = (value: string) => /^0\d{9}$/.test(value)
```
**Problem:** Should validate against real Vietnamese mobile prefixes (03x, 05x, 07x, 08x, 09x)

---

### 8. Slot Filter State Not Cleared on Navigation
**Location:** `App.tsx:97-112` - `ExplorePage`  
**Issue:** `activeCategory`, `appliedKeyword`, `appliedLocation` persist when user navigates away and back
**Impact:** User returns to ExplorePage and sees stale filters from previous visit

---

### 9. Real-time Updates Trigger Infinite Loop Risk
**Location:** `App.tsx:104` and `App.tsx:272`  
**Issue:** `useSlotAvailability` callback depends on `loadSlots()` which is recreated on every filter change
```typescript
useSlotAvailability(useCallback(() => { void loadSlots() }, [loadSlots]))
```
**Problem:** If backend sends rapid updates, could trigger excessive re-renders

---

### 10. Form Submission Without Disabled State
**Location:** Multiple forms (e.g., `App.tsx:228-238` - `AuthPage`)  
**Issue:** User can double-click submit button before `loading` state updates → duplicate API requests
**Example:** Registration form doesn't disable submit button immediately on first click

---

### 11. Slot Detail Navigation State Loss
**Location:** `App.tsx:150-161` - `SlotDetailPage`  
**Issue:** Uses `location.state.slot` for instant render, but if user refreshes page, state is lost and component shows "Đang tải thông tin slot..." until fetch completes
**Impact:** Poor UX on page reload

---

### 12. Price Validation Missing
**Location:** `App.tsx:283` - `ProviderSlotForm`  
**Issue:** No validation that `dealPrice < originalPrice`
```typescript
originalPriceVnd: Number(originalPrice), 
dealPriceVnd: Number(dealPrice)
```
**Problem:** Provider can create slot where deal price is higher than original price

---

### 13. Time Zone Assumption
**Location:** `App.tsx:16-17` - `formatTime()` and `formatSlotWindow()`  
**Issue:** Hardcoded `timeZone: 'Asia/Ho_Chi_Minh'` assumes all users are in Vietnam
**Problem:** If service expands internationally, times will be wrong for users in other zones

---

## MEDIUM PRIORITY ISSUES

### 14. Image URL Validation Insufficient
**Location:** `App.tsx:375` - `ServiceForm` and `App.tsx:124-129` - `serviceImageStyle()`  
**Issue:** Only checks `https://` protocol but doesn't validate domain or prevent SSRF
```typescript
if (suppliedImage && !suppliedImage.startsWith('https://')) { 
  onError('Link ảnh cần bắt đầu bằng https:// để hiển thị an toàn.'); 
  return 
}
```
**Problem:** User can input `https://localhost/admin` or `https://internal-server/secrets`

---

### 15. Map Center Fallback Always Hanoi
**Location:** `App.tsx:146` and `App.tsx:360`  
**Issue:** Default map center `[21.0285, 105.8542]` (Hanoi) hardcoded
**Problem:** Users in HCMC or Danang see map far from their location initially

---

### 16. No Debouncing on Location Search
**Location:** `App.tsx:106` - `ExplorePage.search()`  
**Issue:** Every form submit triggers geocoding API call, but no debounce if user types and submits rapidly
**Impact:** Potential rate limiting from Nominatim OSM service

---

### 17. Booking Cancellation No Confirmation for Recent Bookings
**Location:** `App.tsx:262` - `BookingsPage.cancel()`  
**Issue:** Shows same `window.confirm()` for bookings 1 hour away vs 1 week away
```typescript
if (!window.confirm(`Hủy booking ${booking.publicCode}?`)) return;
```
**Problem:** Should warn more strongly for bookings starting soon

---

### 18. Provider Status UI Inconsistency
**Location:** `App.tsx:273-276` - `ProviderPage`  
**Issue:** When status is `2` (suspended), all buttons disabled but message says "Tạm dừng thao tác" → unclear if temporary or permanent
**UX Issue:** User doesn't know how to appeal suspension

---

### 19. No Loading State for Provider Detail Panel
**Location:** `App.tsx:409` - `AdminPage`  
**Issue:** `detailLoading` state exists but panel appears instantly empty before data loads
**UX Issue:** Flickering effect when switching between providers

---

### 20. Check-in PIN Not Validated Client-Side
**Location:** `App.tsx:379` - `CheckInPanel`  
**Issue:** No validation that PIN is exactly 6 digits before submitting
```typescript
<input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="PIN 6 số" />
```
**Problem:** User can submit empty PIN or wrong format → unnecessary API call

---

## LOW PRIORITY / POLISH ISSUES

### 21. Notification Link Handling
**Location:** `App.tsx:444` - `NotificationsPage.read()`  
**Issue:** Uses `window.location.assign()` instead of React Router navigate
**Problem:** Full page reload instead of SPA navigation

---

### 22. Service Image Hash Collision
**Location:** `App.tsx:119-123` - `defaultServiceImage()`  
**Issue:** Simple character code sum for hash → high collision rate
```typescript
const hash = [...serviceName].reduce((total, character) => total + character.charCodeAt(0), 0)
```
**Problem:** "ABC" and "CBA" get same image

---

### 23. No Retry Logic for Failed API Requests
**Location:** `api.ts:83-128` - `request()` function  
**Issue:** Single timeout at 25s, then fail → no retry for transient network errors

---

### 24. localStorage Quota Not Handled
**Location:** `api.ts:62` and `api.ts:79` - geocoding cache writes  
**Issue:** `localStorage.setItem()` can throw QuotaExceededError if storage full
**Problem:** App crashes instead of gracefully degrading

---

### 25. No Accessibility: Map Click for Venue Location
**Location:** `App.tsx:353-356` - `VenueMapClickHandler`  
**Issue:** Map picking is mouse-only, no keyboard alternative
**A11y Issue:** Users with motor disabilities can't pick location on map

---

## SUMMARY

**Critical:** 5 issues (race conditions, memory leaks, security)  
**High:** 8 issues (validation, UX blockers, data integrity)  
**Medium:** 6 issues (security, UX, performance)  
**Low:** 6 issues (polish, edge cases)

**Total:** 25 logic/runtime issues found

**Recommended next steps:**
1. Fix critical race condition in PaymentPage
2. Add React Error Boundary
3. Fix memory leak in countdown timer
4. Validate session activeRole on load
5. Add comprehensive validation for forms
6. Write unit tests for api.ts and utility functions
7. Add integration tests for booking flow
