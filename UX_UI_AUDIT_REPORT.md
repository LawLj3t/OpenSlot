# 🎯 OpenSlot – UX/UI & Flow Audit Report
**Ngày kiểm tra:** 21/09/2026  
**Trạng thái:** Gần hoàn thành chức năng, cần polish UX/UI

---

## 📋 TỔNG QUAN

OpenSlot là marketplace cho slot sát giờ (last-minute deals) với 5 vai trò chính: **Customer, Provider, Manager, Admin, CSKH**.  
Website đã hoàn thành ~95% logic nghiệp vụ nhưng UX/UI cần cải thiện ở mặt:
- **Visual hierarchy & consistency** (typography, spacing, component styling)
- **Microinteractions & feedback** (loading states, error messages, success confirmations)
- **Form UX** (validation feedback, helper text clarity)
- **Mobile responsiveness** (tested ở desktop, mobile UX chưa optimized)

---

## 🎨 DESIGN SYSTEM HIỆN TẠI

### Color Palette (defined in `:root`)
| Mục đích | Biến | Giá trị | Ghi chú |
|---------|------|--------|--------|
| **Chính** | `--navy` | `#17233a` | Dùng cho headings, backgrounds |
| **Chính (dark)** | `--navy-dark` | `#0f172a` | Darker variant |
| **Accent** | `--coral` | `#ee7158` | Buttons, links, emphasis |
| **Accent (hover)** | `--coral-hover` | `#ff8e72` | On hover/active |
| **Text thứ cấp** | `--muted` | `#657085` | Smaller text, hints |
| **Borders** | `--line` | `#e8e7e2` | Light gray borders |
| **Gold** | `--amber` | `#ffb300` | Icons, badges, highlights |
| **Backgrounds** | `--slate-100` | `#f1f5f9` | Very light bg |
| | `--slate-200` | `#e2e8f0` | Light gray bg |

### Typography
- **Display Font:** Sora (600, 700, 800 weights)
- **Body Font:** System font stack (Inter, system-ui, sans-serif)
- **Font sizes:** clamp() cho responsive scaling
- **Line height:** 1.3–1.65 tùy context

### Spacing & Radius
- **--radius-lg:** 16px (cards, modals)
- **--radius-xl:** 24px (large sections)
- **Padding/Gap:** 8px, 12px, 14px, 18px, 24px, 32px (incremental scale)

### Shadows
- **--shadow-md:** 0 4px 12px rgba(15,23,42,0.08)
- **--shadow-lg:** 0 12px 32px rgba(15,23,42,0.12)
- **--shadow-xl:** 0 24px 64px rgba(15,23,42,0.16)

---

## 📄 CURRENT PAGES & FLOWS

### 🛍️ **CUSTOMER PORTAL**

#### 1️⃣ ExplorePage (Homepage)
**Status:** ✅ Hoàn thành  
**Visual:** Hero section với gradient backgrounds, floating badges, grid/map toggle  
**Issues:**
- [ ] Empty state cho "Chưa có slot phù hợp" cần icon rõ hơn
- [ ] Loading spinner quá nhỏ, khó nhìn trên desktop lớn
- [ ] Distance label không consistent (km vs "Vị trí hiện tại")
- [ ] Category pills scroll ngang trên mobile nhưng không có scroll indicator

**Cần cải thiện:**
- [ ] Add scroll hint (chevron hoặc fade) cho category row
- [ ] Better "no results" state với suggestions
- [ ] Hero badges animation quá nhẹ, khó nhìn

---

#### 2️⃣ SlotDetailPage
**Status:** ✅ Hoàn thành  
**Visual:** 2-column layout (image + info | booking panel)  
**Issues:**
- [ ] Booking panel không sticky khi scroll, khách phải cuộn lên để book
- [ ] "Chỗ còn" indicator chỉ có số, không có progress bar trực quan
- [ ] Details section (capacity, resources) dùng grid 3 cột nhưng chỉ 2-3 thông tin → sparse
- [ ] QR code modal không có copy button cho booking code

**Cần cải thiện:**
- [ ] Booking panel **sticky positioning** trên desktop
- [ ] Add visual progress bar: ████░░░░ (3/8 places)
- [ ] Highlight **checkin expiry time** rõ hơn (countdown hoặc warning badge)
- [ ] Add "Share" button để khách chia sẻ slot

---

#### 3️⃣ PaymentPage
**Status:** ✅ Hoàn thành (mock payment)  
**Visual:** Hold countdown timer, payment method options, QR code  
**Issues:**
- [ ] Timer chỉ format bằng text "MM:SS", không có visual urgency (red background / animation)
- [ ] "Demo payment" note nhỏ quá, không nổi bật
- [ ] Bank details grid 3 cột trên desktop nhưng text chồng lên nhau
- [ ] Confirm button disabled state không rõ (grayed out nhưng không có tooltip "tại sao disabled")

**Cần cải thiện:**
- [ ] **Red/orange countdown timer** khi < 2 phút
- [ ] Pulse animation cho timer khi sắp hết hạn
- [ ] Cleaner bank details display (2 cột trên desktop, 1 cột mobile)
- [ ] Add "Why is this disabled?" tooltip trên disabled buttons

---

#### 4️⃣ BookingsPage (Lịch của tôi)
**Status:** ✅ Hoàn thành  
**Visual:** Booking list với status pills, quick actions  
**Issues:**
- [ ] Status pills color scheme không consistent (xanh cho confirmed, vàng cho pending, ...)
- [ ] "Hủy booking" button ở mỗi row nhưng text nhỏ, dễ click sai
- [ ] Booking date box (left side) dùng coral gradient nhưng conflict với card hover effect
- [ ] No QR code / check-in info hiển thị trực tiếp, phải click vào modal

**Cần cải thiện:**
- [ ] Standardize status badge colors across all pages
- [ ] Move "Hủy" to dropdown menu (••• ) để avoid accidental clicks
- [ ] Show **QR code thumbnail** trên booking card (hover để zoom)
- [ ] Add "Check-in" button khi booking sắp tới

---

#### 5️⃣ HelpCenterPage
**Status:** ✅ Hoàn thành  
**Visual:** FAQ accordion + support ticket viewer  
**Issues:**
- [ ] FAQ items không có numbering (Q1, Q2, Q3), khó reference
- [ ] Support ticket modal mở trong main page, không phải modal overlay
- [ ] Category tabs dùng button style nhưng không rõ active state
- [ ] Search box styling không consistent với ExplorePage search

**Cần cải thiện:**
- [ ] Number FAQ items hoặc add copy-to-clipboard links
- [ ] Convert ticket viewer to modal overlay (confirm-modal-backdrop)
- [ ] Make category tabs look like proper tab component (underline active)
- [ ] Unify search box styling

---

#### 6️⃣ SupportRequestPage
**Status:** ✅ Hoàn thành  
**Visual:** Form to submit support request  
**Issues:**
- [ ] Form validation errors display at bottom, không inline
- [ ] "Category" select rỗng (no default), khách không biết chọn gì
- [ ] Success message quá nhỏ, dễ miss (không có toast notification)

**Cần cải thiện:**
- [ ] Inline validation + error tooltip trên fields
- [ ] Add **success toast notification** instead of quiet message
- [ ] Category select default to first option hoặc add "Select category" placeholder

---

### 👤 **PROVIDER PORTAL**

#### 7️⃣ ProviderPage (Quản lý slot)
**Status:** ✅ Hoàn thành  
**Visual:** Table view của slots, publish/cancel actions  
**Issues:**
- [ ] Table header bị ẩn trên mobile (display: none)
- [ ] Status badges không consistent color với BookingsPage
- [ ] "Đang thanh toán" counter (actively holding) không rõ (small text)
- [ ] Approve banner khi hồ sơ chờ duyệt nên có progress indicator (e.g., "Step 2 of 3")
- [ ] Detail modal (ProviderSlotDetailModal) quá full-width, nên capped width

**Cần cải thiện:**
- [ ] Mobile table view (card layout thay vì table)
- [ ] Standardize status badge colors
- [ ] Add **progress indicator** trên approval banner
- [ ] Modal width capped at 640px (already has maxWidth)

---

#### 8️⃣ ProviderSetupPage (Thiết lập gian hàng)
**Status:** ✅ Hoàn thành  
**Visual:** Multi-tab setup (Profile, Venues, Resources, Services)  
**Issues:**
- [ ] Tab styling dùng `.provider-tab-btn` nhưng hover state quá subtle
- [ ] Form fields dùng inconsistent padding/height (40px vs 45px)
- [ ] Map preview không show loading state khi geocoding
- [ ] "Chỗ đặt" (Resources) section form quá dense, spacing lớn
- [ ] Image upload preview nên show actual image thumbnail, not just text

**Cần cải thiện:**
- [ ] **Bold underline** cho active tab
- [ ] Standardize input heights to 40px everywhere
- [ ] Add loading spinner overlay trên map khi geocoding
- [ ] Add image preview thumbnail thay vì just filename
- [ ] Increase vertical spacing giữa form sections

---

#### 9️⃣ ProviderApplicationPage (Đăng ký cửa hàng)
**Status:** ✅ Hoàn thành  
**Visual:** 2-column (intro + form)  
**Issues:**
- [ ] Form dùng bootstrap Input styling, inconsistent với provider setup
- [ ] Success message không show, chỉ navigate đi
- [ ] Rejection banner thiếu action button để "appeal" hoặc "resubmit"

**Cần cải thiện:**
- [ ] Unify form input styling (use custom OpenSlot style)
- [ ] Show **success toast** sau submit
- [ ] Add "Resubmit" button trên rejection banner

---

### 🛠️ **MANAGER PORTAL**

#### 🔟 AdminPage (Manager tab)
**Status:** ✅ Hoàn thành  
**Visual:** Provider management table, bulk actions  
**Issues:**
- [ ] Stats cards (top of page) dùng 3 columns nhưng content không align center
- [ ] Bulk action bar (bottom) sticky nhưng positioning có conflict với footer
- [ ] Provider detail panel dùng beige background (#fffaf7) khác với page bg → cộng, khó phân biệt
- [ ] Checkbox styling Bootstrap default, không custom

**Cần cải thiện:**
- [ ] Center-align stats card content
- [ ] Bulk action bar z-index adjust để không bị footer cover
- [ ] Detail panel styling cần better visual separation (shadow hoặc border)
- [ ] Custom checkbox styling (coral accent)

---

### ⚙️ **ADMIN PORTAL**

#### 1️⃣1️⃣ AdminPage (Admin tab)
**Status:** ✅ Hoàn thành  
**Visual:** Multi-section dashboard (Users, Providers, Services, Slots, Reports)  
**Issues:**
- [ ] Filter buttons (status filter) styling inconsistent
- [ ] Table dùng 5 columns nhưng cramped trên màn hình 1080p
- [ ] Report button (_report link) text tiny (#8a6570)
- [ ] No bulk export (CSV) functionality
- [ ] Stats cards đơn độc ở top, không có context

**Cần cải thiện:**
- [ ] Filter button styling consistent (border + hover effect)
- [ ] Reduce table column count hoặc horizontal scroll
- [ ] Report link formatting (color + size)
- [ ] Add section headers ("User Management", "Provider Management", etc.)

---

### 💬 **SUPPORT PORTAL**

#### 1️⃣2️⃣ CskhPage (CSKH)
**Status:** ✅ Hoàn thành  
**Visual:** Support ticket queue, status management  
**Issues:**
- [ ] Ticket list cards styling inconsistent (no hover effect)
- [ ] Status buttons (to mark resolved/rejected) small và não positioning

**Cần cải thiện:**
- [ ] Add hover effect + subtle shadow trên ticket cards
- [ ] Action buttons properly positioned (right align)

---

### 🔐 **AUTH PAGES**

#### 1️⃣3️⃣ LoginEntryPage / AuthPage (Login & Register)
**Status:** ✅ Hoàn thành  
**Visual:** 2-column layout (pitch + form)  
**Issues:**
- [ ] Error messages text nhỏ (#8a95a4), khó thấy
- [ ] Form fields dùng outline default, inconsistent với OpenSlot branding
- [ ] "Demo login" credentials show in plain text (security concern nếu production)
- [ ] No password strength meter trên register form

**Cần cải thiện:**
- [ ] Error text color bolder + larger
- [ ] Custom form styling (navy outline focus state)
- [ ] Hide demo credentials (show button to reveal)
- [ ] Add password strength indicator

---

#### 1️⃣4️⃣ VerifyEmailPage / ForgotPasswordPage / ResetPasswordPage
**Status:** ✅ Hoàn thành nhưng minimal UI  
**Visual:** Simple form pages  
**Issues:**
- [ ] Styling inconsistent (mix of bootstrap + custom CSS)
- [ ] No progress indicator (step 1 of X)
- [ ] Success/error messages không prominent

**Cần cải thiện:**
- [ ] Unify styling across all auth flows
- [ ] Add step indicator nếu multi-step
- [ ] Toast notifications cho success/error

---

## ✅ FLOWS CHECKLIST

| # | Flow | Pages | Status | UX Issues |
|---|------|-------|--------|-----------|
| 1 | **Customer Discover & Book** | Explore → Detail → Payment → Confirmation | ✅ | • Booking panel not sticky • No urgency visual |
| 2 | **Customer Manage Bookings** | Bookings → Cancel | ✅ | • No QR preview • Confusing cancel button |
| 3 | **Customer Check-in** | Booking → Check-in (at venue) | ✅ | • PIN input validation missing |
| 4 | **Provider Setup Store** | Application → Setup → Catalog | ✅ | • Form styling inconsistent • No image preview |
| 5 | **Provider Create & Publish Slot** | Provider → Create Form → Publish | ✅ | • No slot preview before publish • Validation feedback sparse |
| 6 | **Provider Check-in Customers** | Check-in Panel → PIN entry | ✅ | • PIN validation missing |
| 7 | **Manager Approve Providers** | AdminPage → Detail Panel → Approve | ✅ | • Detail panel styling confusing |
| 8 | **Admin Manage System** | AdminPage (multi-tab) → Search/Filter | ✅ | • Too many columns cramped • No export |
| 9 | **CSKH Handle Tickets** | CskhPage → Read → Respond | ✅ | • Card styling minimal • Actions not prominent |
| 10 | **Auth Signup & Login** | Register → Verify → Login | ✅ | • Error messages not visible • Inconsistent styling |

---

## 🎯 KEY GAPS & MISSING FEATURES (UX/UI)

### Critical (Impact user experience significantly)

1. **Booking Urgency Visual**
   - ❌ No countdown animation for holds
   - ❌ Timer text-only, no color warning (red/orange when < 2min)
   - **Fix:** Add pulsing red background + color change

2. **Form Validation Feedback**
   - ❌ Errors shown at bottom, not inline
   - ❌ No helper text visible before error
   - ❌ PIN input accepts any text, no validation
   - **Fix:** Inline error tooltips + field highlighting

3. **Mobile Responsiveness**
   - ❌ Admin tables hidden entirely on mobile
   - ❌ Provider setup form not stacked
   - ❌ No mobile-optimized modals
   - **Fix:** Implement card-based layouts for mobile

4. **Sticky Booking Panel**
   - ❌ Panel scrolls off screen on detail page
   - **Fix:** `position: sticky; top: 80px;` on desktop

5. **Consistent Status Badge Colors**
   - ❌ Status colors vary across pages
   - **Fix:** Define global `.status-0`, `.status-1`, etc. classes

### High Priority (Improve usability)

6. **Success/Error Notifications**
   - ⚠️ Toast notifications missing on form submissions
   - **Fix:** Add reusable toast component + auto-dismiss

7. **Loading States**
   - ⚠️ Spinners too small, hard to see
   - ⚠️ No skeleton loaders for cards/tables
   - **Fix:** Larger spinners + skeleton UI

8. **Empty States**
   - ⚠️ Generic empty state, no helpful hints
   - **Fix:** Add category suggestions + search help

9. **QR Code Accessibility**
   - ⚠️ QR only in modal, no preview on booking card
   - **Fix:** Show QR thumbnail on card (hover to expand)

10. **Confirmation Dialogs**
    - ⚠️ Bootstrap's window.confirm() used (blocking, unstyled)
    - **Fix:** Use custom ConfirmModal component consistently

### Medium Priority (Polish & consistency)

11. **Typography Hierarchy**
    - ⚠️ Font sizes not consistent across sections
    - **Fix:** Define `.h1`, `.h2`, `.subtitle`, `.body-md`, `.body-sm` classes

12. **Spacing Consistency**
    - ⚠️ Padding/margin vary (12px, 14px, 17px, 18px, 22px, ...)
    - **Fix:** Use strict 8px grid: 8, 16, 24, 32, 40, 48px

13. **Hover & Focus States**
    - ⚠️ Not all interactive elements have hover effect
    - **Fix:** Audit all buttons/links, add consistent `:hover` styles

14. **Disabled Button Clarity**
    - ⚠️ Disabled buttons grayed out but no tooltip
    - **Fix:** Add title/aria-label explaining why disabled

15. **Image Loading**
    - ⚠️ Service images load without placeholder
    - **Fix:** Add LQIP (low-quality image placeholder) or blur-up effect

---

## 📱 RESPONSIVE DESIGN ISSUES

| Breakpoint | Issue | Fix |
|------------|-------|-----|
| **Mobile < 650px** | Admin tables hide entirely | Show card layout instead |
| | Provider setup form not stacked | Stack form to 1 column |
| | Hero search box wraps poorly | Simplify to 2 fields (service, location) |
| | Modals full viewport width | Add horizontal padding |
| **Tablet 650px-900px** | 3-column grids don't fit well | Reduce to 2 columns |
| | Sidebar content cramped | Convert to tabbed layout |
| **Desktop > 900px** | Long tables not horizontally scrollable | Add scroll container |
| | Wide modals exceed viewport | Max-width: 90vw |

---

## 🎨 PROPOSED UI IMPROVEMENTS (Priority Order)

### Phase 1: Critical UX Fixes (1-2 days)

1. **Booking Hold Countdown Timer**
   ```css
   .payment-countdown {
     font-size: 32px;
     font-weight: 800;
     color: var(--navy);
     animation: pulse-red 1s infinite;
   }
   
   @keyframes pulse-red {
     0%, 100% { color: var(--coral); }
     50% { color: #ff4444; }
   }
   ```

2. **Form Validation Inline**
   ```html
   <div class="form-group">
     <input class="form-control error" />
     <span class="form-error">Email không hợp lệ</span>
   </div>
   ```

3. **Sticky Booking Panel**
   ```css
   .booking-panel {
     position: sticky;
     top: 80px;
     align-self: start;
   }
   ```

4. **Standardized Status Badges**
   - Define `.status-pending`, `.status-confirmed`, `.status-cancelled`, etc.
   - Use across all pages

5. **Toast Notifications**
   - Create reusable `<Toast />` component
   - Auto-dismiss after 4s
   - Stack multiple toasts (bottom-right)

### Phase 2: Polish & Polish (2-3 days)

6. **Mobile-Optimized Layouts**
   - Card views for tables on mobile
   - Single-column forms
   - Bottom sheet modals

7. **Loading Skeletons**
   - Define skeleton for slot cards, booking items, tables

8. **Improved Empty States**
   - Add helpful illustrations (from unsplash or custom)
   - Suggest next action

9. **Hover & Focus States**
   - Audit all clickable elements
   - Add subtle shadow/scale on hover

10. **Image Optimization**
    - LQIP or blur-up on service images
    - Lazy loading outside viewport

### Phase 3: Advanced (3+ days)

11. **Animations & Transitions**
    - Page transitions (fade in/out)
    - Card entrance animations
    - Smooth scroll behavior

12. **Dark Mode** (Optional)
    - Define dark color palette
    - Toggle in header

13. **Accessibility Audit**
    - WCAG 2.1 AA compliance
    - Screen reader testing
    - Keyboard navigation

14. **Performance Optimization**
    - Code splitting
    - Image optimization
    - Critical CSS

---

## 💡 DESIGN TOKENS TO DEFINE

```css
/* Typography */
--font-display: 'Sora', sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
--text-h1: 36px / 800 / -1px;
--text-h2: 24px / 800 / -0.9px;
--text-h3: 18px / 800 / -0.4px;
--text-body-lg: 16px / 400 / 0;
--text-body-md: 14px / 400 / 0;
--text-body-sm: 12px / 400 / 0;
--text-caption: 11px / 400 / 0;

/* Spacing Grid (8px base) */
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;

/* Status Colors */
--color-success: #2e9760;
--color-warning: #d97706;
--color-danger: #dc2626;
--color-info: #0284c7;
--color-pending: #f59e0b;
```

---

## 📊 CHECKLIST: BEFORE "MAKING UX/UI SUPER BEAUTIFUL"

- [ ] Standardize all color usage (status badges, buttons, links)
- [ ] Define consistent spacing grid (8px increments)
- [ ] Unify form input styling across all pages
- [ ] Add loading states (spinners, skeletons)
- [ ] Implement toast notifications for feedback
- [ ] Add inline form validation + error messages
- [ ] Make booking panel sticky on detail pages
- [ ] Fix mobile responsiveness (card layouts for tables)
- [ ] Audit hover & focus states
- [ ] Add QR preview on booking cards
- [ ] Replace window.confirm() with custom modals
- [ ] Add success/error animations
- [ ] Test keyboard navigation
- [ ] Test screen reader (NVDA/JAWS)

---

## 📝 NEXT STEPS

1. **Anh Lâm review** báo cáo này để xác nhận priorities
2. **Em implement** Phase 1 (Critical fixes) - nên làm trước
3. **Em create** new design component library (if needed)
4. **Testing** responsive + accessibility
5. **Polish** animations + transitions

---

**Report by:** Droid  
**Date:** 21/09/2026  
**Status:** Ready for design improvements
