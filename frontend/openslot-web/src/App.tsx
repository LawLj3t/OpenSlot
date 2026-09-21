import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api } from './api'
import type { GeocodedLocation } from './api'
import { useRealtimeNotifications, useSlotAvailability, type RealtimeNotificationPayload } from './realtime'
import type { AdminCategory, AdminDashboard, AdminProviderDetail, AdminService, AdminSlot, AdminUser, Booking, BookingConfirmation, Category, DealSlot, MyProviderProfile, Notification, PortalRole, ProviderProfile, ProviderResource, ProviderService, ProviderSlot, ProviderVenue, Report, Session, SlotHold } from './types'
import { HelpCenterPage } from './HelpCenterPage'
import { SupportRequestPage } from './SupportRequestPage'
import { CskhPage } from './CskhPage'
import { OpenSlotWebChat } from './OpenSlotWebChat'
import { ConfirmModal } from './ConfirmModal'
import { ProviderSlotDetailModal } from './ProviderSlotDetailModal'
import { useToast } from './ToastContext'
import { SlotGridSkeleton, TableSkeleton } from './Skeleton'
import './App.css'
import './AuthExperience.css'
import './EmailVerification.css'

const sessionKey = 'openslot-session'
const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const formatSlotWindow = (startAtUtc: string, endAtUtc: string) => `${formatTime(startAtUtc)} – ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(endAtUtc))}`
const formatCountdown = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`
const hasRole = (session: Session | null, role: string) => session?.user.roles.includes(role) ?? false
const portalRoles: PortalRole[] = ['Customer', 'Provider', 'Manager', 'Admin', 'CSKH']
const portalLabel = (role: PortalRole) => ({ Customer: 'Khách hàng', Provider: 'Đối tác', Manager: 'Quản lý vận hành', Admin: 'Quản trị viên', CSKH: 'Chăm sóc khách hàng' })[role]
const roleLabel = (roles: string[]) => roles.includes('Admin') ? 'Quản trị viên' : roles.includes('Manager') ? 'Quản lý vận hành' : roles.includes('CSKH') ? 'Chăm sóc khách hàng' : roles.includes('Provider') ? 'Đối tác' : 'Khách hàng'
// A shop owner remains a customer too. A single login therefore starts in the
// customer experience and lets the user deliberately switch to an operational
// workspace when they need to manage their business.
const defaultPortalRole = (roles: string[]): PortalRole => roles.includes('Customer') ? 'Customer' : roles.includes('CSKH') ? 'CSKH' : roles.includes('Admin') ? 'Admin' : roles.includes('Manager') ? 'Manager' : 'Provider'
const activePortalRole = (session: Session | null): PortalRole => session?.activeRole && session.user.roles.includes(session.activeRole) ? session.activeRole : defaultPortalRole(session?.user.roles ?? ['Customer'])
const homeFor = (session: Session | null) => ({ Customer: '/', Provider: '/provider', Manager: '/manager', Admin: '/admin', CSKH: '/cskh' })[activePortalRole(session)]
const isPortalRole = (value: string | null): value is PortalRole => portalRoles.includes(value as PortalRole)
const vietnamLocations = ['Hà Nội', 'Hải Phòng', 'Huế', 'Đà Nẵng', 'Cần Thơ', 'Thành phố Hồ Chí Minh', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Lào Cai', 'Tuyên Quang', 'Cao Bằng', 'Thái Nguyên', 'Lạng Sơn', 'Quảng Ninh', 'Bắc Ninh', 'Phú Thọ', 'Ninh Bình', 'Hưng Yên', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Trị', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đắk Lắk', 'Đồng Nai', 'Tây Ninh', 'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang']
const popularServiceSearches = ['Sân cầu lông', 'Sân pickleball', 'Gội đầu dưỡng sinh', 'Làm móng nhanh', 'Bàn làm việc', 'Phòng họp nhóm', 'Studio chụp ảnh', 'Phòng podcast', 'Bàn bi-a', 'Phòng karaoke mini', 'Rửa xe máy', 'Máy giặt tự phục vụ']
const priceSuggestions = ['49000', '79000', '99000', '120000', '150000', '180000', '200000', '250000', '300000', '500000']
const capacitySuggestions = ['1', '2', '4', '6', '8', '10', '20']
const venueNameSuggestions = ['Sân cầu lông ABC', 'Salon Minh Anh', 'Coffee Study', 'Campus Court', 'Glow Studio', 'Focus Hub']
const addressSuggestions = ['Trần Duy Hưng, Hà Nội', 'Nguyễn Chí Thanh, Hà Nội', 'Cầu Giấy, Hà Nội', 'Đống Đa, Hà Nội', 'Hai Bà Trưng, Hà Nội']
const descriptionSuggestions = ['Ưu đãi cho khung giờ còn trống trong ngày', 'Không gian sạch sẽ, đầy đủ tiện nghi', 'Phù hợp cho khách đặt lịch sát giờ']
// An image belongs to a service, then every slot for that service inherits it.
// These cover newly-created services before a shop owner supplies their own photo.
const serviceImageDefaults: Record<string, string[]> = {
  sports: ['https://images.unsplash.com/photo-1775993167284-8e6a6e56ab69?auto=format&fit=crop&fm=jpg&q=80&w=1200', 'https://images.unsplash.com/photo-1761644707612-adf8354c7576?auto=format&fit=crop&fm=jpg&q=80&w=1200'],
  beauty: ['https://images.unsplash.com/photo-1781450090585-1a511b7066d9?auto=format&fit=crop&fm=jpg&q=80&w=1200', 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&fm=jpg&q=80&w=1200'],
  workspace: ['https://images.unsplash.com/photo-1772723822651-d2161754d61b?auto=format&fit=crop&fm=jpg&q=80&w=1200', 'https://images.unsplash.com/photo-1572025442811-aa5146a780fb?auto=format&fit=crop&fm=jpg&q=80&w=1200'],
  creative: ['https://images.unsplash.com/photo-1786325492091-899010c3e228?auto=format&fit=crop&fm=jpg&q=80&w=1200', 'https://images.unsplash.com/photo-1782274265689-4f10a91d4abb?auto=format&fit=crop&fm=jpg&q=80&w=1200'],
  entertainment: ['https://images.unsplash.com/photo-1704040686294-9c1878cf5c7d?auto=format&fit=crop&fm=jpg&q=80&w=1200', 'https://images.unsplash.com/photo-1786376461576-bc24acdd9a24?auto=format&fit=crop&fm=jpg&q=80&w=1200'],
  utilities: ['https://images.unsplash.com/photo-1782235869446-d8c52303554d?auto=format&fit=crop&fm=jpg&q=80&w=1200', 'https://images.unsplash.com/photo-1760788780087-a723989f93dc?auto=format&fit=crop&fm=jpg&q=80&w=1200'],
}
const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 10)
const isValidPhone = (value: string) => /^0[3|5|7|8|9]\d{8}$/.test(value)
const isValidGmail = (value: string) => /^[^\s@]+@gmail\.com$/i.test(value.trim())
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('vi-VN').trim()
const filterSuggestions = (items: string[], query: string, limit = 8) => {
  const normalizedQuery = normalizeSearch(query)
  if (!normalizedQuery) return []
  return [...new Set(items)].filter((item) => normalizeSearch(item).startsWith(normalizedQuery)).slice(0, limit)
}

function getStoredSession(): Session | null {
  try {
    const stored = JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Session | null
    if (!stored) return null
    const validRole = activePortalRole(stored)
    return { ...stored, activeRole: validRole }
  } catch { return null }
}

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(getStoredSession)
  const [unreadCount, setUnreadCount] = useState(0)
  const [realtimeToast, setRealtimeToast] = useState<RealtimeNotificationPayload | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  const saveSession = (next: Session | null) => { const normalized = next ? { ...next, activeRole: activePortalRole(next) } : null; setSession(normalized); if (normalized) localStorage.setItem(sessionKey, JSON.stringify(normalized)); else localStorage.removeItem(sessionKey) }
  const switchPortal = (role: PortalRole) => {
    if (!session?.user.roles.includes(role)) return
    const next = { ...session, activeRole: role }
    saveSession(next)
    navigate(homeFor(next))
  }
  const activeRole = activePortalRole(session); const isProvider = hasRole(session, 'Provider')

  const checkUnread = useCallback(() => {
    if (!session?.accessToken) {
      setUnreadCount(0)
      return
    }
    api.notifications(session.accessToken)
      .then((items) => setUnreadCount(items.filter((x) => !x.isRead).length))
      .catch(() => {})
  }, [session])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- notification count loaded from external request lifecycle
    checkUnread()
  }, [checkUnread])

  useRealtimeNotifications(session?.user.id, useCallback((payload) => {
    setUnreadCount((prev) => prev + 1)
    setRealtimeToast(payload)
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setRealtimeToast(null)
    }, 7000)
  }, []))

  return <>
    <header className="site-header">
      <NavLink to="/" className="brand" aria-label="OpenSlot - Trang chủ"><span className="brand-mark"><i className="bi bi-plus-lg" /></span><span className="brand-open">Open</span><span>Slot</span></NavLink>
      <nav className="main-nav">{!session ? <NavLink to="/" end>Khám phá</NavLink> : <>{activeRole === 'Customer' && <><NavLink to="/" end>Khám phá</NavLink><NavLink to="/bookings">Lịch của tôi</NavLink>{isProvider ? <NavLink to="/provider" onClick={(event) => { event.preventDefault(); switchPortal('Provider') }}>Khu vực đối tác</NavLink> : <NavLink to="/provider-application">Đăng ký cửa hàng</NavLink>}</>}{activeRole === 'Provider' && <><NavLink to="/" onClick={(event) => { event.preventDefault(); switchPortal('Customer') }}>Khám phá & đặt chỗ</NavLink><NavLink to="/provider" end>Quản lý slot</NavLink><NavLink to="/provider/setup">Thiết lập gian hàng</NavLink></>}{activeRole === 'Manager' && <NavLink to="/manager">Vận hành nền tảng</NavLink>}{activeRole === 'Admin' && <NavLink to="/admin">Quản trị hệ thống</NavLink>}{activeRole === 'CSKH' && <NavLink to="/cskh">Xử lý yêu cầu hỗ trợ (CSKH)</NavLink>}</>}</nav>
      <div className="user-actions">
        <NavLink to="/help" className="help-header-link" aria-label="Trung tâm hỗ trợ">
          <i className="bi bi-question-circle" />
          <span>Hỗ Trợ</span>
        </NavLink>
        {session ? <><NavLink to="/notifications" className="notification-link" aria-label="Thông báo"><i className="bi bi-bell" />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}</NavLink><span className="user-label"><b>{session.user.displayName}</b>{session.user.roles.filter((role) => isPortalRole(role)).length > 1 ? <select aria-label="Chuyển khu vực sử dụng" value={activeRole} onChange={(event) => switchPortal(event.target.value as PortalRole)}>{session.user.roles.filter(isPortalRole).map((role) => <option key={role} value={role}>{portalLabel(role)}</option>)}</select> : <small>{portalLabel(activeRole)}</small>}</span><button className="btn btn-link text-decoration-none" onClick={() => saveSession(null)}>Đăng xuất</button></> : <><NavLink className="btn btn-link text-decoration-none" to="/login">Đăng nhập</NavLink><NavLink className="btn btn-primary rounded-pill px-4" to="/register">Tạo tài khoản</NavLink></>}
      </div>
    </header>
    <main><Routes>
      <Route path="/" element={activeRole === 'Customer' ? <ExplorePage /> : <Navigate to={homeFor(session)} replace />} />
      <Route path="/slots/:slotId" element={<SlotDetailPage session={session} />} />
      <Route path="/payment/:slotId" element={<PaymentPage session={session} />} />
      <Route path="/login" element={<LoginEntryPage onAuthenticated={saveSession} />} />
      <Route path="/register" element={<AuthPage mode="register" onAuthenticated={saveSession} />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/bookings" element={hasRole(session, 'Customer') && activeRole === 'Customer' ? <BookingsPage session={session!} /> : <Navigate to={session ? homeFor(session) : '/login'} replace />} />
      <Route path="/provider-application" element={hasRole(session, 'Customer') && activeRole === 'Customer' ? <ProviderApplicationPage session={session!} onAuthenticated={saveSession} /> : <Navigate to={session ? homeFor(session) : '/login'} replace />} />
      <Route path="/provider" element={hasRole(session, 'Provider') && activeRole === 'Provider' ? <ProviderPage session={session!} /> : <Navigate to={session ? homeFor(session) : '/login'} replace />} />
      <Route path="/provider/slots" element={<Navigate to="/provider" replace />} />
      <Route path="/provider/setup" element={hasRole(session, 'Provider') && activeRole === 'Provider' ? <ProviderSetupPage session={session!} /> : <Navigate to={session ? homeFor(session) : '/login'} replace />} />
      <Route path="/provider/settings" element={<Navigate to="/provider/setup" replace />} />
      <Route path="/provider/store" element={<Navigate to="/provider/setup" replace />} />
      <Route path="/manager" element={hasRole(session, 'Manager') && activeRole === 'Manager' ? <AdminPage session={session!} mode="manager" /> : <Navigate to={session ? homeFor(session) : '/login'} replace />} />
      <Route path="/admin" element={hasRole(session, 'Admin') && activeRole === 'Admin' ? <AdminPage session={session!} mode="admin" /> : <Navigate to={session ? homeFor(session) : '/login'} replace />} />
      <Route path="/help" element={<HelpCenterPage session={session} />} />
      <Route path="/help/request" element={<SupportRequestPage session={session} />} />
      <Route path="/cskh" element={(hasRole(session, 'CSKH') || hasRole(session, 'Manager') || hasRole(session, 'Admin')) ? <CskhPage session={session!} /> : <Navigate to={session ? homeFor(session) : '/login'} replace />} />
      <Route path="/notifications" element={session ? <NotificationsPage session={session} onRead={checkUnread} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes></main>
    <footer><div><b>OpenSlot</b><span>Săn thời điểm trống. Tận hưởng giá hợp lý.</span></div><small>Demo đồ án cá nhân · ASP.NET Core + React</small></footer>
    <OpenSlotWebChat session={session} activeRole={activeRole} />
    {realtimeToast && (
      <div className="realtime-notification-toast" role="alert">
        <div className="toast-icon"><i className="bi bi-bell-fill" /></div>
        <div
          className="toast-content"
          role="button"
          tabIndex={0}
          onClick={() => {
            const link = realtimeToast.link
            setRealtimeToast(null)
            if (link) {
              try {
                const url = new URL(link, window.location.origin)
                if (url.origin === window.location.origin) navigate(url.pathname + url.search + url.hash)
                else window.location.assign(link)
              } catch {
                navigate(link)
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              const link = realtimeToast.link
              setRealtimeToast(null)
              if (link) navigate(link)
            }
          }}
        >
          <strong>{realtimeToast.title}</strong>
          <p>{realtimeToast.message}</p>
        </div>
        <button className="toast-close" onClick={() => setRealtimeToast(null)} aria-label="Đóng">
          <i className="bi bi-x-lg" />
        </button>
      </div>
    )}
  </>
}

function ExplorePage() {
  const [categories, setCategories] = useState<Category[]>([]); const [slots, setSlots] = useState<DealSlot[]>([])
  const [activeCategory, setActiveCategory] = useState(''); const [locationQuery, setLocationQuery] = useState(''); const [keyword, setKeyword] = useState(''); const [appliedKeyword, setAppliedKeyword] = useState(''); const [appliedLocation, setAppliedLocation] = useState<{ label: string; district?: string; latitude?: number; longitude?: number } | null>(null); const [loading, setLoading] = useState(true); const [locating, setLocating] = useState(false); const [hasSearched, setHasSearched] = useState(false); const [error, setError] = useState(''); const [mapMode, setMapMode] = useState(false)
  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
    return () => {
      setActiveCategory('')
      setKeyword('')
      setLocationQuery('')
      setAppliedKeyword('')
      setAppliedLocation(null)
      setHasSearched(false)
    }
  }, [])
  const lastUpdateTime = useRef(0)
  const loadSlots = useCallback(() => { setLoading(true); setError(''); const params = new URLSearchParams(); if (activeCategory) params.set('category', activeCategory); if (appliedLocation?.district) params.set('district', appliedLocation.district); if (appliedKeyword) params.set('q', appliedKeyword); if (appliedLocation?.latitude != null && appliedLocation.longitude != null) { params.set('latitude', String(appliedLocation.latitude)); params.set('longitude', String(appliedLocation.longitude)) }; const query = params.toString() ? `?${params}` : ''; return api.slots(query).then(setSlots).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [activeCategory, appliedKeyword, appliedLocation])
  // oxlint-disable-next-line react/set-state-in-effect -- loading is part of this request lifecycle
  useEffect(() => { void loadSlots() }, [loadSlots])
  useSlotAvailability(useCallback(() => {
    const now = Date.now()
    if (now - lastUpdateTime.current < 1000) return
    lastUpdateTime.current = now
    void loadSlots()
  }, [loadSlots]))
  const useMyLocation = () => { if (!navigator.geolocation) { setError('Trình duyệt không hỗ trợ định vị.'); return }; setLocating(true); navigator.geolocation.getCurrentPosition((position) => { const location = { label: 'Vị trí hiện tại của bạn', latitude: position.coords.latitude, longitude: position.coords.longitude }; setLocationQuery('Vị trí hiện tại'); setAppliedLocation(location); setHasSearched(true); setError(''); setLocating(false) }, () => { setError('Không thể lấy vị trí. Hãy cho phép quyền vị trí trong trình duyệt.'); setLocating(false) }) }
  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setHasSearched(true)
    setAppliedKeyword(keyword.trim())
    const requestedLocation = locationQuery.trim()
    if (!requestedLocation) {
      setAppliedLocation(null)
      return
    }
    setLocating(true)
    const searchTimeout = window.setTimeout(() => {
      setLocating(false)
      setAppliedLocation({ label: requestedLocation, district: requestedLocation })
      setError('Tìm kiếm địa điểm quá lâu; đã chuyển sang tìm theo tên khu vực.')
    }, 8000)
    try {
      const location = await api.geocodeLocation(requestedLocation)
      window.clearTimeout(searchTimeout)
      setAppliedLocation(location ?? { label: requestedLocation, district: requestedLocation })
      if (!location) setError(`Không xác định được “${requestedLocation}” trên bản đồ; đang tìm theo tên khu vực.`)
    } catch {
      window.clearTimeout(searchTimeout)
      setAppliedLocation({ label: requestedLocation, district: requestedLocation })
      setError('Dịch vụ bản đồ đang bận; OpenSlot đã chuyển sang tìm theo tên khu vực.')
    } finally {
      setLocating(false)
    }
  }
  const recommendationSlots = slots.slice(0, 6)
  const locationSuggestions = useMemo(() => filterSuggestions(vietnamLocations, locationQuery), [locationQuery])
  const serviceSuggestions = useMemo(() => filterSuggestions([...popularServiceSearches, ...categories.map((item) => item.name), ...slots.flatMap((slot) => [slot.serviceName, slot.venueName])], keyword), [categories, keyword, slots])
  return <div className="explore-page">
    <section className="hero-section">
      <div className="hero-decorations" aria-hidden="true">
        <span className="hero-glow-ring ring-1" />
        <span className="hero-glow-ring ring-2" />
        <div className="hero-floating-badge badge-1"><i className="bi bi-fire" /> Giảm tới 50%</div>
        <div className="hero-floating-badge badge-2"><i className="bi bi-lightning-charge-fill" /> Giữ chỗ tức thì</div>
      </div>
      <div className="container">
        <p className="eyebrow"><i className="bi bi-stars" /> Ưu đãi sát giờ, có giới hạn</p>
        <h1>Chỗ trống hôm nay,<br /><em>giá tốt ngay lúc này.</em></h1>
        <p className="hero-copy">OpenSlot kết nối các khung giờ còn trống từ đối tác với người dùng sẵn sàng trải nghiệm. Không chờ sale dài ngày, chỉ chọn đúng thời điểm.</p>
        <form className="search-box" onSubmit={search}>
          <div><i className="bi bi-search" /><input aria-label="Tìm dịch vụ" list="service-search-suggestions" autoComplete="off" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm sân, salon, chỗ ngồi..." /><datalist id="service-search-suggestions">{serviceSuggestions.map((suggestion) => <option value={suggestion} key={suggestion} />)}</datalist></div>
          <div><i className="bi bi-geo-alt" /><input aria-label="Khu vực" list="location-search-suggestions" autoComplete="off" value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Địa điểm, ví dụ: Hà Nội" /><datalist id="location-search-suggestions">{locationSuggestions.map((suggestion) => <option value={suggestion} key={suggestion} />)}</datalist></div>
          <button type="button" className={`location-button ${appliedLocation?.latitude != null ? 'active' : ''}`} onClick={useMyLocation} title="Dùng vị trí hiện tại" aria-label="Dùng vị trí hiện tại"><i className={`bi bi-${locating ? 'hourglass-split' : 'crosshair'}`} /></button>
          <button disabled={locating} className="btn btn-primary rounded-pill">{locating ? 'Đang xác định...' : 'Khám phá ngay'} <i className="bi bi-arrow-right" /></button>
        </form>
      </div>
    </section>
    <section className="container content-section">{hasSearched && <NearbyResults slots={recommendationSlots} location={appliedLocation} loading={loading || locating} />}<div className="category-row"><button className={!activeCategory ? 'category active' : 'category'} onClick={() => setActiveCategory('')}><i className="bi bi-grid" />Tất cả</button>{categories.map((item) => <button key={item.id} className={activeCategory === item.slug ? 'category active' : 'category'} onClick={() => setActiveCategory(item.slug)}><i className={`bi ${item.icon || 'bi-tag'}`} />{item.name}</button>)}</div><div className="section-heading"><div><p className="eyebrow">Sắp diễn ra</p><h2>Slot đáng săn gần bạn</h2></div><button className="view-toggle" onClick={() => setMapMode(!mapMode)}><i className={`bi bi-${mapMode ? 'list-ul' : 'map'}`} /> {mapMode ? 'Xem danh sách' : 'Xem trên bản đồ'}</button></div>{error && <div className="alert alert-warning">{error}</div>}{loading ? <SlotGridSkeleton count={6} /> : mapMode ? <SlotMap slots={slots} location={appliedLocation} /> : <SlotGrid slots={slots} />}</section>
    <section className="how-it-works"><div className="container"><p className="eyebrow">Đơn giản, minh bạch</p><h2>Săn slot trong 3 bước</h2><div className="steps"><Step icon="bi-search-heart" number="01" title="Tìm đúng lúc" text="Lọc dịch vụ, địa điểm và giờ phù hợp với lịch của bạn." /><Step icon="bi-ticket-perforated" number="02" title="Giữ chỗ nhanh" text="Xác nhận slot trước khi hết chỗ; giá và điều kiện luôn rõ ràng." /><Step icon="bi-qr-code-scan" number="03" title="Check-in gọn" text="Dùng mã QR hoặc PIN tại địa điểm để bắt đầu trải nghiệm." /></div></div></section>
  </div>
}

function Step({ icon, number, title, text }: { icon: string; number: string; title: string; text: string }) { return <article className="step"><span>{number}</span><i className={`bi ${icon}`} /><h3>{title}</h3><p>{text}</p></article> }
function SlotGrid({ slots }: { slots: DealSlot[] }) { return <div className="slot-grid">{slots.length ? slots.map((slot) => <SlotCard key={slot.id} slot={slot} />) : <div className="empty-state full"><i className="bi bi-calendar-x" /><h3>Chưa có slot phù hợp</h3><p>Thử đổi danh mục hoặc khu vực tìm kiếm nhé.</p></div>}</div> }
function defaultServiceImage(categorySlug: string, serviceName: string) {
  const images = serviceImageDefaults[categorySlug] ?? serviceImageDefaults.workspace
  let hash = 0
  for (let i = 0; i < serviceName.length; i++) {
    hash = ((hash << 5) - hash) + serviceName.charCodeAt(i)
    hash = hash & hash
  }
  return images[Math.abs(hash) % images.length]
}
function serviceImageStyle(imageUrl: string | null | undefined, categorySlug: string, serviceName: string) {
  const candidate = imageUrl?.trim() || defaultServiceImage(categorySlug, serviceName)
  try {
    const image = new URL(candidate)
    return image.protocol === 'https:' ? { backgroundImage: `url("${image.href}")` } : undefined
  } catch { return undefined }
}
function SlotCard({ slot }: { slot: DealSlot }) {
  const discount = Math.round((1 - slot.dealPriceVnd / slot.originalPriceVnd) * 100)
  const visualStyle = serviceImageStyle(slot.imageUrl, slot.categorySlug, slot.serviceName)
  const remainingPercent = Math.max(0, Math.min(100, (slot.remainingCapacity / slot.capacity) * 100))
  const capacityState = slot.remainingCapacity <= 1 ? 'danger' : slot.remainingCapacity <= 3 ? 'warning' : 'safe'

  return <NavLink to={`/slots/${slot.id}`} state={{ slot }} className="slot-card">
    <div style={visualStyle} className={`slot-visual visual-${slot.categorySlug}${visualStyle ? ' has-service-image' : ''}`}>
      <span className="discount">-{discount}%</span>
      <span className="spot-label"><i className="bi bi-lightning-fill" /> Còn {slot.remainingCapacity} chỗ</span>
    </div>
    <div className="slot-body">
      <div className="slot-meta">
        <span>{slot.categoryName}</span>
        <span><i className="bi bi-geo-alt" /> {slot.distanceKm == null ? slot.district : `${slot.distanceKm} km`}</span>
      </div>
      <h3>{slot.serviceName}</h3>
      <p className="venue"><i className="bi bi-building" /> {slot.venueName}{slot.resourceName && <> · <i className="bi bi-pin-map" /> {slot.resourceName}{slot.resourceCode ? ` (${slot.resourceCode})` : ''}</>}</p>
      <div className="time-row"><i className="bi bi-calendar-event" /> {formatSlotWindow(slot.startAtUtc, slot.endAtUtc)}</div>
      <div className="capacity-meter">
        <div className="capacity-meter-bar">
          <div className={`capacity-meter-fill ${capacityState}`} style={{ width: `${remainingPercent}%` }} />
        </div>
      </div>
      <div className="price-row">
        <div><del>{formatMoney(slot.originalPriceVnd)}</del><strong>{formatMoney(slot.dealPriceVnd)}</strong></div>
        <span className="arrow-circle"><i className="bi bi-arrow-up-right" /></span>
      </div>
    </div>
  </NavLink>
}

function NearbyResults({ slots, location, loading }: { slots: DealSlot[]; location: { label: string; latitude?: number; longitude?: number } | null; loading: boolean }) {
  return <section className="nearby-results" aria-live="polite"><div className="nearby-heading"><div><p className="eyebrow">Gợi ý quanh khu vực</p><h2>{location?.label ?? 'Các địa điểm phù hợp'}</h2></div>{!loading && <span><i className="bi bi-geo-alt-fill" /> {slots.length} lựa chọn gần nhất</span>}</div>{loading ? <div className="nearby-loading"><div className="spinner-border text-primary" /><p>Đang tìm địa điểm và ưu đãi phù hợp...</p></div> : slots.length ? <><SlotMap slots={slots} location={location} compact /><div className="nearby-strip">{slots.slice(0, 3).map((slot) => <NavLink key={slot.id} to={`/slots/${slot.id}`} state={{ slot }}><b>{slot.serviceName}</b><span>{slot.venueName} · {slot.distanceKm == null ? slot.district : `${slot.distanceKm} km`}</span><strong>{formatMoney(slot.dealPriceVnd)}</strong></NavLink>)}</div></> : <div className="nearby-empty"><i className="bi bi-map" /><div><b>Chưa có dịch vụ khả dụng quanh khu vực này</b><span>Thử một địa điểm lân cận hoặc bỏ trống ô địa điểm để xem tất cả.</span></div></div>}</section>
}

function FitMapBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => { if (points.length === 1) map.setView(points[0], 13); else if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 14 }) }, [map, points])
  return null
}

function SlotMap({ slots, location, compact = false }: { slots: DealSlot[]; location?: { latitude?: number; longitude?: number } | null; compact?: boolean }) {
  const userPoint = useMemo<[number, number] | null>(() => location?.latitude != null && location.longitude != null ? [location.latitude, location.longitude] : null, [location])
  const points = useMemo<[number, number][]>(() => [...(userPoint ? [userPoint] : []), ...slots.map((slot) => [slot.latitude, slot.longitude] as [number, number])], [slots, userPoint])
  const center = points[0] ?? [21.0285, 105.8542]
  return <div className={`map-canvas ${compact ? 'compact' : ''}`}><MapContainer key={`${center[0]}-${center[1]}-${slots.map((slot) => slot.id).join('-')}`} center={center} zoom={13} scrollWheelZoom className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FitMapBounds points={points} />{userPoint && <CircleMarker center={userPoint} radius={9} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2f6fed', fillOpacity: 1 }}><Popup>Vị trí bạn đã tìm</Popup></CircleMarker>}{slots.map((slot) => <CircleMarker key={slot.id} center={[slot.latitude, slot.longitude]} radius={11} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#ee7158', fillOpacity: 1 }}><Popup><div className="map-info"><b>{slot.serviceName}</b><span>{slot.venueName}{slot.resourceName ? ` · ${slot.resourceName}` : ''} · {formatMoney(slot.dealPriceVnd)}</span><NavLink to={`/slots/${slot.id}`} state={{ slot }}>Xem ưu đãi</NavLink></div></Popup></CircleMarker>)}</MapContainer></div>
}

function SlotDetailPage({ session }: { session: Session | null }) {
  const { slotId } = useParams(); const navigate = useNavigate(); const location = useLocation(); const locationSlot = (location.state as { slot?: DealSlot } | null)?.slot; const [slot, setSlot] = useState<DealSlot | null>(locationSlot ?? null); const [error, setError] = useState(''); const [holding, setHolding] = useState(false)
  const toast = useToast()
  const canBook = hasRole(session, 'Customer') && activePortalRole(session) === 'Customer'
  const refreshSlot = useCallback(() => { if (!slotId) return Promise.resolve(); return api.slot(slotId).then(setSlot).catch((e: Error) => setError(e.message)) }, [slotId])
  useEffect(() => { void refreshSlot() }, [refreshSlot])
  useSlotAvailability(useCallback((update) => { if (update.slotId === slotId) void refreshSlot() }, [refreshSlot, slotId]))
  if (!slot) return <div className="container detail-shell"><div className="empty-state"><p>{error || 'Đang tải thông tin slot...'}</p></div></div>
  const beginPayment = async () => { if (!session) { navigate('/login'); return }; if (!canBook) return; setHolding(true); setError(''); try { const hold = await api.createHold(slot.id, session.accessToken); navigate(`/payment/${slot.id}`, { state: { slot, hold } }) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể giữ chỗ lúc này. Vui lòng thử lại.'); void refreshSlot() } finally { setHolding(false) } }
  const report = async () => { if (!session) { navigate('/login'); return }; const reason = window.prompt('Mô tả vấn đề bạn muốn báo cáo (tối thiểu 10 ký tự):'); if (!reason) return; try { await api.createReport('slot', slot.id, reason, session.accessToken); toast.success('Báo cáo đã được gửi tới quản trị viên.') } catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi báo cáo.') } }
  const shareDeal = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Đã sao chép liên kết ưu đãi vào bộ nhớ tạm!')
    }
  }
  const startChatWithShop = () => {
    if (!session) { navigate('/login'); return }
    window.dispatchEvent(new CustomEvent('openslot:open-chat', {
      detail: {
        providerId: slot.providerId,
        providerBusinessName: slot.providerBusinessName || slot.venueName,
        topic: `Tư vấn: ${slot.serviceName} (${slot.venueName})`,
        initialMessage: `Chào bạn, mình đang xem ưu đãi "${slot.serviceName}" tại ${slot.venueName} và muốn tư vấn thêm.`,
        slotSnippet: {
          id: slot.id,
          serviceName: slot.serviceName,
          venueName: slot.venueName,
          dealPriceVnd: slot.dealPriceVnd
        }
      }
    }))
  }
  const visualStyle = serviceImageStyle(slot.imageUrl, slot.categorySlug, slot.serviceName)
  return <div className="container detail-shell"><NavLink to="/" className="back-link"><i className="bi bi-arrow-left" /> Quay lại khám phá</NavLink><div className="detail-grid"><section className="detail-main"><div style={visualStyle} className={`detail-visual visual-${slot.categorySlug}${visualStyle ? ' has-service-image' : ''}`}><span className="discount">-{Math.round((1 - slot.dealPriceVnd / slot.originalPriceVnd) * 100)}%</span><i className="bi bi-lightning-charge-fill" /></div><p className="eyebrow mt-4">{slot.categoryName}</p><h1>{slot.serviceName}</h1><p className="detail-venue"><i className="bi bi-building" /> {slot.venueName} · {slot.district}, {slot.city}</p><div className="detail-facts"><Fact icon="bi-calendar-event" label="Bắt đầu" value={formatTime(slot.startAtUtc)} /><Fact icon="bi-clock" label="Kết thúc" value={formatTime(slot.endAtUtc)} /><Fact icon="bi-geo-alt" label="Địa điểm" value={`${slot.district}, ${slot.city}`} />{slot.resourceName && <Fact icon="bi-pin-map" label="Đơn vị đã đặt" value={`${slot.resourceName}${slot.resourceCode ? ` · ${slot.resourceCode}` : ''}${slot.resourceLocation ? ` · ${slot.resourceLocation}` : ''}`} />}</div><article className="info-box"><h3><i className="bi bi-shield-check" /> Chính sách OpenSlot</h3><p>Giữ chỗ chỉ hợp lệ trước giờ bắt đầu ít nhất 15 phút. Hủy sát giờ hoặc không đến có thể được tính strike để bảo vệ đối tác và cộng đồng.</p></article><button onClick={report} className="report-button"><i className="bi bi-flag" /> Báo cáo thông tin không chính xác</button></section><aside className="booking-panel sticky-panel"><p>Giá ưu đãi sát giờ</p><div className="detail-price"><del>{formatMoney(slot.originalPriceVnd)}</del><strong>{formatMoney(slot.dealPriceVnd)}</strong></div><div className="capacity-meter mb-3"><div className="capacity-meter-bar"><div className={`capacity-meter-fill ${slot.remainingCapacity <= 1 ? 'danger' : slot.remainingCapacity <= 3 ? 'warning' : 'safe'}`} style={{ width: `${Math.min(100, (slot.remainingCapacity / slot.capacity) * 100)}%` }} /></div><div className="capacity-text mt-1"><span>Đang mở bán</span><span>Còn {slot.remainingCapacity}/{slot.capacity} chỗ khả dụng</span></div></div>{error && <div className="alert alert-danger py-2 small">{error}</div>}<button disabled={holding || !slot.remainingCapacity || (!!session && !canBook)} onClick={beginPayment} className="btn btn-primary w-100 rounded-pill py-3">{holding ? 'Đang giữ chỗ...' : !session ? 'Đăng nhập để tiếp tục' : canBook ? 'Tiếp tục thanh toán' : 'Chỉ tài khoản khách hàng được đặt'} <i className="bi bi-arrow-right" /></button><button type="button" onClick={startChatWithShop} className="btn btn-outline-secondary w-100 rounded-pill py-2 mt-2"><i className="bi bi-chat-dots-fill me-2" /> Chat với cửa hàng</button><button type="button" onClick={shareDeal} className="share-deal-btn w-100 mt-2"><i className="bi bi-share-fill" /> Chia sẻ ưu đãi này</button><small className="d-block text-center mt-3">Vào thanh toán sẽ giữ chỗ cho bạn tối đa 10 phút.</small></aside></div></div>
}

function BookingConfirmationPage({ confirmation, venueName }: { confirmation: BookingConfirmation; venueName: string }) {
  const toast = useToast()
  const copyPin = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(confirmation.checkInPin)
      toast.success('Đã sao chép mã PIN check-in!')
    }
  }

  return (
    <div className="container confirmation-page py-5">
      <div className="e-ticket-wrap">
        <div className="e-ticket-card">
          <div className="e-ticket-header">
            <div className="d-flex justify-content-between align-items-center">
              <span className="e-ticket-badge">
                <i className="bi bi-check-circle-fill" /> Đã xác nhận thành công
              </span>
              <span className="text-white-50 small fw-bold">OpenSlot E-Ticket</span>
            </div>
            <h2 className="e-ticket-title mt-2">{venueName}</h2>
            <p className="e-ticket-venue">
              <i className="bi bi-geo-alt-fill text-danger" /> Xuất trình mã này tại quầy để check-in
            </p>
          </div>

          <div className="e-ticket-tear-line">
            <div className="e-ticket-dashed" />
          </div>

          <div className="e-ticket-body">
            <div className="e-ticket-qr-zone">
              <QRCodeSVG value={confirmation.qrPayload} size={190} />
              <div className="e-ticket-pin-display mt-3">
                <span className="text-muted small fw-bold text-uppercase me-2">MÃ PIN:</span>
                <span className="e-ticket-pin-digits">{confirmation.checkInPin}</span>
                <button type="button" className="btn btn-sm btn-link text-decoration-none p-0 ms-2" onClick={copyPin} title="Sao chép PIN">
                  <i className="bi bi-clipboard fs-5 text-dark" />
                </button>
              </div>
              <small className="text-muted mt-2">Mã đặt chỗ: <b>{confirmation.publicCode}</b></small>
            </div>

            <div className="e-ticket-actions">
              <button type="button" onClick={() => window.print()} className="btn btn-outline-secondary rounded-pill px-4">
                <i className="bi bi-printer me-1" /> In / Lưu vé
              </button>
              <NavLink to="/bookings" className="btn btn-primary rounded-pill px-4">
                <i className="bi bi-calendar-check me-1" /> Xem lịch của tôi
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaymentPage({ session }: { session: Session | null }) {
  const { slotId } = useParams(); const location = useLocation(); const navigate = useNavigate(); const locationState = (location.state as { slot?: DealSlot; hold?: SlotHold } | null); const locationSlot = locationState?.slot; const [slot, setSlot] = useState<DealSlot | null>(locationSlot ?? null); const [hold, setHold] = useState<SlotHold | null>(locationState?.hold ?? null); const [status, setStatus] = useState<'idle' | 'holding' | 'loading'>('idle'); const [error, setError] = useState(''); const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null); const [secondsLeft, setSecondsLeft] = useState(0); const expirationReleaseSent = useRef(false); const isMounted = useRef(true)
  const toast = useToast()
  const canBook = hasRole(session, 'Customer') && activePortalRole(session) === 'Customer'
  const refreshSlot = useCallback(() => { if (!slotId) return Promise.resolve(); return api.slot(slotId).then(setSlot).catch((e: Error) => setError(e.message)) }, [slotId])
  useEffect(() => { void refreshSlot() }, [refreshSlot])
  // oxlint-disable-next-line react/set-state-in-effect -- checkout hold acquisition is an external request lifecycle.
  useEffect(() => { if (!slot || hold || !session || !canBook) return; let disposed = false; setStatus('holding'); setError(''); api.createHold(slot.id, session.accessToken).then((createdHold) => { if (!disposed) setHold(createdHold) }).catch((e: Error) => { if (!disposed) setError(e.message) }).finally(() => { if (!disposed) setStatus('idle') }); return () => { disposed = true } }, [canBook, hold, session, slot])
  useEffect(() => { if (!hold) return; const update = () => { if (isMounted.current) setSecondsLeft(Math.ceil((new Date(hold.expiresAtUtc).getTime() - Date.now()) / 1000)) }; update(); const interval = window.setInterval(update, 1_000); return () => window.clearInterval(interval) }, [hold])
  useEffect(() => { if (!hold || !session) return; const delay = Math.max(0, new Date(hold.expiresAtUtc).getTime() - Date.now()); const timeout = window.setTimeout(() => { if (!expirationReleaseSent.current) { expirationReleaseSent.current = true; void api.releaseHold(hold.holdId, session.accessToken).catch(() => undefined) } }, delay + 100); return () => window.clearTimeout(timeout) }, [hold, session])
  useEffect(() => { return () => { isMounted.current = false } }, [])
  useSlotAvailability(useCallback((update) => { if (update.slotId === slotId) { setSlot((current) => current ? { ...current, remainingCapacity: update.remainingCapacity, capacity: update.capacity, status: update.status } : current) } }, [slotId]))
  if (!session) return <Navigate to="/login" replace />
  if (!canBook) return <Navigate to={homeFor(session)} replace />
  if (!slot) return <div className="container payment-page"><div className="empty-state"><p>{error || 'Đang tải thông tin thanh toán...'}</p></div></div>
  const expired = Boolean(hold && secondsLeft <= 0)
  const isCritical = Boolean(hold && secondsLeft > 0 && secondsLeft < 120)

  const copyText = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      toast.success(`Đã sao chép ${label}!`)
    }
  }

  const confirmPayment = async () => { if (!hold) return; setStatus('loading'); setError(''); try { const result = await api.confirmHold(hold.holdId, session.accessToken); expirationReleaseSent.current = true; setConfirmation(result) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể xác nhận giữ chỗ. Vui lòng thử lại.'); void refreshSlot() } finally { setStatus('idle') } }
  const cancelPayment = async () => { if (expirationReleaseSent.current) { navigate(`/slots/${slot.id}`, { replace: true }); return }; expirationReleaseSent.current = true; setStatus('loading'); try { if (hold) await api.releaseHold(hold.holdId, session.accessToken); navigate(`/slots/${slot.id}`, { replace: true }) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể hủy giữ chỗ. Vui lòng thử lại.') } finally { setStatus('idle') } }
  if (confirmation) return <BookingConfirmationPage confirmation={confirmation} venueName={slot.venueName} />

  return <div className="container payment-page"><button type="button" onClick={cancelPayment} disabled={status === 'loading'} className="back-link border-0 bg-transparent"><i className="bi bi-arrow-left" /> Hủy và quay lại ưu đãi</button><div className="payment-layout"><section className="payment-card"><p className="eyebrow">Bước cuối cùng</p><h1>Thanh toán giữ chỗ</h1><p className="payment-copy">Quét mã QR bằng ứng dụng VietinBank iPay Mobile hoặc ứng dụng ngân hàng của bạn và chuyển đúng số tiền trước khi xác nhận.</p>{hold ? <div className={`urgent-timer-box ${isCritical || expired ? 'is-critical' : ''}`}><i className={`bi bi-${expired ? 'x-circle-fill' : isCritical ? 'exclamation-triangle-fill' : 'hourglass-split'} fs-3`} /><div className="flex-grow-1"><div className="d-flex justify-content-between align-items-center mb-1"><span className="fw-bold small">{expired ? 'Hết thời gian giữ chỗ!' : isCritical ? 'SẮP HẾT HẠN GIỮ CHỖ!' : 'Thời gian giữ chỗ còn lại:'}</span><span className="urgent-timer-digits">{formatCountdown(secondsLeft)}</span></div><div className="capacity-meter-bar" style={{ height: '4px' }}><div className={`capacity-meter-fill ${expired || isCritical ? 'danger' : 'safe'}`} style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / 600) * 100))}%` }} /></div></div></div> : <div className="urgent-timer-box"><div className="spinner-border spinner-border-sm me-2" /><span>Đang kết nối hệ thống giữ chỗ...</span></div>}<div className="payment-qr"><img src="/payment/vietinbank-qr.png" alt="Mã QR VietinBank để thanh toán" /></div><div className="bank-details"><div className="bank-detail-box"><span>Ngân hàng</span><b>VietinBank</b></div><div className="bank-detail-box"><span>Số tài khoản</span><b>108883701569</b><button type="button" className="copy-badge-btn" onClick={() => copyText('108883701569', 'Số tài khoản')} title="Sao chép"><i className="bi bi-clipboard" /> Chép</button></div><div className="bank-detail-box"><span>Số tiền</span><b>{formatMoney(slot.dealPriceVnd)}</b><button type="button" className="copy-badge-btn" onClick={() => copyText(String(slot.dealPriceVnd), 'Số tiền')} title="Sao chép"><i className="bi bi-clipboard" /> Chép</button></div></div><div className="payment-demo-note"><i className="bi bi-info-circle" /><span>Đây là thanh toán mô phỏng cho bản demo. OpenSlot chưa thể tự kiểm tra giao dịch ngân hàng.</span></div>{error && <div className="alert alert-danger mb-0">{error}</div>}<button disabled={status !== 'idle' || !hold || expired} onClick={confirmPayment} className="btn btn-primary w-100 rounded-pill py-3">{status === 'holding' ? 'Đang giữ chỗ...' : status === 'loading' ? 'Đang xác nhận...' : 'Tôi đã thanh toán'} <i className="bi bi-check2-circle" /></button><button type="button" disabled={status !== 'idle'} onClick={cancelPayment} className="btn btn-outline-secondary w-100 rounded-pill mt-2">Hủy thanh toán</button></section><aside className="payment-summary"><p className="eyebrow">Thông tin ưu đãi</p><h2>{slot.serviceName}</h2><p><i className="bi bi-building" /> {slot.venueName}</p><p><i className="bi bi-calendar-event" /> {formatSlotWindow(slot.startAtUtc, slot.endAtUtc)}</p><p><i className="bi bi-geo-alt" /> {slot.district}, {slot.city}</p>{slot.resourceName && <p><i className="bi bi-pin-map" /> {slot.resourceName}{slot.resourceCode ? ` · ${slot.resourceCode}` : ''}</p>}<hr /><div><span>Giá gốc</span><del>{formatMoney(slot.originalPriceVnd)}</del></div><div className="payment-total"><span>Thanh toán</span><strong>{formatMoney(slot.dealPriceVnd)}</strong></div></aside></div></div>
}
function Fact({ icon, label, value }: { icon: string; label: string; value: string }) { return <div><i className={`bi ${icon}`} /><span><small>{label}</small><b>{value}</b></span></div> }

function LoginEntryPage({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  return <AuthPage mode="login" onAuthenticated={onAuthenticated} />
}

function VerifyEmailPage() {
  const [searchParams] = useSearchParams(); const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading'); const [message, setMessage] = useState('Đang xác minh email của bạn...')
  const userId = searchParams.get('userId') ?? ''; const token = searchParams.get('token') ?? ''
  // oxlint-disable-next-line react/set-state-in-effect -- this is the confirmation request lifecycle
  useEffect(() => { if (!userId || !token) { setStatus('error'); setMessage('Link xác minh không đầy đủ hoặc không hợp lệ.'); return }; api.confirmEmail(userId, token).then((result) => { setStatus('success'); setMessage(result.message) }).catch((error: Error) => { setStatus('error'); setMessage(error.message) }) }, [token, userId])
  return <div className="auth-page"><section className="auth-pitch"><NavLink to="/" className="brand"><span className="brand-mark"><i className="bi bi-lightning-charge-fill" /></span>Open<span>Slot</span></NavLink><div><p className="eyebrow">Bảo mật tài khoản</p><h1>Xác minh email<br />an toàn, nhanh gọn.</h1><p>OpenSlot chỉ mở đăng nhập sau khi bạn xác nhận quyền sở hữu Gmail.</p></div></section><section className="auth-form-wrap"><div className="auth-form email-confirmation"><span className={`confirmation-icon ${status}`}><i className={`bi bi-${status === 'loading' ? 'arrow-repeat' : status === 'success' ? 'check-lg' : 'x-lg'}`} /></span><p className="eyebrow">Xác minh Gmail</p><h1>{status === 'loading' ? 'Đang xử lý' : status === 'success' ? 'Email đã xác minh' : 'Không thể xác minh'}</h1><p>{message}</p>{status === 'success' ? <NavLink to="/login" className="btn btn-primary rounded-pill py-3">Đến trang đăng nhập <i className="bi bi-arrow-right" /></NavLink> : <NavLink to="/register" className="btn btn-outline-primary rounded-pill py-3">Quay lại đăng ký</NavLink>}</div></section></div>
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const sendResetLink = async () => { setError(''); setNotice(''); if (!isValidGmail(email)) { setError('Vui lòng nhập địa chỉ Gmail hợp lệ, ví dụ: ten@gmail.com.'); return }; setLoading(true); try { const result = await api.forgotPassword(email); setNotice(result.message) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi email đặt lại mật khẩu.') } finally { setLoading(false) } }
  const submit = (event: React.FormEvent) => { event.preventDefault(); void sendResetLink() }
  return <div className="auth-page auth-experience">
    <section className="auth-pitch">
      <NavLink to="/" className="brand" aria-label="OpenSlot - Trang chủ"><span className="brand-mark"><i className="bi bi-plus-lg" /></span><span className="brand-open">Open</span><span>Slot</span></NavLink>
      <div className="auth-pitch-copy">
        <p className="eyebrow">Khôi phục tài khoản</p>
        <h1>Lấy lại mật khẩu,<br />tiếp tục săn slot</h1>
        <p>Đừng lo lắng khi quên mật khẩu. Chúng tôi sẽ gửi liên kết bảo mật đến Gmail của bạn để tạo mật khẩu mới an toàn và nhanh chóng.</p>
      </div>
      <AuthVisuals mode="forgot" />
      <div className="quote">Bảo vệ tài khoản của bạn<br />luôn là ưu tiên hàng đầu.<span /></div>
    </section>
    <section className="auth-form-wrap">
      <form onSubmit={submit} className="auth-form">
        <p className="eyebrow">Khôi phục tài khoản</p>
        <h1>Quên mật khẩu</h1>
        <p className="form-hint">Nhập Gmail đã dùng để đăng ký OpenSlot. Link chỉ dùng được 1 lần trong 30 phút.</p>
        <label>
          Gmail
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ten@gmail.com" />
          <small className="form-hint">Chỉ hỗ trợ địa chỉ @gmail.com.</small>
        </label>
        {error && <div className="alert alert-danger">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}
        <button disabled={loading} className="btn btn-primary rounded-pill py-3">
          {loading ? 'Đang gửi...' : notice ? 'Chưa nhận được email? Gửi lại link' : 'Gửi link đặt lại mật khẩu'} <i className="bi bi-send" />
        </button>
        <p className="switch-auth">Nhớ mật khẩu rồi? <NavLink to="/login">Đăng nhập</NavLink></p>
      </form>
    </section>
  </div>
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams(); const navigate = useNavigate(); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const userId = searchParams.get('userId') ?? ''; const token = searchParams.get('token') ?? ''
  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => navigate('/login', { replace: true }), 3_000); return () => window.clearTimeout(timeout) }, [navigate, notice])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); if (!userId || !token) { setError('Link đặt lại mật khẩu không đầy đủ hoặc không hợp lệ.'); return }; if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/.test(password)) { setError('Mật khẩu cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.'); return }; if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return }; setLoading(true); try { const result = await api.resetPassword(userId, token, password, confirmPassword); setNotice(`${result.message} Bạn sẽ được chuyển đến trang đăng nhập.`) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể đặt lại mật khẩu.') } finally { setLoading(false) } }
  return <div className="auth-page auth-experience">
    <section className="auth-pitch">
      <NavLink to="/" className="brand" aria-label="OpenSlot - Trang chủ"><span className="brand-mark"><i className="bi bi-plus-lg" /></span><span className="brand-open">Open</span><span>Slot</span></NavLink>
      <div className="auth-pitch-copy">
        <p className="eyebrow">Bảo mật tài khoản</p>
        <h1>Đặt lại<br />mật khẩu mới</h1>
        <p>Đặt mật khẩu mạnh tối thiểu 8 ký tự gồm chữ hoa, chữ thường và số để tiếp tục sử dụng OpenSlot an toàn.</p>
      </div>
      <AuthVisuals mode="forgot" />
      <div className="quote">An toàn hôm nay,<br />trọn vẹn từng trải nghiệm.<span /></div>
    </section>
    <section className="auth-form-wrap">
      <form onSubmit={submit} className="auth-form">
        <p className="eyebrow">Đặt lại mật khẩu</p>
        <h1>Tạo mật khẩu mới</h1>
        <p className="form-hint">Link này chỉ dùng được một lần. Sau khi đổi, bạn sẽ được chuyển đến trang đăng nhập.</p>
        <label>Mật khẩu mới
          <input required disabled={!!notice} autoComplete="new-password" minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 8 ký tự" />
        </label>
        <label>Xác nhận mật khẩu mới
          <input required disabled={!!notice} autoComplete="new-password" minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu mới" />
        </label>
        {error && <div className="alert alert-danger">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}
        <button disabled={loading || !!notice} className="btn btn-primary rounded-pill py-3">
          {loading ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'} <i className="bi bi-shield-check" />
        </button>
        {notice && <NavLink to="/login" className="btn btn-outline-primary rounded-pill py-3 mt-2">Đến trang đăng nhập</NavLink>}
      </form>
    </section>
  </div>
}

function AuthVisuals({ mode = 'login' }: { mode?: 'login' | 'register' | 'forgot' }) {
  if (mode === 'register') {
    return <div className="auth-visuals" aria-hidden="true">
      <article className="auth-visual-card spa-card"><img src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-flower1" /></span><div><b>Gội đầu & Spa</b><small>Còn khung giờ trống</small></div></article>
      <article className="auth-visual-card studio-card"><img src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-camera-fill" /></span><div><b>Studio chụp ảnh</b><small>Ưu đãi giờ chót</small></div></article>
      <article className="auth-visual-card workspace-card"><img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-laptop" /></span><div><b>Phòng họp & Workspace</b><small>Sẵn sàng đặt ngay</small></div></article>
      <article className="auth-deal-card register-deal-card"><div><b>Tài khoản mới</b><small>Săn slot ngay hôm nay</small></div><span><i className="bi bi-stars" /></span></article>
      <span className="auth-glass-tile tile-one" /><span className="auth-glass-tile tile-two" /><span className="auth-glass-tile tile-three" />
    </div>
  }
  if (mode === 'forgot') {
    return <div className="auth-visuals" aria-hidden="true">
      <article className="auth-visual-card security-card"><img src="https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-shield-lock-fill" /></span><div><b>Bảo mật tài khoản</b><small>Mã hóa liên kết an toàn</small></div></article>
      <article className="auth-visual-card mail-card"><img src="https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-envelope-check-fill" /></span><div><b>Xác nhận qua Gmail</b><small>Link 1 lần trong 30 phút</small></div></article>
      <article className="auth-visual-card recovery-card"><img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-key-fill" /></span><div><b>Khôi phục tức thì</b><small>Tiếp tục săn slot giá tốt</small></div></article>
      <article className="auth-deal-card forgot-deal-card"><div><b>Khôi phục 24/7</b><small>Bảo vệ tài khoản đa tầng</small></div><span><i className="bi bi-shield-check" /></span></article>
      <span className="auth-glass-tile tile-one" /><span className="auth-glass-tile tile-two" /><span className="auth-glass-tile tile-three" />
    </div>
  }
  return <div className="auth-visuals" aria-hidden="true">
    <article className="auth-visual-card coffee-card"><img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-cup-hot-fill" /></span><div><b>Quán cà phê</b><small>Còn trống</small></div></article>
    <article className="auth-visual-card tennis-card"><img src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-dribbble" /></span><div><b>Sân tennis</b><small>Còn trống</small></div></article>
    <article className="auth-visual-card salon-card"><img src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=700&q=80" alt="" /><span className="visual-category"><i className="bi bi-scissors" /></span><div><b>Salon làm đẹp</b><small>Còn trống</small></div></article>
    <article className="auth-deal-card"><div><b>Đặt ngay</b><small>Giá tốt hơn</small></div><span><i className="bi bi-calendar-check" /></span></article>
    <span className="auth-glass-tile tile-one" /><span className="auth-glass-tile tile-two" /><span className="auth-glass-tile tile-three" />
  </div>
}

function AuthPage({ mode, onAuthenticated }: { mode: 'login' | 'register'; onAuthenticated: (session: Session) => void }) {
  const navigate = useNavigate(); const [displayName, setDisplayName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [registrationEmail, setRegistrationEmail] = useState(''); const [notice, setNotice] = useState('')
  const resend = async () => { if (!email.trim()) { setError('Nhập Gmail trước khi yêu cầu gửi lại email xác minh.'); return }; setError(''); setNotice(''); setLoading(true); try { const result = await api.resendVerification(email); setNotice(result.message) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi lại email xác minh.') } finally { setLoading(false) } }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('')
    if (mode === 'register') {
      if (!displayName.trim()) { setError('Vui lòng nhập họ và tên.'); return }
      if (!isValidGmail(email)) { setError('Vui lòng nhập địa chỉ Gmail hợp lệ, ví dụ: ten@gmail.com.'); return }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/.test(password)) { setError('Mật khẩu cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.'); return }
      if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return }
    }
    setLoading(true)
    try {
      if (mode === 'register') { const result = await api.register(displayName.trim(), email.trim(), password); setRegistrationEmail(result.email); setNotice(result.message); return }
      const next = await api.login(email, password)
      const session = { ...next, activeRole: defaultPortalRole(next.user.roles) }; onAuthenticated(session); navigate(homeFor(session))
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tiếp tục.') } finally { setLoading(false) }
  }
  const demoAccount = 'customer@openslot.local / Customer@12345'
  return <div className="auth-page auth-experience">
    <section className="auth-pitch">
      <NavLink to="/" className="brand" aria-label="OpenSlot - Trang chủ"><span className="brand-mark"><i className="bi bi-plus-lg" /></span><span className="brand-open">Open</span><span>Slot</span></NavLink>
      <div className="auth-pitch-copy"><p className="eyebrow">{mode === 'login' ? 'Ưu đãi sát giờ' : 'Đặc quyền thành viên'}</p><h1>{mode === 'login' ? <>Chỗ trống giá tốt,<br />tận hưởng trọn vẹn</> : <>Săn slot sát giờ,<br />giá tốt mỗi ngày</>}</h1><p>{mode === 'login' ? 'Khám phá dịch vụ còn trống với mức giá hợp lý, sẵn sàng cho trải nghiệm của bạn.' : 'Tạo tài khoản miễn phí chỉ trong 1 phút để nhận ưu đãi tức thì cho các khung giờ còn trống quanh bạn.'}</p></div>
      <AuthVisuals mode={mode} />
      <div className="quote">{mode === 'login' ? <>Những khoảnh khắc đáng giá<br />luôn có chỗ chờ bạn.</> : <>Đúng nơi, đúng lúc,<br />trọn vẹn từng trải nghiệm.</>}<span /></div>
    </section>
    <section className="auth-form-wrap"><form onSubmit={submit} className="auth-form"><p className="eyebrow">{mode === 'login' ? 'Đăng nhập OpenSlot' : 'Đăng ký tài khoản'}</p><h1>{registrationEmail ? 'Kiểm tra Gmail của bạn' : mode === 'login' ? 'Chào mừng trở lại' : 'Bắt đầu săn slot'}</h1>{registrationEmail ? <div className="registration-complete"><span className="confirmation-icon success"><i className="bi bi-envelope-check" /></span><p>OpenSlot đã gửi link xác minh tới <b>{registrationEmail}</b>. Hãy mở Gmail, bấm link rồi đăng nhập.</p>{notice && <div className="alert alert-success">{notice}</div>}{error && <div className="alert alert-danger">{error}</div>}<button type="button" disabled={loading} onClick={resend} className="btn btn-outline-primary rounded-pill py-3">{loading ? 'Đang gửi...' : 'Gửi lại email xác minh'} <i className="bi bi-send" /></button><p className="switch-auth">Đã xác minh? <NavLink to="/login">Đăng nhập</NavLink></p></div> : <>{mode === 'register' && <label>Họ và tên<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" /></label>}<label>{mode === 'register' ? 'Gmail' : 'Email'}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={mode === 'register' ? 'ten@gmail.com' : 'ban@email.com'} autoComplete="email" />{mode === 'register' && <small className="form-hint">OpenSlot sẽ gửi link xác minh tới Gmail này.</small>}</label><label>Mật khẩu<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />{mode === 'register' && <small className="form-hint">Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số.</small>}</label>{mode === 'register' && <label>Xác nhận mật khẩu<input required minLength={8} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu" autoComplete="new-password" /></label>}{error && <div className="alert alert-danger">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}<button disabled={loading} className="btn btn-primary rounded-pill py-3">{loading ? 'Đang xử lý...' : mode === 'login' ? 'Vào OpenSlot' : 'Đăng ký ngay'} <i className="bi bi-arrow-right" /></button>{mode === 'login' && <NavLink className="auth-resend" to="/forgot-password">Quên mật khẩu?</NavLink>}<p className="switch-auth">{mode === 'login' ? <>Chưa có tài khoản? <NavLink to="/register">Đăng ký ngay</NavLink></> : <>Đã có tài khoản? <NavLink to="/login">Đăng nhập</NavLink></>}</p>{mode === 'login' && <div className="demo-login"><b>Demo nhanh</b><span>{demoAccount}</span><small>Đối tác, Manager và Admin cũng dùng cùng màn hình đăng nhập này; khu vực chỉ mở khi tài khoản có quyền.</small></div>}</>}</form></section>
  </div>
}

function ProviderApplicationPage({ session, onAuthenticated }: { session: Session; onAuthenticated: (session: Session) => void }) {
  const navigate = useNavigate(); const [businessName, setBusinessName] = useState(''); const [contactPhone, setContactPhone] = useState(''); const [description, setDescription] = useState(''); const [categoryId, setCategoryId] = useState(''); const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { api.categories().then(setCategories).catch(() => setCategories([])) }, [])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); if (!isValidPhone(contactPhone)) { setError('Số điện thoại không hợp lệ, vui lòng nhập lại.'); return }; setSaving(true); try { const next = await api.applyForProvider({ businessName, contactPhone, description, categoryId: categoryId ? Number(categoryId) : undefined }, session.accessToken); onAuthenticated({ ...next, activeRole: 'Provider' }); navigate('/provider') } catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi hồ sơ đối tác.') } finally { setSaving(false) } }
  return <div className="container application-page"><section className="application-intro"><p className="eyebrow">Dành cho chủ cửa hàng</p><h1>Đưa khung giờ trống của bạn lên OpenSlot</h1><p>Hồ sơ sẽ được Manager kiểm tra trước khi bạn phát hành slot. Sau khi gửi, bạn vẫn có thể hoàn thiện địa điểm, dịch vụ và đơn vị nhận đặt chỗ.</p><div className="application-steps"><span><b>01</b> Gửi hồ sơ cửa hàng</span><span><b>02</b> Manager xét duyệt</span><span><b>03</b> Phát hành slot sát giờ</span></div></section><form className="provider-application-form" onSubmit={submit}><p className="eyebrow">Hồ sơ đối tác</p><h2>Thông tin cửa hàng</h2><label>Tên cửa hàng/doanh nghiệp<input required minLength={2} maxLength={160} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ví dụ: Cà phê Mây" /></label><label>Số điện thoại liên hệ<input required type="tel" inputMode="numeric" autoComplete="tel" minLength={10} maxLength={10} pattern="0[0-9]{9}" title="Gồm đúng 10 chữ số và bắt đầu bằng số 0" value={contactPhone} onChange={(e) => setContactPhone(normalizePhone(e.target.value))} placeholder="0900000000" /><small className="form-hint">Gồm đúng 10 chữ số và bắt đầu bằng số 0.</small></label><label>Lĩnh vực kinh doanh chính<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">-- Chọn lĩnh vực kinh doanh --</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><small className="form-hint">Cửa hàng sẽ được khóa theo lĩnh vực này khi tạo dịch vụ và chỗ đặt.</small></label><label>Mô tả ngắn<input maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bạn cung cấp dịch vụ gì, ở khu vực nào?" /></label>{error && <div className="alert alert-danger">{error}</div>}<button disabled={saving} className="btn btn-primary rounded-pill py-3">{saving ? 'Đang gửi...' : 'Gửi hồ sơ để xét duyệt'} <i className="bi bi-arrow-right" /></button><small>Tài khoản sẽ được bổ sung quyền Đối tác, vẫn giữ quyền Khách hàng để đặt dịch vụ khi cần.</small></form></div>
}

function BookingsPage({ session }: { session: Session }) {
  const [bookings, setBookings] = useState<Booking[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const [selectedBookingForTicket, setSelectedBookingForTicket] = useState<Booking | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; variant?: 'danger' | 'warning' | 'primary'; onConfirm: () => Promise<void> } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  // oxlint-disable-next-line react/set-state-in-effect -- loading belongs to the request lifecycle
  const refresh = () => { setLoading(true); api.myBookings(session.accessToken).then(setBookings).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }
  useEffect(refresh, [session.accessToken])
  const cancel = (booking: Booking) => {
    // oxlint-disable-next-line react/purity -- Date.now is only called during user interaction, not render
    const now = Date.now()
    const hoursUntilStart = (new Date(booking.startAtUtc).getTime() - now) / 3600000
    const message = hoursUntilStart < 2
      ? `CẢNH BÁO: Chỉ còn ${Math.round(hoursUntilStart * 60)} phút nữa là bắt đầu!\n\nHủy booking ${booking.publicCode}?\n\nĐối tác đã giữ chỗ cho bạn, hủy quá gần giờ có thể ảnh hưởng uy tín tài khoản.`
      : `Bạn có chắc muốn hủy đặt chỗ ${booking.publicCode} (${booking.serviceName})?`
    setConfirmModal({
      isOpen: true,
      title: 'Hủy đặt chỗ',
      message,
      confirmText: 'Hủy đặt chỗ',
      variant: 'danger',
      onConfirm: async () => {
        await api.cancelBooking(booking.id, 'Người dùng hủy từ giao diện', session.accessToken)
        refresh()
      }
    })
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <span className="os-badge os-badge-open"><i className="bi bi-check-circle-fill" /> Đã xác nhận</span>
      case 1:
        return <span className="os-badge os-badge-pending"><i className="bi bi-hourglass-split" /> Đang check-in</span>
      case 2:
        return <span className="os-badge os-badge-expired"><i className="bi bi-check-all" /> Đã hoàn thành</span>
      case 3:
        return <span className="os-badge os-badge-cancelled"><i className="bi bi-x-circle-fill" /> Đã hủy</span>
      case 4:
        return <span className="os-badge os-badge-expired"><i className="bi bi-person-x-fill" /> Vắng mặt (No-show)</span>
      default:
        return <span className="os-badge os-badge-draft">Khác</span>
    }
  }

  return <div className="container dashboard"><p className="eyebrow">Tài khoản của bạn</p><h1>Lịch trải nghiệm</h1><p className="dashboard-copy">Mã QR/check-in PIN được mở khi bạn giữ chỗ. Hãy đến đúng giờ để giữ lịch sử tốt.</p>{error && <div className="alert alert-danger">{error}</div>}{loading ? <div className="empty-state"><div className="spinner-border text-primary" /></div> : bookings.length ? <div className="booking-list">{bookings.map((booking) => <article className="booking-item" key={booking.id}><div className="booking-date"><b>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(new Date(booking.startAtUtc))}</b><span>thg {new Intl.DateTimeFormat('vi-VN', { month: '2-digit' }).format(new Date(booking.startAtUtc))}</span></div><div className="booking-info">{getStatusBadge(booking.status)}<h3>{booking.serviceName}</h3><p><i className="bi bi-building" /> {booking.venueName}{booking.resourceName ? ` · ${booking.resourceName}${booking.resourceCode ? ` (${booking.resourceCode})` : ''}` : ''} · <i className="bi bi-clock" /> {formatTime(booking.startAtUtc)}</p><b>{formatMoney(booking.dealPriceVnd)}</b></div><div className="booking-actions d-flex flex-column align-items-end gap-2"><button type="button" className="booking-qr-thumb" onClick={() => setSelectedBookingForTicket(booking)} title="Nhấp để phóng to vé điện tử & QR"><QRCodeSVG value={booking.publicCode} size={42} /></button><code>{booking.publicCode}</code>{booking.status === 0 && <button onClick={() => cancel(booking)} className="btn btn-outline-danger btn-sm rounded-pill">Hủy chỗ</button>}</div></article>)}</div> : <div className="empty-state"><i className="bi bi-calendar-heart" /><h3>Chưa có lịch nào</h3><NavLink className="btn btn-primary rounded-pill" to="/">Khám phá slot ngay</NavLink></div>}{selectedBookingForTicket && (<div className="confirm-modal-backdrop" onClick={() => setSelectedBookingForTicket(null)} role="dialog" aria-modal="true"><div className="confirm-modal-body p-0" style={{ maxWidth: '520px', background: 'transparent', border: 'none' }} onClick={(e) => e.stopPropagation()}><div className="e-ticket-wrap"><div className="e-ticket-card"><div className="e-ticket-header"><div className="d-flex justify-content-between align-items-center"><span className="e-ticket-badge"><i className="bi bi-check-circle-fill" /> Vé điện tử OpenSlot</span><button type="button" className="btn-close btn-close-white" onClick={() => setSelectedBookingForTicket(null)} aria-label="Đóng" /></div><h3 className="e-ticket-title mt-2">{selectedBookingForTicket.serviceName}</h3><p className="e-ticket-venue mb-0"><i className="bi bi-building" /> {selectedBookingForTicket.venueName}</p></div><div className="e-ticket-tear-line"><div className="e-ticket-dashed" /></div><div className="e-ticket-body"><div className="e-ticket-qr-zone"><QRCodeSVG value={selectedBookingForTicket.publicCode} size={180} /><div className="mt-3 text-center"><small className="text-muted text-uppercase fw-bold">MÃ ĐẶT CHỖ</small><div className="e-ticket-pin-digits mt-1">{selectedBookingForTicket.publicCode}</div></div></div><div className="e-ticket-grid"><div className="e-ticket-field"><small>Thời gian</small><b>{formatSlotWindow(selectedBookingForTicket.startAtUtc, selectedBookingForTicket.endAtUtc)}</b></div><div className="e-ticket-field"><small>Giá deal</small><b className="text-coral">{formatMoney(selectedBookingForTicket.dealPriceVnd)}</b></div></div><div className="e-ticket-actions"><button type="button" onClick={() => window.print()} className="btn btn-outline-secondary rounded-pill px-4"><i className="bi bi-printer me-1" /> In vé</button><button type="button" onClick={() => setSelectedBookingForTicket(null)} className="btn btn-primary rounded-pill px-4">Đóng</button></div></div></div></div></div></div>)}{confirmModal && <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} variant={confirmModal.variant} loading={confirmLoading} onConfirm={async () => { try { setConfirmLoading(true); await confirmModal.onConfirm(); setConfirmModal(null) } catch (e) { setError(e instanceof Error ? e.message : 'Thao tác không thành công.'); setConfirmModal(null) } finally { setConfirmLoading(false) } }} onCancel={() => { if (!confirmLoading) setConfirmModal(null) }} />}</div>
}

function ProviderNavTabs({ activeTab }: { activeTab: 'slots' | 'setup' }) {
  return <nav className="provider-tabs" aria-label="Điều hướng đối tác">
    <NavLink to="/provider" end className={`provider-tab-btn ${activeTab === 'slots' ? 'active' : ''}`}>
      <i className="bi bi-clock-history" /> Quản lý slot & Check-in
    </NavLink>
    <NavLink to="/provider/setup" className={`provider-tab-btn ${activeTab === 'setup' ? 'active' : ''}`}>
      <i className="bi bi-shop" /> Thiết lập gian hàng
    </NavLink>
  </nav>
}

function ProviderPage({ session }: { session: Session }) {
  const [slots, setSlots] = useState<ProviderSlot[]>([]); const [services, setServices] = useState<ProviderService[]>([]); const [resources, setResources] = useState<ProviderResource[]>([]); const [profile, setProfile] = useState<MyProviderProfile | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(true); const [showForm, setShowForm] = useState(false)
  const [detailSlot, setDetailSlot] = useState<ProviderSlot | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; variant?: 'danger' | 'warning' | 'primary'; onConfirm: () => Promise<void> } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastRefreshTime = useRef(0)

  // oxlint-disable-next-line react/set-state-in-effect -- loading belongs to the request lifecycle
  const refresh = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    return Promise.all([
      api.providerSlots(session.accessToken, { signal: controller.signal }),
      api.providerServices(session.accessToken, { signal: controller.signal }),
      api.providerResources(session.accessToken, { signal: controller.signal }),
      api.providerProfile(session.accessToken, { signal: controller.signal })
    ]).then(([slotData, serviceData, resourceData, profileData]) => {
      if (isMountedRef.current && !controller.signal.aborted) {
        setSlots(slotData)
        setServices(serviceData)
        setResources(resourceData)
        setProfile(profileData)
      }
    }).catch((e: Error) => {
      if (!controller.signal.aborted && isMountedRef.current) setError(e.message)
    }).finally(() => {
      if (isMountedRef.current && !controller.signal.aborted) setLoading(false)
    })
  }, [session.accessToken])

  // oxlint-disable-next-line react/set-state-in-effect -- provider data is loaded from an external request lifecycle.
  useEffect(() => {
    isMountedRef.current = true
    void refresh()
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [refresh])

  useSlotAvailability(useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshTime.current < 2000) return
    lastRefreshTime.current = now
    void refresh()
  }, [refresh]))
  const publish = async (id: string) => { if (profile?.status !== 1) { setError('Hồ sơ cửa hàng đang chờ Manager duyệt nên chưa thể phát hành slot.'); return }; try { await api.publishProviderSlot(id, session.accessToken); setNotice('Slot đã được phát hành.'); refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể phát hành slot.') } }
  const resubmit = async () => { try { await api.resubmitProviderProfile(session.accessToken); setNotice('Đã gửi lại hồ sơ để Manager xét duyệt.'); refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi lại hồ sơ.') } }

  const handleCancelSlot = (slot: ProviderSlot) => {
    setConfirmModal({
      isOpen: true,
      title: 'Dừng / Hủy slot',
      message: `Bạn có chắc muốn dừng / hủy slot "${slot.serviceName}" (${formatSlotWindow(slot.startAtUtc, slot.endAtUtc)})? Khách hàng sẽ không thể đặt chỗ cho slot này nữa.`,
      confirmText: 'Dừng / Hủy slot',
      variant: 'danger',
      onConfirm: async () => {
        await api.cancelProviderSlot(slot.id, session.accessToken)
        setNotice(`Đã dừng / hủy slot ${slot.serviceName}.`)
        refresh()
      }
    })
  }

  const handleRepublishSlot = (slot: ProviderSlot) => {
    setConfirmModal({
      isOpen: true,
      title: 'Đăng lại slot',
      message: `Mở lại và tiếp tục đăng bán slot "${slot.serviceName}" (${formatSlotWindow(slot.startAtUtc, slot.endAtUtc)})? Slot sẽ được mở công khai để khách hàng đặt chỗ.`,
      confirmText: 'Đăng lại ngay',
      variant: 'primary',
      onConfirm: async () => {
        await api.republishProviderSlot(slot.id, session.accessToken)
        setNotice(`Đã đăng lại slot ${slot.serviceName}.`)
        refresh()
      }
    })
  }

  const status = profile?.status
  const statusMessage = status === 2 ? 'Hồ sơ đối tác đang bị tạm khóa. Liên hệ quản trị viên để biết lý do và cách khôi phục tài khoản.' : ''
  return <div className="container dashboard"><p className="eyebrow">Khu vực đối tác</p><div className="provider-heading"><div><h1>Quản lý slot & Check-in</h1><p className="dashboard-copy">Mỗi slot phải gắn với một sân, bàn, ghế hoặc phòng cụ thể để không bị trùng lịch. Nhấp vào từng dòng để xem chi tiết slot.</p></div><button disabled={status === 2} onClick={() => setShowForm(!showForm)} className="btn btn-primary rounded-pill"><i className="bi bi-plus-lg" /> {showForm ? 'Đóng form' : 'Tạo slot'}</button></div><ProviderNavTabs activeTab="slots" />{status === 0 && <div className="provider-approval-banner pending"><i className="bi bi-hourglass-split" /><div><b>Hồ sơ cửa hàng đang chờ Manager duyệt</b><span>Bạn có thể hoàn thiện địa điểm, dịch vụ và slot nháp. Chỉ slot của hồ sơ đã duyệt mới được công khai.</span></div></div>}{status === 3 && <div className="provider-approval-banner rejected"><i className="bi bi-exclamation-diamond" /><div><b>Hồ sơ cần bổ sung trước khi hoạt động</b><span>Hãy rà soát thông tin cửa hàng, sau đó gửi lại để Manager xét duyệt.</span></div><button onClick={resubmit} className="btn btn-sm btn-outline-danger">Gửi lại xét duyệt</button></div>}{status === 2 && <div className="provider-approval-banner suspended"><i className="bi bi-lock" /><div><b>Hồ sơ đối tác đang bị tạm khóa</b><span>{statusMessage}</span></div></div>}{showForm && <ProviderSlotForm services={services} resources={resources} token={session.accessToken} onDone={() => { setShowForm(false); setNotice('Đã tạo slot nháp. Hãy phát hành khi hồ sơ được duyệt.'); refresh() }} onError={setError} />}{error && <div className="alert alert-danger">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}{loading && slots.length === 0 ? <TableSkeleton rows={4} columns={6} /> : <><div className="provider-table"><div className="table-head"><span>Dịch vụ / đơn vị</span><span>Thời gian</span><span>Giá deal</span><span>Trạng thái</span><span>Chỗ còn</span><span>Thao tác</span></div>{slots.map((slot) => {
    const isFuture = new Date(slot.startAtUtc).getTime() > Date.now()
    const canCancel = slot.status === 1 && slot.confirmedBookingCount === 0
    const canRepublish = (slot.status === 4 || slot.status === 0) && isFuture && status === 1
    return <div className="table-row" key={slot.id} onClick={() => setDetailSlot(slot)} style={{ cursor: 'pointer' }} title="Nhấp để xem chi tiết slot"><span><b>{slot.serviceName}</b><small>{slot.venueName} · {slot.resourceName}{slot.resourceCode ? ` (${slot.resourceCode})` : ''}</small></span><span>{formatSlotWindow(slot.startAtUtc, slot.endAtUtc)}</span><span><b>{formatMoney(slot.dealPriceVnd)}</b></span><span>{slot.status === 0 && <span className="os-badge os-badge-draft">Nháp</span>}{slot.status === 1 && <span className="os-badge os-badge-open">Đang mở</span>}{slot.status === 2 && <span className="os-badge os-badge-full">Kín chỗ</span>}{slot.status === 3 && <span className="os-badge os-badge-expired">Hết hạn</span>}{slot.status === 4 && <span className="os-badge os-badge-cancelled">Đã dừng / hủy</span>}</span><span>{Math.max(0, slot.capacity - slot.confirmedBookingCount - slot.activeHoldCount)}/{slot.capacity}{slot.activeHoldCount > 0 && <small className="slot-awaiting-approval"> · {slot.activeHoldCount} đang thanh toán</small>}</span><span className="d-flex gap-1 align-items-center" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => setDetailSlot(slot)} className="btn btn-sm btn-outline-info" title="Xem chi tiết slot"><i className="bi bi-eye" /></button>{slot.status === 0 && (status === 1 ? <button onClick={() => publish(slot.id)} className="btn btn-sm btn-outline-primary">Phát hành</button> : <small className="slot-awaiting-approval">Chờ duyệt</small>)}{canCancel && <button onClick={() => handleCancelSlot(slot)} className="btn btn-sm btn-outline-danger">Dừng / Hủy</button>}{slot.status === 1 && slot.confirmedBookingCount > 0 && <small className="text-muted">Đã có khách đặt</small>}{slot.status === 4 && canRepublish && <button onClick={() => handleRepublishSlot(slot)} className="btn btn-sm btn-outline-success">Đăng lại</button>}</span></div>
  })}</div><CheckInPanel token={session.accessToken} /></>}{detailSlot && <ProviderSlotDetailModal slot={detailSlot} onClose={() => setDetailSlot(null)} />}{confirmModal && <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} variant={confirmModal.variant} loading={confirmLoading} onConfirm={async () => { try { setConfirmLoading(true); await confirmModal.onConfirm(); setConfirmModal(null) } catch (e) { setError(e instanceof Error ? e.message : 'Thao tác không thành công.'); setConfirmModal(null) } finally { setConfirmLoading(false) } }} onCancel={() => { if (!confirmLoading) setConfirmModal(null) }} />}</div>
}

function ProviderSlotForm({ services, resources, token, onDone, onError }: { services: ProviderService[]; resources: ProviderResource[]; token: string; onDone: () => void; onError: (message: string) => void }) {
  const [serviceId, setServiceId] = useState(''); const [resourceId, setResourceId] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [originalPrice, setOriginalPrice] = useState(''); const [dealPrice, setDealPrice] = useState(''); const [capacity, setCapacity] = useState('1'); const [saving, setSaving] = useState(false)
  const selected = services.find((x) => x.id === serviceId); const matchingResources = resources.filter((x) => x.isActive && x.venueId === selected?.venueId); const selectedResource = matchingResources.find((x) => x.id === resourceId)
  const chooseService = (value: string) => { setServiceId(value); setResourceId(''); setCapacity('1') }
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!serviceId || !resourceId || !start || !end) return; const startAt = new Date(start); const endAt = new Date(end); if (endAt <= startAt) { onError('Giờ kết thúc phải sau giờ bắt đầu.'); return }; const originalPriceNum = Number(originalPrice); const dealPriceNum = Number(dealPrice); if (dealPriceNum >= originalPriceNum) { onError('Giá ưu đãi phải thấp hơn giá gốc.'); return }; const closesAt = new Date(startAt.getTime() - 15 * 60000); setSaving(true); try { await api.createProviderSlot({ serviceOfferingId: serviceId, bookableResourceId: resourceId, startAtUtc: startAt.toISOString(), endAtUtc: endAt.toISOString(), bookingOpensAtUtc: new Date().toISOString(), bookingClosesAtUtc: closesAt.toISOString(), originalPriceVnd: originalPriceNum, dealPriceVnd: dealPriceNum, capacity: Number(capacity) }, token); onDone() } catch (e) { onError(e instanceof Error ? e.message : 'Không thể tạo slot.') } finally { setSaving(false) } }
  return <form onSubmit={submit} className="provider-form"><h3>Tạo slot nháp</h3><p className="form-hint">Dịch vụ không có thời lượng cố định. Hãy nhập khung giờ trống thực tế của đơn vị để khách biết chính xác thời điểm có thể đặt.</p><label>Dịch vụ<select required value={serviceId} onChange={(e) => chooseService(e.target.value)}><option value="">Chọn dịch vụ</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.venueName}</option>)}</select></label><label>Chỗ nhận đặt (Sân, Bàn, Ghế, Phòng)<select required disabled={!selected} value={resourceId} onChange={(e) => setResourceId(e.target.value)}><option value="">{selected ? 'Chọn sân, bàn, ghế hoặc phòng' : 'Chọn dịch vụ trước'}</option>{matchingResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}{resource.code ? ` · ${resource.code}` : ''}{resource.floorOrZone ? ` · ${resource.floorOrZone}` : ''}</option>)}</select>{selected && !matchingResources.length && <small className="text-danger">Địa điểm này chưa có chỗ đặt nào. <NavLink to="/provider/setup" className="text-decoration-underline ms-1">Thêm chỗ đặt tại Thiết lập gian hàng</NavLink>.</small>}</label><label>Giờ bắt đầu<input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>Giờ kết thúc<input required type="datetime-local" min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} /></label><label>Giá gốc (VND)<input required min="1" type="number" list="slot-price-suggestions" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} /></label><label>Giá deal (VND)<input required min="1" type="number" list="slot-price-suggestions" value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} /></label><label>Số chỗ<input required min="1" max={selectedResource?.maxCapacity ?? 100} type="number" list="slot-capacity-suggestions" value={capacity} onChange={(e) => setCapacity(e.target.value)} />{selectedResource && <small>Tối đa {selectedResource.maxCapacity} chỗ cho {selectedResource.name}.</small>}</label><datalist id="slot-price-suggestions">{priceSuggestions.map((value) => <option value={value} key={value} />)}</datalist><datalist id="slot-capacity-suggestions">{capacitySuggestions.map((value) => <option value={value} key={value} />)}</datalist><button disabled={saving || !services.length || !resources.length || !resourceId} className="btn btn-primary rounded-pill">{saving ? 'Đang tạo...' : 'Lưu slot nháp'}</button><small>OpenSlot chặn hai slot trùng giờ trên cùng một đơn vị. Slot luôn đóng nhận đặt chỗ trước giờ bắt đầu tối thiểu 15 phút.</small></form>
}

function ProviderCatalogPanel({ token, onServicesChanged, onProfileLoaded }: { token: string; onServicesChanged: () => void; onProfileLoaded?: (profile: MyProviderProfile) => void }) {
  const [profile, setProfile] = useState<MyProviderProfile | null>(null); const [venues, setVenues] = useState<ProviderVenue[]>([]); const [resources, setResources] = useState<ProviderResource[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [services, setServices] = useState<ProviderService[]>([]); const [mode, setMode] = useState<'none' | 'profile' | 'venue' | 'resource' | 'service'>('none'); const [editingResource, setEditingResource] = useState<ProviderResource | null>(null); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; variant?: 'danger' | 'warning' | 'primary'; onConfirm: () => Promise<void> } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const load = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    return Promise.all([
      api.providerProfile(token, { signal: controller.signal }),
      api.providerVenues(token, { signal: controller.signal }),
      api.providerResources(token, { signal: controller.signal }),
      api.categories({ signal: controller.signal }),
      api.providerServices(token, { signal: controller.signal })
    ]).then(([profileData, venueData, resourceData, categoryData, serviceData]) => {
      if (isMountedRef.current && !controller.signal.aborted) {
        setProfile(profileData)
        onProfileLoaded?.(profileData)
        setVenues(venueData)
        setResources(resourceData)
        setCategories(categoryData)
        setServices(serviceData)
      }
    }).catch((e: Error) => {
      if (!controller.signal.aborted && isMountedRef.current) setError(e.message)
    })
  }, [token, onProfileLoaded])

  useEffect(() => {
    isMountedRef.current = true
    void load()
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [load])
  const success = (text: string) => { setMode('none'); setEditingResource(null); setError(''); setMessage(text); load(); onServicesChanged() }
  const deactivate = (resource: ProviderResource) => {
    setConfirmModal({
      isOpen: true,
      title: 'Ngưng sử dụng chỗ đặt',
      message: `Ngưng sử dụng chỗ đặt "${resource.name}"? Các slot đã phát hành của chỗ đặt này vẫn giữ nguyên, nhưng sẽ không thể tạo thêm slot mới.`,
      confirmText: 'Ngưng sử dụng',
      variant: 'danger',
      onConfirm: async () => {
        await api.deactivateProviderResource(resource.id, token)
        success(`Đã ngưng sử dụng chỗ đặt ${resource.name}.`)
      }
    })
  }
  const activate = (resource: ProviderResource) => {
    setConfirmModal({
      isOpen: true,
      title: 'Mở lại sử dụng chỗ đặt',
      message: `Mở lại và tiếp tục sử dụng chỗ đặt "${resource.name}"? Bạn sẽ có thể tạo và phát hành thêm các slot mới trên chỗ đặt này.`,
      confirmText: 'Mở lại sử dụng',
      variant: 'primary',
      onConfirm: async () => {
        await api.activateProviderResource(resource.id, token)
        success(`Đã mở lại sử dụng chỗ đặt ${resource.name}.`)
      }
    })
  }
  const isSuspended = profile?.status === 2
  const providerStatusText = profile?.status === 0 ? 'Chờ duyệt' : profile?.status === 1 ? 'Đã duyệt' : profile?.status === 2 ? 'Tạm khóa' : profile?.status === 3 ? 'Cần bổ sung' : 'Đang tải'
  return <section className="catalog-panel"><div className="admin-section-title"><div><h2>Hồ sơ, địa điểm và chỗ đặt</h2></div><div className="catalog-actions"><button disabled={isSuspended} onClick={() => { setEditingResource(null); setMode('profile') }} className="btn btn-sm btn-outline-secondary">Sửa hồ sơ</button><button disabled={isSuspended} onClick={() => { setEditingResource(null); setMode('venue') }} className="btn btn-sm btn-outline-secondary">Thêm địa điểm</button><button disabled={isSuspended} onClick={() => { setEditingResource(null); setMode('resource') }} className="btn btn-sm btn-outline-secondary">Thêm chỗ đặt</button><button disabled={isSuspended} onClick={() => { setEditingResource(null); setMode('service') }} className="btn btn-sm btn-outline-primary">Thêm dịch vụ</button></div></div>{error && <div className="alert alert-danger mt-3">{error}</div>}{message && <div className="alert alert-success mt-3">{message}</div>}<div className="catalog-summary"><article><small>Đối tác</small><b>{profile?.businessName ?? 'Đang tải...'}</b><span>{profile?.contactPhone}</span></article><article><small>Lĩnh vực kinh doanh</small><b>{profile?.categoryName ?? 'Chưa phân loại'}</b><span className="category-locked-badge"><i className="bi bi-shield-lock" /> Dịch vụ tự động khóa</span></article><article><small>Trạng thái hồ sơ</small><b>{providerStatusText}</b><span>{isSuspended ? 'Tạm dừng thao tác' : 'Manager quản lý xét duyệt'}</span></article><article><small>Địa điểm</small><b>{venues.length}</b><span>{venues.map((x) => x.name).join(', ') || 'Chưa có địa điểm'}</span></article><article><small>Chỗ có thể đặt (Sân/Bàn/Phòng)</small><b>{resources.filter((x) => x.isActive).length}</b><span>{resources.filter((x) => x.isActive).map((x) => x.name).join(', ') || 'Chưa có chỗ đặt'}</span></article></div>{resources.length > 0 && <div className="resource-list">{resources.map((resource) => <article key={resource.id} className={!resource.isActive ? 'inactive' : ''}><div><b>{resource.name}{resource.code ? ` · ${resource.code}` : ''}</b><span>{resource.venueName} · {resource.resourceType} · {resource.maxCapacity} chỗ{resource.floorOrZone ? ` · ${resource.floorOrZone}` : ''}{resource.positionDescription ? ` · ${resource.positionDescription}` : ''}</span></div><div className="d-flex align-items-center gap-2"><button disabled={isSuspended} onClick={() => { setEditingResource(resource); setMode('resource') }} className="btn btn-sm btn-outline-secondary" title="Sửa thông tin chỗ đặt"><i className="bi bi-pencil" /> Sửa</button>{resource.isActive ? <button disabled={isSuspended} onClick={() => deactivate(resource)} className="btn btn-sm btn-outline-danger">Ngưng sử dụng</button> : <button disabled={isSuspended} onClick={() => activate(resource)} className="btn btn-sm btn-outline-success">Mở lại sử dụng</button>}</div></article>)}</div>}{mode === 'profile' && profile && <ProviderProfileForm profile={profile} token={token} categories={categories} onDone={() => success('Đã cập nhật hồ sơ đối tác.')} onError={setError} />}{mode === 'venue' && <VenueForm token={token} onDone={() => success('Đã thêm địa điểm.')} onError={setError} />}{mode === 'resource' && <ResourceForm key={editingResource ? editingResource.id : 'new-resource'} token={token} venues={venues} services={services} categories={categories} initialResource={editingResource} onDone={() => success(editingResource ? `Đã cập nhật chỗ đặt ${editingResource.name}.` : 'Đã thêm chỗ đặt.')} onError={setError} onCancel={() => { setMode('none'); setEditingResource(null) }} />}{mode === 'service' && <ServiceForm token={token} venues={venues} categories={categories} profile={profile} onDone={() => success('Đã thêm dịch vụ.')} onError={setError} />}{confirmModal && <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} variant={confirmModal.variant} loading={confirmLoading} onConfirm={async () => { try { setConfirmLoading(true); await confirmModal.onConfirm(); setConfirmModal(null) } catch (e) { setError(e instanceof Error ? e.message : 'Thao tác không thành công.'); setConfirmModal(null) } finally { setConfirmLoading(false) } }} onCancel={() => { if (!confirmLoading) setConfirmModal(null) }} />}</section>
}

function ProviderSetupPage({ session }: { session: Session }) {
  const [profile, setProfile] = useState<MyProviderProfile | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const refreshProfile = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    return api.providerProfile(session.accessToken, { signal: controller.signal })
      .then((data) => {
        if (isMountedRef.current && !controller.signal.aborted) setProfile(data)
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted && isMountedRef.current) setError(e.message)
      })
  }, [session.accessToken])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const resubmit = async () => {
    try {
      await api.resubmitProviderProfile(session.accessToken)
      if (isMountedRef.current) setNotice('Đã gửi lại hồ sơ để Manager xét duyệt.')
      void refreshProfile()
    } catch (e) {
      if (isMountedRef.current) setError(e instanceof Error ? e.message : 'Không thể gửi lại hồ sơ.')
    }
  }

  const status = profile?.status
  const statusMessage = status === 2 ? 'Hồ sơ đối tác đang bị tạm khóa. Liên hệ quản trị viên để biết lý do và cách khôi phục tài khoản.' : ''

  return <div className="container dashboard">
    <p className="eyebrow">Khu vực đối tác</p>
    <div className="provider-heading">
      <div>
        <h1>Thiết lập gian hàng</h1>
        <p className="dashboard-copy">Cấu hình thông tin hồ sơ doanh nghiệp, địa điểm cơ sở, chỗ nhận đặt (sân, bàn, ghế, phòng) và danh mục dịch vụ.</p>
      </div>
    </div>
    <ProviderNavTabs activeTab="setup" />
    {status === 0 && <div className="provider-approval-banner pending"><i className="bi bi-hourglass-split" /><div><b>Hồ sơ cửa hàng đang chờ Manager duyệt</b><span>Bạn có thể hoàn thiện địa điểm, dịch vụ và chỗ nhận đặt. Khi hồ sơ được duyệt, các slot của cửa hàng sẽ công khai.</span></div></div>}
    {status === 3 && <div className="provider-approval-banner rejected"><i className="bi bi-exclamation-diamond" /><div><b>Hồ sơ cần bổ sung trước khi hoạt động</b><span>Hãy rà soát thông tin cửa hàng, sau đó gửi lại để Manager xét duyệt.</span></div><button onClick={resubmit} className="btn btn-sm btn-outline-danger">Gửi lại xét duyệt</button></div>}
    {status === 2 && <div className="provider-approval-banner suspended"><i className="bi bi-lock" /><div><b>Hồ sơ đối tác đang bị tạm khóa</b><span>{statusMessage}</span></div></div>}
    {error && <div className="alert alert-danger">{error}</div>}
    {notice && <div className="alert alert-success">{notice}</div>}
    <ProviderCatalogPanel token={session.accessToken} onServicesChanged={refreshProfile} onProfileLoaded={setProfile} />
  </div>
}

function ProviderProfileForm({ profile, token, categories, onDone, onError }: { profile: MyProviderProfile; token: string; categories?: Category[]; onDone: () => void; onError: (message: string) => void }) {
  const [businessName, setBusinessName] = useState(profile.businessName); const [contactPhone, setContactPhone] = useState(profile.contactPhone); const [description, setDescription] = useState(profile.description ?? ''); const [categoryId, setCategoryId] = useState(profile.categoryId ? String(profile.categoryId) : ''); const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!isValidPhone(contactPhone)) { onError('Số điện thoại không hợp lệ, vui lòng nhập lại.'); return }; try { await api.updateProviderProfile({ businessName, contactPhone, description, categoryId: categoryId ? Number(categoryId) : undefined }, token); onDone() } catch (e) { onError(e instanceof Error ? e.message : 'Không thể cập nhật hồ sơ.') } }
  return <form className="provider-form catalog-form" onSubmit={submit}>
    <h3>Sửa hồ sơ đối tác</h3>
    <label><span>Tên doanh nghiệp</span><input required name="organization" autoComplete="organization" minLength={2} maxLength={160} value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label>
    <label><span>Số điện thoại</span><input required name="tel" type="tel" autoComplete="tel" inputMode="numeric" minLength={10} maxLength={10} pattern="0[0-9]{9}" title="Gồm đúng 10 chữ số và bắt đầu bằng số 0" value={contactPhone} onChange={(e) => setContactPhone(normalizePhone(e.target.value))} /><small className="form-hint">Gồm đúng 10 chữ số và bắt đầu bằng số 0.</small></label>
    {categories && categories.length > 0 && (
      <label>
        <span>Lĩnh vực kinh doanh</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{profile.categoryName ? `Hiện tại: ${profile.categoryName}` : '-- Chọn danh mục kinh doanh --'}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <small className="form-hint">{profile.categoryName ? `Lĩnh vực đã khóa: ${profile.categoryName}` : 'Chọn danh mục kinh doanh chính cho cửa hàng.'}</small>
      </label>
    )}
    <label><span>Mô tả</span><input maxLength={2000} list="profile-description-suggestions" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <datalist id="profile-description-suggestions">{descriptionSuggestions.map((value) => <option value={value} key={value} />)}</datalist>
    <button className="btn btn-primary rounded-pill">Lưu hồ sơ</button>
  </form>
}

function VenueForm({ token, onDone, onError }: { token: string; onDone: () => void; onError: (message: string) => void }) {
  const [name, setName] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [previewLocation, setPreviewLocation] = useState<GeocodedLocation | null>(null)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const resolveAddress = async () => {
    const requestedAddress = addressLine.trim()
    if (requestedAddress.length < 5) { setLookupError('Hãy nhập địa chỉ cụ thể trước khi xem trên bản đồ.'); return null }
    setResolving(true); setLookupError('')
    try {
      const location = await api.geocodeLocation(requestedAddress)
      if (!location) { setPreviewLocation(null); setLookupError('Không tìm thấy địa chỉ. Hãy thêm số nhà, đường/phường và tỉnh thành.'); return null }
      setPreviewLocation(location)
      return location
    } catch {
      setPreviewLocation(null); setLookupError('Dịch vụ bản đồ đang bận. Hãy thử lại sau ít phút.'); return null
    } finally { setResolving(false) }
  }
  const openMap = async () => {
    setIsMapOpen(true)
    if (addressLine.trim()) await resolveAddress()
  }
  const pickLocationFromMap = async (latitude: number, longitude: number) => {
    setResolving(true); setLookupError('')
    setPreviewLocation({ label: 'Đang xác định địa chỉ...', latitude, longitude })
    try {
      const location = await api.reverseGeocodeLocation(latitude, longitude)
      if (!location) { setLookupError('Không thể tìm địa chỉ của điểm này. Hãy chọn lại một vị trí gần đường hoặc địa điểm cụ thể.'); return }
      setPreviewLocation(location)
      setAddressLine(location.label)
    } catch {
      setLookupError('Dịch vụ bản đồ đang bận. Marker vẫn được giữ; hãy nhấp lại để lấy địa chỉ.');
    } finally { setResolving(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const location = previewLocation ?? await resolveAddress()
      if (!location) { onError('Không thể lưu vì chưa xác định được vị trí trên bản đồ.'); return }
      await api.createProviderVenue({ name, addressLine: addressLine.trim(), district: location.district ?? location.city ?? 'Khu vực chưa xác định', city: location.city ?? 'Việt Nam', latitude: location.latitude, longitude: location.longitude }, token)
      onDone()
    } catch (e) { onError(e instanceof Error ? e.message : 'Không thể thêm địa điểm.') } finally { setSaving(false) }
  }
  const updateAddress = (value: string) => { setAddressLine(value); setPreviewLocation(null); setLookupError('') }
  return <form className="provider-form catalog-form venue-form" onSubmit={submit}><h3>Thêm địa điểm</h3><label>Tên địa điểm<input required minLength={2} list="venue-name-suggestions" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Sân cầu lông ABC" /></label><label>Địa chỉ cụ thể<input required minLength={5} name="street-address" autoComplete="street-address" list="address-suggestions" value={addressLine} onChange={(e) => updateAddress(e.target.value)} placeholder="Hoặc chọn trực tiếp trên bản đồ" /></label><div className="venue-form-actions"><button type="button" disabled={resolving || saving} onClick={openMap} className="btn btn-outline-primary rounded-pill">{resolving ? 'Đang tìm vị trí...' : 'Chọn trên bản đồ'}</button><button disabled={saving || resolving} className="btn btn-primary rounded-pill">{saving ? 'Đang lưu...' : 'Lưu địa điểm'}</button></div><datalist id="venue-name-suggestions">{venueNameSuggestions.map((value) => <option value={value} key={value} />)}</datalist><datalist id="address-suggestions">{addressSuggestions.map((value) => <option value={value} key={value} />)}</datalist>{lookupError && <div className="venue-map-error">{lookupError}</div>}{isMapOpen && <VenueLocationPickerMap location={previewLocation} venueName={name || 'Địa điểm mới'} resolving={resolving} onPick={pickLocationFromMap} /> }<small>Nhấn “Chọn trên bản đồ”, sau đó nhấp vào vị trí mong muốn. OpenSlot sẽ tự điền địa chỉ cụ thể và tọa độ.</small></form>
}

function VenueMapClickHandler({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) })
  return null
}

function VenueLocationPickerMap({ location, venueName, resolving, onPick }: { location: GeocodedLocation | null; venueName: string; resolving: boolean; onPick: (latitude: number, longitude: number) => void }) {
  const point = location ? [location.latitude, location.longitude] as [number, number] : null
  const center = point ?? [21.0285, 105.8542] as [number, number]
  return <section className="venue-map-preview"><div className="venue-map-heading"><div><b><i className="bi bi-geo-alt-fill" /> {resolving ? 'Đang xác định địa chỉ...' : point ? 'Vị trí đã chọn' : 'Nhấp vào bản đồ để chọn vị trí'}</b><span>{point ? location?.label : 'Kéo hoặc phóng to bản đồ, sau đó nhấp vào đúng vị trí địa điểm.'}</span></div><small>{point ? (location?.district ?? location?.city ?? 'Việt Nam') : 'Mặc định: Hà Nội'}</small></div><MapContainer key={point ? `${point[0]}-${point[1]}` : 'hanoi-picker'} center={center} zoom={point ? 16 : 13} scrollWheelZoom className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><VenueMapClickHandler onPick={onPick} />{point && <CircleMarker center={point} radius={12} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#ee7158', fillOpacity: 1 }}><Popup><b>{venueName}</b><br />{location?.label}</Popup></CircleMarker>}</MapContainer></section>
}

const CATEGORY_RESOURCE_TYPES: Record<string, string[]> = {
  sports: ['Sân', 'Phòng tập', 'Bàn bida'],
  beauty: ['Ghế gội', 'Giường massage', 'Phòng spa'],
  workspace: ['Bàn làm việc', 'Phòng họp', 'Khu ngồi chung', 'Phòng riêng'],
  food: ['Bàn', 'Khu vực ngồi', 'Phòng riêng'],
  coffee: ['Bàn', 'Khu vực ngồi', 'Phòng riêng'],
  entertainment: ['Phòng karaoke', 'Bàn chơi game', 'Khu vui chơi'],
  creative: ['Phòng studio', 'Phòng podcast', 'Phòng chụp ảnh', 'Khu vực quay phim'],
  utilities: ['Phòng', 'Khu vực', 'Slot thời gian'],
}

const DEFAULT_RESOURCE_TYPES = ['Sân', 'Phòng', 'Bàn', 'Ghế', 'Khu vực', 'Thiết bị']

function getResourceTypesForCategory(slugOrName?: string): string[] {
  if (!slugOrName) return DEFAULT_RESOURCE_TYPES
  const lower = slugOrName.toLowerCase()
  for (const [key, types] of Object.entries(CATEGORY_RESOURCE_TYPES)) {
    if (lower.includes(key)) return types
  }
  if (lower.includes('thể thao') || lower.includes('sport')) return CATEGORY_RESOURCE_TYPES.sports
  if (lower.includes('làm đẹp') || lower.includes('spa') || lower.includes('beauty')) return CATEGORY_RESOURCE_TYPES.beauty
  if (lower.includes('việc') || lower.includes('work') || lower.includes('họp')) return CATEGORY_RESOURCE_TYPES.workspace
  if (lower.includes('ăn') || lower.includes('cà phê') || lower.includes('food') || lower.includes('cafe')) return CATEGORY_RESOURCE_TYPES.food
  if (lower.includes('giải trí') || lower.includes('game')) return CATEGORY_RESOURCE_TYPES.entertainment
  if (lower.includes('sáng tạo') || lower.includes('ảnh') || lower.includes('studio')) return CATEGORY_RESOURCE_TYPES.creative
  if (lower.includes('tiện ích') || lower.includes('util')) return CATEGORY_RESOURCE_TYPES.utilities
  return DEFAULT_RESOURCE_TYPES
}

function getResourceTypeSymbol(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('sân') || lower.includes('bóng') || lower.includes('vợt')) return '🏸'
  if (lower.includes('tập') || lower.includes('gym')) return '🏋️'
  if (lower.includes('bida') || lower.includes('bi-a')) return '🎱'
  if (lower.includes('massage') || lower.includes('spa')) return '💆'
  if (lower.includes('gội') || lower.includes('tóc')) return '💇'
  if (lower.includes('móng') || lower.includes('nail')) return '💅'
  if (lower.includes('làm việc') || lower.includes('ghế')) return '💻'
  if (lower.includes('họp') || lower.includes('phòng riêng')) return '🚪'
  if (lower.includes('bàn') || lower.includes('ngồi') || lower.includes('ăn')) return '🍽️'
  if (lower.includes('karaoke') || lower.includes('hát')) return '🎤'
  if (lower.includes('game') || lower.includes('chơi')) return '🎮'
  if (lower.includes('studio') || lower.includes('ảnh') || lower.includes('phim')) return '📸'
  if (lower.includes('podcast') || lower.includes('thu âm')) return '🎙️'
  if (lower.includes('thời gian') || lower.includes('slot')) return '⏱️'
  if (lower.includes('thiết bị') || lower.includes('máy')) return '🛠️'
  return '🏷️'
}

function ResourceForm({ token, venues, services, categories, initialResource, onDone, onError, onCancel }: { token: string; venues: ProviderVenue[]; services: ProviderService[]; categories: Category[]; initialResource?: ProviderResource | null; onDone: () => void; onError: (message: string) => void; onCancel?: () => void }) {
  const [venueId, setVenueId] = useState(initialResource?.venueId ?? ''); const [serviceId, setServiceId] = useState(''); const [categorySlug, setCategorySlug] = useState(''); const [name, setName] = useState(initialResource?.name ?? ''); const [resourceType, setResourceType] = useState(initialResource?.resourceType ?? ''); const [code, setCode] = useState(initialResource?.code ?? ''); const [floorOrZone, setFloorOrZone] = useState(initialResource?.floorOrZone ?? ''); const [positionDescription, setPositionDescription] = useState(initialResource?.positionDescription ?? ''); const [maxCapacity, setMaxCapacity] = useState(String(initialResource?.maxCapacity ?? '1')); const [isActive, setIsActive] = useState(initialResource?.isActive ?? true); const [saving, setSaving] = useState(false)
  const availableServices = services.filter((s) => !venueId || s.venueId === venueId)
  const selectedService = availableServices.find((s) => s.id === serviceId)
  const activeCategorySlug = selectedService?.categorySlug ?? categorySlug
  const recommendedTypes = getResourceTypesForCategory(activeCategorySlug)
  const onVenueChange = (val: string) => { setVenueId(val); if (serviceId) { const s = services.find((x) => x.id === serviceId); if (s && s.venueId !== val) setServiceId('') } }
  const onServiceChange = (val: string) => { setServiceId(val); if (val) { const s = services.find((x) => x.id === val); if (s?.categorySlug) setCategorySlug(s.categorySlug); if (s?.venueId && !venueId) setVenueId(s.venueId) } }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (initialResource) {
        await api.updateProviderResource(initialResource.id, { venueId, name, resourceType: resourceType.trim() || 'Chỗ đặt', code: code || null, floorOrZone: floorOrZone || null, positionDescription: positionDescription || null, maxCapacity: Number(maxCapacity), isActive }, token)
      } else {
        await api.createProviderResource({ venueId, name, resourceType: resourceType.trim() || 'Chỗ đặt', code: code || null, floorOrZone: floorOrZone || null, positionDescription: positionDescription || null, maxCapacity: Number(maxCapacity), isActive }, token)
      }
      onDone()
    } catch (e) {
      onError(e instanceof Error ? e.message : (initialResource ? 'Không thể cập nhật chỗ đặt.' : 'Không thể thêm chỗ đặt.'))
    } finally {
      setSaving(false)
    }
  }
  return <form className="provider-form catalog-form" onSubmit={submit}>
    <h3>{initialResource ? `Sửa chỗ đặt: ${initialResource.name}` : 'Thêm chỗ đặt (Sân, Bàn, Ghế, Phòng...)'}</h3>
    <p className="form-hint">Khai báo từng sân, bàn, ghế hoặc phòng cụ thể. Đây là vị trí thực tế khách sẽ sử dụng khi check-in.</p>
    <label><span>Địa điểm</span><select required value={venueId} onChange={(e) => onVenueChange(e.target.value)}><option value="">Chọn địa điểm</option>{venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}</select></label>
    {availableServices.length > 0 ? (
      <label><span>Dịch vụ liên quan (lọc gợi ý loại chỗ)</span><select value={serviceId} onChange={(e) => onServiceChange(e.target.value)}><option value="">Tất cả dịch vụ / Chọn để nhận gợi ý chính xác</option>{availableServices.map((svc) => <option value={svc.id} key={svc.id}>{svc.name}{svc.categoryName ? ` (${svc.categoryName})` : ''}</option>)}</select></label>
    ) : (
      <label><span>Nhóm ngành / Danh mục dịch vụ</span><select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}><option value="">Chọn danh mục để xem gợi ý phù hợp</option>{categories.map((cat) => <option value={cat.slug} key={cat.id}>{cat.name}</option>)}</select></label>
    )}
    <label>
      <span>Loại chỗ đặt (Sân, Bàn, Phòng...)</span>
      <input required minLength={2} list="resource-type-suggestions" value={resourceType} onChange={(e) => setResourceType(e.target.value)} placeholder="Ví dụ: Sân cầu lông, Ghế massage..." />
      <div className="resource-suggestions-row">
        <small className="form-hint me-1">Gợi ý:</small>
        {recommendedTypes.map((type) => (
          <button type="button" key={type} className={`resource-tag-pill ${resourceType === type ? 'active' : ''}`} onClick={() => setResourceType(type)}>
            <span className="me-1">{getResourceTypeSymbol(type)}</span>
            {type}
          </button>
        ))}
      </div>
    </label>
    <label><span>Tên chỗ đặt</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Sân số 2, Bàn C-08, Ghế số 1" /></label>
    <label><span>Mã nhận diện (nếu có)</span><input maxLength={60} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ví dụ: S2, B-08, P01" /></label>
    <label><span>Tầng / khu vực</span><input maxLength={100} value={floorOrZone} onChange={(e) => setFloorOrZone(e.target.value)} placeholder="Ví dụ: Tầng 2, Khu A" /></label>
    <label><span>Vị trí chi tiết</span><input maxLength={255} value={positionDescription} onChange={(e) => setPositionDescription(e.target.value)} placeholder="Ví dụ: Gần cửa sổ, cạnh lối đi" /></label>
    <label><span>Sức chứa tối đa (người)</span><input required min="1" max="100" type="number" list="resource-capacity-suggestions" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} /></label>
    {initialResource && (
      <label className="d-flex align-items-center gap-2 mb-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span><b>Đang mở sử dụng (kích hoạt)</b></span>
      </label>
    )}
    <datalist id="resource-type-suggestions">{recommendedTypes.map((value) => <option value={value} key={value} />)}</datalist>
    <datalist id="resource-capacity-suggestions">{capacitySuggestions.map((value) => <option value={value} key={value} />)}</datalist>
    <div className="d-flex gap-2 align-items-center">
      <button disabled={saving || !venues.length} className="btn btn-primary rounded-pill">{saving ? 'Đang lưu...' : (initialResource ? 'Cập nhật chỗ đặt' : 'Lưu chỗ đặt')}</button>
      {onCancel && <button type="button" disabled={saving} onClick={onCancel} className="btn btn-outline-secondary rounded-pill">Hủy</button>}
    </div>
    {!venues.length && <small>Hãy tạo địa điểm trước.</small>}
  </form>
}

function ServiceForm({ token, venues, categories, profile, onDone, onError }: { token: string; venues: ProviderVenue[]; categories: Category[]; profile?: MyProviderProfile | null; onDone: () => void; onError: (message: string) => void }) {
  const lockedCategoryId = profile?.categoryId ? String(profile.categoryId) : ''
  const [venueId, setVenueId] = useState(''); const [categoryId, setCategoryId] = useState(lockedCategoryId); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [basePrice, setBasePrice] = useState(''); const [imageUrl, setImageUrl] = useState(''); const [saving, setSaving] = useState(false)
  const activeCategoryId = lockedCategoryId || categoryId
  const selectedCategory = categories.find((category) => String(category.id) === activeCategoryId)
  const automaticImage = defaultServiceImage(selectedCategory?.slug ?? profile?.categorySlug ?? 'workspace', name || selectedCategory?.name || 'OpenSlot')
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!activeCategoryId) { onError('Vui lòng chọn danh mục cho dịch vụ.'); return }; const suppliedImage = imageUrl.trim(); if (suppliedImage) { if (!suppliedImage.startsWith('https://')) { onError('Link ảnh cần bắt đầu bằng https:// để hiển thị an toàn.'); return }; try { const url = new URL(suppliedImage); if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^(10|127|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\./.test(url.hostname)) { onError('Link ảnh không được trỏ đến địa chỉ nội bộ hoặc localhost.'); return } } catch { onError('Link ảnh không hợp lệ.'); return } }; setSaving(true); try { await api.createProviderService({ venueId, categoryId: Number(activeCategoryId), name, description, basePriceVnd: Number(basePrice), imageUrl: suppliedImage || automaticImage }, token); onDone() } catch (e) { onError(e instanceof Error ? e.message : 'Không thể thêm dịch vụ.') } finally { setSaving(false) } }
  return <form className="provider-form catalog-form" onSubmit={submit}><h3>Thêm dịch vụ</h3><p className="form-hint">Ảnh thuộc về dịch vụ; mọi slot tạo từ dịch vụ này sẽ tự dùng cùng ảnh. Nếu không nhập, OpenSlot tự gán ảnh theo danh mục.</p><label>Địa điểm<select required value={venueId} onChange={(e) => setVenueId(e.target.value)}><option value="">Chọn địa điểm</option>{venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}</select></label>{lockedCategoryId ? <label><span>Danh mục dịch vụ <span className="category-locked-badge"><i className="bi bi-lock-fill" /> Đã khóa theo cửa hàng</span></span><input type="text" readOnly disabled value={profile?.categoryName || selectedCategory?.name || 'Danh mục đã khóa'} /></label> : <label>Danh mục<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Chọn danh mục</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>}<label>Tên dịch vụ<input required minLength={2} list="service-form-suggestions" value={name} onChange={(e) => setName(e.target.value)} /></label><label>Mô tả<input maxLength={2000} list="service-description-suggestions" value={description} onChange={(e) => setDescription(e.target.value)} /></label><label>Giá niêm yết tham khảo (VND)<input required type="number" min="1" list="service-price-suggestions" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></label><label>Link ảnh đại diện (không bắt buộc)<input type="url" inputMode="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /><small>{imageUrl.trim() ? 'Ảnh này sẽ hiển thị cho mọi slot của dịch vụ.' : 'Chưa có ảnh riêng: OpenSlot sẽ tự gán ảnh theo danh mục.'}</small></label><datalist id="service-form-suggestions">{popularServiceSearches.map((value) => <option value={value} key={value} />)}</datalist><datalist id="service-description-suggestions">{descriptionSuggestions.map((value) => <option value={value} key={value} />)}</datalist><datalist id="service-price-suggestions">{priceSuggestions.map((value) => <option value={value} key={value} />)}</datalist><button disabled={saving || !venues.length} className="btn btn-primary rounded-pill">{saving ? 'Đang lưu...' : 'Lưu dịch vụ'}</button>{!venues.length && <small>Hãy tạo địa điểm trước khi thêm dịch vụ.</small>}</form>
}

function CheckInPanel({ token }: { token: string }) {
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handlePinChange = (val: string) => {
    setPin(val.replace(/\D/g, '').slice(0, 6))
  }

  const checkIn = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!/^[A-Z0-9-]{10,15}$/.test(code.trim())) {
      setMessage('Mã booking không hợp lệ.')
      toast.error('Mã booking không hợp lệ.')
      return
    }
    if (!/^\d{6}$/.test(pin.trim())) {
      setMessage('PIN phải có đúng 6 chữ số.')
      toast.error('PIN phải có đúng 6 chữ số.')
      return
    }
    setLoading(true)
    try {
      await api.checkIn(code.trim(), pin.trim(), token)
      setMessage('Check-in thành công! Giữ mã để hoàn tất dịch vụ khi khách trải nghiệm xong.')
      toast.success('Check-in khách thành công!')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Không thể check-in.'
      setMessage(errMsg)
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  const complete = async () => {
    setMessage('')
    if (!code.trim()) {
      setMessage('Nhập mã booking cần hoàn tất.')
      toast.warning('Vui lòng nhập mã booking trước.')
      return
    }
    setLoading(true)
    try {
      await api.completeBooking(code.trim(), token)
      setMessage('Dịch vụ đã được đánh dấu hoàn tất.')
      toast.success('Ca dịch vụ đã hoàn tất thành công!')
      setCode('')
      setPin('')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Không thể hoàn tất booking.'
      setMessage(errMsg)
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="enhanced-checkin-card">
      <div className="checkin-header-box">
        <div className="checkin-header-icon">
          <i className="bi bi-qr-code-scan" />
        </div>
        <div>
          <h3 className="m-0 fs-5 fw-bold text-dark">Điểm Check-in Khách hàng</h3>
          <p className="text-muted m-0 small">Nhập mã đặt chỗ OpenSlot và mã PIN 6 số của khách để xác nhận trải nghiệm.</p>
        </div>
      </div>
      <form onSubmit={checkIn} className="d-flex flex-wrap align-items-end gap-3">
        <div className="flex-grow-1" style={{ minWidth: '220px' }}>
          <label className="form-label small fw-bold text-muted mb-1">Mã Đặt Chỗ</label>
          <input
            required
            className="form-control"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="OS-XXXXXXXX"
            autoComplete="off"
          />
        </div>
        <div style={{ width: '180px' }}>
          <label className="form-label small fw-bold text-muted mb-1">Mã PIN (6 số)</label>
          <input
            required
            className="form-control text-center fw-bold fs-5"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            inputMode="numeric"
            placeholder="······"
            maxLength={6}
            autoComplete="off"
          />
        </div>
        <div className="d-flex gap-2">
          <button disabled={loading || !code || pin.length < 6} className="btn btn-primary rounded-pill px-4">
            <i className="bi bi-check2-circle me-1" /> Check-in
          </button>
          <button type="button" disabled={loading || !code} onClick={complete} className="btn btn-outline-success rounded-pill px-4">
            <i className="bi bi-flag-fill me-1" /> Hoàn tất ca
          </button>
        </div>
      </form>
      {message && <div className="mt-3 small text-muted"><i className="bi bi-info-circle me-1" /> {message}</div>}
    </div>
  )
}

type AdminTab = 'overview' | 'providers' | 'users' | 'catalog' | 'slots' | 'reports'

function AdminPage({ session, mode }: { session: Session; mode: 'admin' | 'manager' }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isAdmin = mode === 'admin'
  const toast = useToast()

  const rawTab = searchParams.get('tab') as AdminTab | null
  const activeTab: AdminTab = useMemo(() => {
    if (rawTab === 'users' && !isAdmin) return 'overview'
    if (rawTab && ['overview', 'providers', 'users', 'catalog', 'slots', 'reports'].includes(rawTab)) {
      return rawTab
    }
    return 'overview'
  }, [rawTab, isAdmin])

  const switchTab = (tab: AdminTab) => {
    setSearchParams({ tab }, { replace: true })
  }

  const [providers, setProviders] = useState<ProviderProfile[]>([])
  const [providerDetail, setProviderDetail] = useState<AdminProviderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [managedServices, setManagedServices] = useState<AdminService[]>([])
  const [managedSlots, setManagedSlots] = useState<AdminSlot[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [stats, setStats] = useState<AdminDashboard | null>(null)
  const [filter, setFilter] = useState<number | undefined>()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({})
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({})
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string | React.ReactNode
    confirmText?: string
    variant?: 'danger' | 'warning' | 'primary'
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const [providerSearch, setProviderSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [slotSearch, setSlotSearch] = useState('')
  const [reportSearch, setReportSearch] = useState('')

  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [selectedReports, setSelectedReports] = useState<string[]>([])

  const loadStats = useCallback(async () => {
    try {
      const dashboardData = await api.adminDashboard(session.accessToken)
      setStats(dashboardData)
    } catch {
      // ignore background stats load error
    }
  }, [session.accessToken])

  const fetchTabData = useCallback(async (tab: AdminTab, force = false) => {
    if (!force && loadedTabs[tab]) return
    setTabLoading((prev) => ({ ...prev, [tab]: true }))
    try {
      if (tab === 'overview') {
        await loadStats()
      } else if (tab === 'providers') {
        const providerData = await api.adminProviders(session.accessToken, filter)
        setProviders(providerData)
      } else if (tab === 'users') {
        if (isAdmin) {
          const userData = await api.adminUsers(session.accessToken)
          setUsers(userData)
        }
      } else if (tab === 'catalog') {
        const serviceData = await api.adminServices(session.accessToken)
        setManagedServices(serviceData)
      } else if (tab === 'slots') {
        const slotData = await api.adminSlots(session.accessToken)
        setManagedSlots(slotData)
      } else if (tab === 'reports') {
        const reportData = await api.reports(session.accessToken)
        setReports(reportData)
      }
      setLoadedTabs((prev) => ({ ...prev, [tab]: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu phân hệ.')
    } finally {
      setTabLoading((prev) => ({ ...prev, [tab]: false }))
    }
  }, [session.accessToken, filter, isAdmin, loadedTabs, loadStats])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void fetchTabData(activeTab)
  }, [activeTab, fetchTabData])

  useEffect(() => {
    if (activeTab === 'providers') {
      void fetchTabData('providers', true)
    }
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchTabData(activeTab, true),
      loadStats()
    ])
  }, [activeTab, fetchTabData, loadStats])

  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return providers
    const q = normalizeSearch(providerSearch)
    return providers.filter((p) =>
      normalizeSearch(p.businessName).includes(q) ||
      normalizeSearch(p.ownerName).includes(q) ||
      normalizeSearch(p.ownerEmail).includes(q) ||
      normalizeSearch(p.contactPhone).includes(q) ||
      (p.description && normalizeSearch(p.description).includes(q))
    )
  }, [providers, providerSearch])

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = normalizeSearch(userSearch)
    return users.filter((u) =>
      normalizeSearch(u.displayName).includes(q) ||
      normalizeSearch(u.email).includes(q) ||
      u.roles.some((r) => normalizeSearch(roleLabel([r])).includes(q) || normalizeSearch(r).includes(q))
    )
  }, [users, userSearch])

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return managedServices
    const q = normalizeSearch(serviceSearch)
    return managedServices.filter((s) =>
      normalizeSearch(s.name).includes(q) ||
      normalizeSearch(s.providerName).includes(q) ||
      (s.categoryName && normalizeSearch(s.categoryName).includes(q)) ||
      (s.venueName && normalizeSearch(s.venueName).includes(q))
    )
  }, [managedServices, serviceSearch])

  const filteredSlots = useMemo(() => {
    if (!slotSearch.trim()) return managedSlots
    const q = normalizeSearch(slotSearch)
    return managedSlots.filter((s) =>
      normalizeSearch(s.serviceName).includes(q) ||
      normalizeSearch(s.venueName).includes(q) ||
      normalizeSearch(s.providerName).includes(q)
    )
  }, [managedSlots, slotSearch])

  const filteredReports = useMemo(() => {
    if (!reportSearch.trim()) return reports
    const q = normalizeSearch(reportSearch)
    return reports.filter((r) =>
      normalizeSearch(r.targetType).includes(q) ||
      normalizeSearch(r.targetId).includes(q) ||
      normalizeSearch(r.reporterName).includes(q) ||
      normalizeSearch(r.reporterEmail).includes(q) ||
      normalizeSearch(r.reason).includes(q)
    )
  }, [reports, reportSearch])

  const update = async (provider: ProviderProfile, action: 'approve' | 'suspend' | 'reject') => { try { if (action === 'approve') await api.approveProvider(provider.id, session.accessToken); else if (action === 'reject') await api.rejectProvider(provider.id, session.accessToken); else await api.suspendProvider(provider.id, session.accessToken); const actionText = action === 'approve' ? 'duyệt' : action === 'reject' ? 'yêu cầu bổ sung hồ sơ' : 'tạm khóa'; setMessage(`${provider.businessName} đã được ${actionText}.`); refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật provider.') } }
  const resolve = async (report: Report) => { try { await api.resolveReport(report.id, 'Đã kiểm tra và xử lý bởi quản trị viên.', session.accessToken); setMessage('Báo cáo đã được xử lý.'); refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể xử lý báo cáo.') } }
  const toggleUser = async (user: AdminUser) => { try { if (user.isSuspended) await api.restoreUser(user.id, session.accessToken); else await api.suspendUser(user.id, session.accessToken); setMessage(`Đã ${user.isSuspended ? 'mở khóa' : 'tạm khóa'} tài khoản ${user.email}.`); refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật tài khoản.') } }
  const toggleManager = async (user: AdminUser) => { try { const targetIsManager = user.roles.includes('Manager'); if (targetIsManager) await api.revokeManager(user.id, session.accessToken); else await api.grantManager(user.id, session.accessToken); setMessage(`Đã ${targetIsManager ? 'thu hồi' : 'cấp'} quyền Manager cho ${user.email}.`); refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật quyền Manager.') } }
  const toggleService = async (service: AdminService) => { try { await api.setServiceActive(service.id, !service.isActive, session.accessToken); setMessage(`Đã ${service.isActive ? 'ẩn' : 'mở lại'} dịch vụ ${service.name}.`); refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật dịch vụ.') } }

  const deleteUser = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa vĩnh viễn tài khoản người dùng',
      message: (
        <div className="confirm-dialog-content">
          <p className="mb-2">
            Bạn có chắc muốn xóa vĩnh viễn tài khoản <b>{user.displayName}</b> ({user.email})?
          </p>
          <div className="alert alert-warning py-2 px-3 small mb-2">
            <i className="bi bi-exclamation-triangle-fill me-1 text-warning" />
            <strong>Lưu ý quan trọng:</strong> Hành động này sẽ xóa toàn bộ dữ liệu tài khoản và <u>không thể khôi phục</u>.
          </div>
          <p className="small text-secondary mb-0">
            • Thao tác chỉ thực hiện được khi tài khoản không còn bất kỳ lịch đặt chỗ (booking) hoặc phiên giữ chỗ nào đang hoạt động.<br />
            • Nếu bạn chỉ muốn vô hiệu hóa tài khoản tạm thời mà vẫn bảo lưu dữ liệu, hãy sử dụng tính năng <strong>Tạm khóa</strong>.
          </p>
        </div>
      ),
      confirmText: 'Xác nhận xóa vĩnh viễn',
      variant: 'danger',
      onConfirm: async () => {
        await api.adminDeleteUser(user.id, session.accessToken)
        setMessage(`Đã xóa vĩnh viễn tài khoản ${user.email} khỏi hệ thống.`)
        refresh()
      }
    })
  }

  const bulkDeleteUsers = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa hàng loạt tài khoản',
      message: (
        <div className="confirm-dialog-content">
          <p className="mb-2">
            Xác nhận xóa vĩnh viễn <b>{selectedUsers.length}</b> tài khoản đã chọn?
          </p>
          <div className="alert alert-warning py-2 px-3 small mb-2">
            <i className="bi bi-exclamation-triangle-fill me-1 text-warning" />
            <strong>Lưu ý:</strong> Dữ liệu tài khoản bị xóa sẽ không thể khôi phục. Hệ thống sẽ tự động bỏ qua tài khoản là Admin, chính bạn, hoặc đang có lịch đặt chỗ/giữ chỗ hoạt động.
          </div>
        </div>
      ),
      confirmText: 'Xóa các tài khoản đã chọn',
      variant: 'danger',
      onConfirm: async () => {
        const res = await api.bulkDeleteUsers(selectedUsers, session.accessToken)
        let msg = `Đã xóa ${res.deletedCount} tài khoản.`
        if (res.skippedCount > 0) msg += ` Bỏ qua ${res.skippedCount} tài khoản không đủ điều kiện xóa.`
        setMessage(msg)
        setSelectedUsers([])
        refresh()
      }
    })
  }

  const deleteService = (service: AdminService) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa dịch vụ',
      message: (
        <div className="confirm-dialog-content">
          <p className="mb-2">
            Bạn có chắc muốn xóa dịch vụ <b>{service.name}</b> ({service.providerName})?
          </p>
          <div className="alert alert-info py-2 px-3 small mb-2">
            <i className="bi bi-shield-check me-1 text-primary" />
            <strong>Quy tắc bảo vệ dữ liệu:</strong>
            <ul className="mb-0 ps-3 mt-1">
              <li><strong>Chưa từng có khách đặt:</strong> Dịch vụ sẽ được xóa hoàn toàn khỏi cơ sở dữ liệu.</li>
              <li><strong>Đã có lịch sử đặt chỗ:</strong> Dịch vụ sẽ chuyển sang trạng thái <em>Ngưng hoạt động (Ẩn)</em> để bảo toàn lịch sử hóa đơn cho khách hàng và đối tác, đồng thời hủy các slot chưa diễn ra.</li>
              <li><strong>Đang có booking hoạt động:</strong> Hệ thống sẽ từ chối xóa để đảm bảo quyền lợi khách hàng.</li>
            </ul>
          </div>
        </div>
      ),
      confirmText: 'Xác nhận xóa',
      variant: 'danger',
      onConfirm: async () => {
        const res = await api.adminDeleteService(service.id, session.accessToken)
        if (res.isSoftDeleted) {
          setManagedServices((prev) => prev.map((s) => s.id === service.id ? { ...s, isActive: false } : s))
          setMessage(res.message || `Dịch vụ "${service.name}" đã được chuyển sang trạng thái ngưng hoạt động để bảo toàn lịch sử đặt chỗ.`)
        } else {
          setManagedServices((prev) => prev.filter((s) => s.id !== service.id))
          setSelectedServices((prev) => prev.filter((id) => id !== service.id))
          setMessage(res.message || `Đã xóa hoàn toàn dịch vụ "${service.name}".`)
        }
        refresh()
      }
    })
  }

  const bulkDeleteServices = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa hàng loạt dịch vụ',
      message: (
        <div className="confirm-dialog-content">
          <p className="mb-2">
            Xác nhận xóa <b>{selectedServices.length}</b> dịch vụ đã chọn?
          </p>
          <div className="alert alert-info py-2 px-3 small mb-2">
            <i className="bi bi-shield-check me-1 text-primary" />
            <strong>Quy tắc bảo vệ dữ liệu:</strong> Hệ thống sẽ xóa hoàn toàn các dịch vụ chưa có booking, chuyển ngưng hoạt động các dịch vụ đã có lịch sử booking, và bỏ qua các dịch vụ đang có booking hoạt động.
          </div>
        </div>
      ),
      confirmText: 'Xóa các dịch vụ đã chọn',
      variant: 'danger',
      onConfirm: async () => {
        const res = await api.bulkDeleteServices(selectedServices, session.accessToken)
        let msg = `Đã xử lý: xóa hoàn toàn ${res.deletedCount} dịch vụ, chuyển ngưng hoạt động ${res.softDeletedCount || 0} dịch vụ để bảo toàn lịch sử.`
        if (res.skippedCount > 0) msg += ` Bỏ qua ${res.skippedCount} dịch vụ do còn booking đang hoạt động.`
        setMessage(msg)
        setSelectedServices([])
        refresh()
      }
    })
  }

  const cancelSlot = (slot: AdminSlot) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hủy slot',
      message: `Hủy slot "${slot.serviceName}" (${slot.venueName})? Slot này chỉ có thể hủy khi chưa có khách đặt chỗ.`,
      confirmText: 'Hủy slot',
      variant: 'danger',
      onConfirm: async () => {
        await api.adminCancelSlot(slot.id, session.accessToken)
        setMessage('Slot đã được hủy.')
        refresh()
      }
    })
  }

  const reopenSlot = (slot: AdminSlot) => {
    setConfirmModal({
      isOpen: true,
      title: 'Mở lại slot đã hủy',
      message: `Mở lại slot "${slot.serviceName}" (${slot.venueName})? Slot sẽ được mở lại cho khách hàng đặt chỗ nếu dịch vụ và đối tác đang hoạt động bình thường.`,
      confirmText: 'Mở lại ngay',
      variant: 'primary',
      onConfirm: async () => {
        await api.adminReopenSlot(slot.id, session.accessToken)
        setMessage(`Đã mở lại slot ${slot.serviceName}.`)
        refresh()
      }
    })
  }

  const deleteProvider = (provider: ProviderProfile) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa đối tác',
      message: `Xóa đối tác "${provider.businessName}"? Trạng thái sẽ chuyển thành Đã xóa, slot đang mở/nháp sẽ bị hủy và chỉ thực hiện được nếu không có lịch đặt chỗ đang hoạt động.`,
      confirmText: 'Xác nhận xóa',
      variant: 'danger',
      onConfirm: async () => {
        await api.adminDeleteProvider(provider.id, session.accessToken)
        setMessage(`Đã xóa đối tác ${provider.businessName}.`)
        refresh()
      }
    })
  }

  const viewProvider = async (provider: ProviderProfile) => { setError(''); setProviderDetail(null); setDetailLoading(true); try { setProviderDetail(await api.adminProviderDetail(provider.id, session.accessToken)) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải chi tiết đối tác.') } finally { setDetailLoading(false) } }

  const bulkDeleteProviders = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa hàng loạt đối tác',
      message: `Xác nhận xóa ${selectedProviders.length} đối tác đã chọn? Chỉ đối tác không còn booking hoặc hold đang hoạt động mới có thể xóa.`,
      confirmText: 'Xóa đối tác đã chọn',
      variant: 'danger',
      onConfirm: async () => {
        const res = await api.bulkDeleteProviders(selectedProviders, session.accessToken)
        let msg = `Đã xóa ${res.deletedCount} đối tác.`
        if (res.skippedCount > 0) msg += ` Bỏ qua ${res.skippedCount} đối tác do còn booking hoặc hold hoạt động.`
        setMessage(msg)
        setSelectedProviders([])
        refresh()
      }
    })
  }

  const bulkSetProviderStatus = (status: number, label: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Xác nhận ${label} đối tác`,
      message: `Xác nhận ${label} ${selectedProviders.length} đối tác đã chọn?`,
      confirmText: `Xác nhận ${label}`,
      variant: status === 2 ? 'danger' : status === 3 ? 'warning' : 'primary',
      onConfirm: async () => {
        const res = await api.bulkSetProviderStatus(selectedProviders, status, session.accessToken)
        setMessage(`Đã cập nhật trạng thái cho ${res.updatedCount} đối tác.`)
        setSelectedProviders([])
        refresh()
      }
    })
  }

  const bulkSuspendUsers = (suspend: boolean) => {
    const label = suspend ? 'tạm khóa' : 'mở khóa'
    setConfirmModal({
      isOpen: true,
      title: `Xác nhận ${label} tài khoản`,
      message: `Xác nhận ${label} ${selectedUsers.length} tài khoản đã chọn?`,
      confirmText: `Xác nhận ${label}`,
      variant: suspend ? 'danger' : 'primary',
      onConfirm: async () => {
        const res = await api.bulkSetUsersSuspended(selectedUsers, suspend, session.accessToken)
        setMessage(`Đã ${label} ${res.updatedCount} tài khoản.`)
        setSelectedUsers([])
        refresh()
      }
    })
  }

  const bulkToggleServices = (active: boolean) => {
    const label = active ? 'mở lại' : 'ẩn'
    setConfirmModal({
      isOpen: true,
      title: `Xác nhận ${label} dịch vụ`,
      message: `Xác nhận ${label} ${selectedServices.length} dịch vụ đã chọn?`,
      confirmText: `Xác nhận ${label}`,
      variant: active ? 'primary' : 'warning',
      onConfirm: async () => {
        const res = await api.bulkSetServicesActive(selectedServices, active, session.accessToken)
        setMessage(`Đã ${label} ${res.updatedCount} dịch vụ.`)
        setSelectedServices([])
        refresh()
      }
    })
  }

  const bulkCancelSlots = () => {
    const candidateIds = selectedSlots.filter(id => {
      const slot = managedSlots.find(s => s.id === id)
      return slot && slot.status < 3 && slot.confirmedBookingCount === 0
    })
    setConfirmModal({
      isOpen: true,
      title: 'Hủy slot đã chọn',
      message: `Xác nhận hủy ${candidateIds.length} slot đã chọn? Chỉ hủy các slot chưa có khách đặt chỗ.`,
      confirmText: 'Hủy slot',
      variant: 'danger',
      onConfirm: async () => {
        const res = await api.bulkCancelSlots(candidateIds, session.accessToken)
        let msg = `Đã hủy ${res.cancelledCount} slot.`
        if (res.skippedCount > 0) msg += ` Bỏ qua ${res.skippedCount} slot do đã có khách đặt chỗ.`
        setMessage(msg)
        setSelectedSlots([])
        refresh()
      }
    })
  }

  const bulkReopenSlots = () => {
    const candidateIds = selectedSlots.filter(id => {
      const slot = managedSlots.find(s => s.id === id)
      return slot && slot.status === 4 && new Date(slot.startAtUtc).getTime() > Date.now() && (!slot.bookingClosesAtUtc || new Date(slot.bookingClosesAtUtc).getTime() > Date.now())
    })
    setConfirmModal({
      isOpen: true,
      title: 'Mở lại slot đã chọn',
      message: `Xác nhận mở lại ${candidateIds.length} slot đã chọn? Chỉ các slot đã hủy trong tương lai, dịch vụ đang mở và không trùng lịch mới có thể mở lại thành công.`,
      confirmText: 'Mở lại slot',
      variant: 'primary',
      onConfirm: async () => {
        const res = await api.bulkReopenSlots(candidateIds, session.accessToken)
        let msg = `Đã mở lại ${res.reopenedCount} slot.`
        if (res.skippedCount > 0) msg += ` Bỏ qua ${res.skippedCount} slot không đủ điều kiện.`
        setMessage(msg)
        setSelectedSlots([])
        refresh()
      }
    })
  }

  const bulkResolveReports = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Đánh dấu đã xử lý',
      message: `Xác nhận đánh dấu đã xử lý cho ${selectedReports.length} báo cáo đã chọn?`,
      confirmText: 'Đánh dấu đã xử lý',
      variant: 'primary',
      onConfirm: async () => {
        const res = await api.bulkResolveReports(selectedReports, session.accessToken)
        setMessage(`Đã xử lý ${res.resolvedCount} báo cáo.`)
        setSelectedReports([])
        refresh()
      }
    })
  }

  const bulkDeleteReports = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa báo cáo',
      message: `Xác nhận xóa vĩnh viễn ${selectedReports.length} báo cáo đã chọn?`,
      confirmText: 'Xóa báo cáo',
      variant: 'danger',
      onConfirm: async () => {
        const res = await api.bulkDeleteReports(selectedReports, session.accessToken)
        setMessage(`Đã xóa ${res.deletedCount} báo cáo.`)
        setSelectedReports([])
        refresh()
      }
    })
  }

  const selectableUsers = useMemo(() => {
    return filteredUsers.filter((u) => u.id !== session.user.id && !u.roles.includes('Admin') && (isAdmin || !u.roles.includes('Manager')))
  }, [filteredUsers, session.user.id, isAdmin])

  const selectableSlots = useMemo(() => {
    return filteredSlots.filter((s) => {
      const canCancel = s.status < 3 && s.confirmedBookingCount === 0
      const isFuture = new Date(s.startAtUtc).getTime() > Date.now() && (!s.bookingClosesAtUtc || new Date(s.bookingClosesAtUtc).getTime() > Date.now())
      const canReopen = s.status === 4 && isFuture
      return canCancel || canReopen
    })
  }, [filteredSlots])

  const cancellableSlotsSelected = useMemo(() => {
    return selectedSlots.filter(id => {
      const slot = managedSlots.find(s => s.id === id)
      return slot && slot.status < 3 && slot.confirmedBookingCount === 0
    })
  }, [selectedSlots, managedSlots])

  const reopenableSlotsSelected = useMemo(() => {
    return selectedSlots.filter(id => {
      const slot = managedSlots.find(s => s.id === id)
      return slot && slot.status === 4 && new Date(slot.startAtUtc).getTime() > Date.now() && (!slot.bookingClosesAtUtc || new Date(slot.bookingClosesAtUtc).getTime() > Date.now())
    })
  }, [selectedSlots, managedSlots])

  return <div className="container dashboard">
    <div className="provider-heading">
      <div>
        <p className="eyebrow">{isAdmin ? 'Trung tâm Quản trị Hệ thống' : 'Trung tâm Vận hành Nền tảng'}</p>
        <h1>{isAdmin ? 'Quản trị OpenSlot' : 'Điều phối & Vận hành'}</h1>
        <p className="dashboard-copy">
          {isAdmin
            ? 'Quản lý toàn diện tài khoản, phân quyền Manager, đối tác, dịch vụ và chính sách toàn hệ thống.'
            : 'Xét duyệt đối tác, kiểm duyệt chất lượng dịch vụ & slot, xử lý khiếu nại và theo dõi vận hành.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={tabLoading[activeTab]}
        className="btn btn-outline-primary rounded-pill"
        title="Làm mới dữ liệu phân hệ hiện tại"
      >
        <i className={`bi bi-arrow-clockwise me-1 ${tabLoading[activeTab] ? 'spin' : ''}`} />
        Làm mới
      </button>
    </div>

    <nav className="admin-tabs-nav" aria-label="Phân hệ quản trị">
      <button
        type="button"
        className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
        onClick={() => switchTab('overview')}
      >
        <i className="bi bi-grid-1x2-fill" />
        <span>Tổng quan</span>
      </button>
      <button
        type="button"
        className={`admin-tab-btn ${activeTab === 'providers' ? 'active' : ''}`}
        onClick={() => switchTab('providers')}
      >
        <i className="bi bi-shop-window" />
        <span>Đối tác</span>
        {stats && stats.pendingProviders > 0 && (
          <span className="admin-tab-badge" title={`${stats.pendingProviders} hồ sơ chờ duyệt`}>
            {stats.pendingProviders}
          </span>
        )}
      </button>
      {isAdmin && (
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => switchTab('users')}
        >
          <i className="bi bi-shield-lock-fill" />
          <span>Tài khoản & Phân quyền</span>
          {stats && stats.users > 0 && (
            <span className="admin-tab-badge neutral">
              {stats.users}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        className={`admin-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
        onClick={() => switchTab('catalog')}
      >
        <i className="bi bi-collection-fill" />
        <span>{isAdmin ? 'Dịch vụ & Danh mục' : 'Kiểm duyệt dịch vụ'}</span>
      </button>
      <button
        type="button"
        className={`admin-tab-btn ${activeTab === 'slots' ? 'active' : ''}`}
        onClick={() => switchTab('slots')}
      >
        <i className="bi bi-clock-history" />
        <span>Kiểm duyệt slot</span>
      </button>
      <button
        type="button"
        className={`admin-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
        onClick={() => switchTab('reports')}
      >
        <i className="bi bi-flag-fill" />
        <span>Báo cáo vi phạm</span>
        {stats && stats.openReports > 0 && (
          <span className="admin-tab-badge" title={`${stats.openReports} báo cáo chưa xử lý`}>
            {stats.openReports}
          </span>
        )}
      </button>
    </nav>

    {error && <div className="alert alert-danger">{error}</div>}
    {message && <div className="alert alert-success">{message}</div>}

    {/* TAB 1: OVERVIEW */}
    {activeTab === 'overview' && (
      <div className="admin-tab-content">
        <div className="admin-overview-alerts">
          {stats && stats.pendingProviders > 0 ? (
            <div className="admin-alert-card">
              <div className="admin-alert-icon warning">
                <i className="bi bi-hourglass-split" />
              </div>
              <div className="admin-alert-content">
                <h4>{stats.pendingProviders} đối tác chờ xét duyệt</h4>
                <p>Có hồ sơ gian hàng mới đang chờ duyệt để mở bán các khung giờ trống.</p>
                <button
                  type="button"
                  className="btn btn-sm btn-warning rounded-pill px-3"
                  onClick={() => switchTab('providers')}
                >
                  Xét duyệt ngay <i className="bi bi-arrow-right ms-1" />
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-alert-card">
              <div className="admin-alert-icon info">
                <i className="bi bi-check2-circle" />
              </div>
              <div className="admin-alert-content">
                <h4>Hồ sơ đối tác đã thông suốt</h4>
                <p>Hiện không có hồ sơ gian hàng nào tồn đọng chờ xét duyệt.</p>
              </div>
            </div>
          )}

          {stats && stats.openReports > 0 ? (
            <div className="admin-alert-card">
              <div className="admin-alert-icon danger">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div className="admin-alert-content">
                <h4>{stats.openReports} khiếu nại & báo cáo</h4>
                <p>Cần kiểm tra nội dung phản ánh vi phạm từ người dùng hoặc đối tác.</p>
                <button
                  type="button"
                  className="btn btn-sm btn-danger rounded-pill px-3"
                  onClick={() => switchTab('reports')}
                >
                  Xử lý báo cáo <i className="bi bi-arrow-right ms-1" />
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-alert-card">
              <div className="admin-alert-icon info">
                <i className="bi bi-shield-check" />
              </div>
              <div className="admin-alert-content">
                <h4>Báo cáo vi phạm sạch sẽ</h4>
                <p>Toàn bộ khiếu nại và vi phạm đã được kiểm tra và xử lý xong.</p>
              </div>
            </div>
          )}
        </div>

        {stats ? (
          <div className="admin-bento-grid my-4">
            <div
              className="bento-kpi-card"
              onClick={() => isAdmin && switchTab('users')}
              style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              title={isAdmin ? 'Chuyển sang phân hệ Quản lý tài khoản' : undefined}
            >
              <div className="bento-kpi-icon users-icon"><i className="bi bi-people-fill" /></div>
              <div>
                <span className="bento-kpi-label">Người dùng</span>
                <b className="bento-kpi-value">{stats.users}</b>
              </div>
            </div>
            <div
              className="bento-kpi-card"
              onClick={() => switchTab('slots')}
              style={{ cursor: 'pointer' }}
              title="Chuyển sang phân hệ Kiểm duyệt slot"
            >
              <div className="bento-kpi-icon slots-icon"><i className="bi bi-calendar-range-fill" /></div>
              <div>
                <span className="bento-kpi-label">Slot đang mở</span>
                <b className="bento-kpi-value">{stats.publishedSlots}</b>
              </div>
            </div>
            <div className="bento-kpi-card">
              <div className="bento-kpi-icon bookings-icon"><i className="bi bi-ticket-perforated-fill" /></div>
              <div>
                <span className="bento-kpi-label">Lượt đặt chỗ</span>
                <b className="bento-kpi-value">{stats.bookings}</b>
              </div>
            </div>
            <div className="bento-kpi-card">
              <div className="bento-kpi-icon rate-icon"><i className="bi bi-graph-up-arrow" /></div>
              <div>
                <span className="bento-kpi-label">Tỷ lệ lấp đầy</span>
                <b className="bento-kpi-value">{stats.fillRatePercent}%</b>
              </div>
            </div>
            <div className="bento-kpi-card">
              <div className="bento-kpi-icon noshow-icon"><i className="bi bi-person-x-fill" /></div>
              <div>
                <span className="bento-kpi-label">Vắng mặt (No-show)</span>
                <b className="bento-kpi-value">{stats.noShows}</b>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state"><div className="spinner-border text-primary" /></div>
        )}
      </div>
    )}

    {/* TAB 2: PROVIDERS */}
    {activeTab === 'providers' && (
      <div className="admin-tab-content">
        <div className="admin-section-title">
          <h2>Quản lý đối tác</h2>
          <div className="admin-filter">
            <button className={filter === undefined ? 'active' : ''} onClick={() => setFilter(undefined)}>Tất cả</button>
            <button className={filter === 0 ? 'active' : ''} onClick={() => setFilter(0)}>Chờ duyệt</button>
            <button className={filter === 1 ? 'active' : ''} onClick={() => setFilter(1)}>Đã duyệt</button>
            <button className={filter === 3 ? 'active' : ''} onClick={() => setFilter(3)}>Cần bổ sung</button>
            <button className={filter === 2 ? 'active' : ''} onClick={() => setFilter(2)}>Tạm khóa</button>
            {isAdmin && <button className={filter === 4 ? 'active' : ''} onClick={() => setFilter(4)}>Đã xóa</button>}
          </div>
        </div>
        {tabLoading.providers && providers.length === 0 ? (
          <TableSkeleton rows={4} columns={5} />
        ) : (
          <>
            <div className="section-toolbar">
              <div className="section-search">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đối tác theo tên, người phụ trách, email, sđt..."
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                />
                {providerSearch && (
                  <button className="search-clear" onClick={() => setProviderSearch('')} title="Xóa tìm kiếm">
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
              {selectedProviders.length > 0 && (
                <div className="bulk-actions-bar">
                  <span className="bulk-count">Đã chọn <b>{selectedProviders.length}</b></span>
                  <div className="bulk-buttons">
                    <button className="btn btn-sm btn-outline-success" onClick={() => bulkSetProviderStatus(1, 'duyệt')}>
                      <i className="bi bi-check-lg" /> Duyệt
                    </button>
                    <button className="btn btn-sm btn-outline-warning" onClick={() => bulkSetProviderStatus(3, 'yêu cầu bổ sung')}>
                      Yêu cầu bổ sung
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => bulkSetProviderStatus(2, 'khóa')}>
                      Khóa
                    </button>
                    {isAdmin && (
                      <button className="btn btn-sm btn-danger" onClick={bulkDeleteProviders}>
                        <i className="bi bi-trash" /> Xóa
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedProviders([])}>
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="provider-table admin-table">
              <div className="table-head">
                <span className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="table-checkbox"
                    checked={filteredProviders.length > 0 && selectedProviders.length === filteredProviders.length}
                    onChange={(e) => setSelectedProviders(e.target.checked ? filteredProviders.map((p) => p.id) : [])}
                    aria-label="Chọn tất cả đối tác"
                  />
                </span>
                <span>Doanh nghiệp</span>
                <span>Người phụ trách</span>
                <span>Trạng thái</span>
                <span>Thao tác</span>
              </div>
              {filteredProviders.length ? filteredProviders.map((provider) => (
                <div className="table-row" key={provider.id}>
                  <span className="checkbox-cell">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={selectedProviders.includes(provider.id)}
                      onChange={(e) => {
                        setSelectedProviders((prev) =>
                          e.target.checked ? [...prev, provider.id] : prev.filter((id) => id !== provider.id)
                        )
                      }}
                      aria-label={`Chọn ${provider.businessName}`}
                    />
                  </span>
                  <span>
                    <button className="provider-detail-trigger" onClick={() => viewProvider(provider)}>
                      <b>{provider.businessName}</b>
                      <i className="bi bi-box-arrow-up-right" />
                    </button>
                    <small>{provider.contactPhone} · {provider.description || 'Chưa có mô tả'}</small>
                  </span>
                  <span>
                    <b>{provider.ownerName}</b>
                    <small>{provider.ownerEmail}</small>
                  </span>
                  <span>
                    <span className={`status-pill provider-status status-${provider.status}`}>
                      {provider.status === 0 ? 'Chờ duyệt' : provider.status === 1 ? 'Đã duyệt' : provider.status === 3 ? 'Cần bổ sung' : provider.status === 4 ? 'Đã xóa' : 'Tạm khóa'}
                    </span>
                  </span>
                  <span className="admin-actions">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => viewProvider(provider)}>Xem</button>
                    {provider.status !== 1 && provider.status !== 4 && <button className="btn btn-sm btn-outline-success" onClick={() => update(provider, 'approve')}>{provider.status === 2 ? 'Mở lại' : 'Duyệt'}</button>}
                    {provider.status === 0 && <button className="btn btn-sm btn-outline-warning" onClick={() => update(provider, 'reject')}>Yêu cầu bổ sung</button>}
                    {provider.status === 1 && <button className="btn btn-sm btn-outline-danger" onClick={() => update(provider, 'suspend')}>Khóa</button>}
                    {isAdmin && provider.status !== 4 && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteProvider(provider)}>Xóa</button>}
                  </span>
                </div>
              )) : (
                <div className="empty-state"><p>Không tìm thấy đối tác nào phù hợp.</p></div>
              )}
            </div>
            {detailLoading && <div className="provider-detail-panel loading"><div className="spinner-border text-primary" /><span>Đang tải chi tiết đối tác...</span></div>}
            {providerDetail && <ProviderDetailPanel detail={providerDetail} onClose={() => setProviderDetail(null)} />}
          </>
        )}
      </div>
    )}

    {/* TAB 3: USERS & ROLES (Admin Only) */}
    {isAdmin && activeTab === 'users' && (
      <div className="admin-tab-content">
        <div className="admin-section-title">
          <h2>Quản lý tài khoản & Phân quyền Manager</h2>
          <span className="section-note">{users.filter((x) => x.isSuspended).length} tài khoản đang khóa</span>
        </div>
        {tabLoading.users && users.length === 0 ? (
          <TableSkeleton rows={5} columns={5} />
        ) : (
          <>
            <div className="section-toolbar">
              <div className="section-search">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Tìm tài khoản theo tên, email, vai trò..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                {userSearch && (
                  <button className="search-clear" onClick={() => setUserSearch('')} title="Xóa tìm kiếm">
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
              {selectedUsers.length > 0 && (
                <div className="bulk-actions-bar">
                  <span className="bulk-count">Đã chọn <b>{selectedUsers.length}</b></span>
                  <div className="bulk-buttons">
                    <button className="btn btn-sm btn-outline-danger" onClick={() => bulkSuspendUsers(true)}>
                      <i className="bi bi-lock" /> Khóa
                    </button>
                    <button className="btn btn-sm btn-outline-success" onClick={() => bulkSuspendUsers(false)}>
                      <i className="bi bi-unlock" /> Mở khóa
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={bulkDeleteUsers}>
                      <i className="bi bi-trash" /> Xóa tài khoản
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedUsers([])}>
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="provider-table user-table">
              <div className="table-head">
                <span className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="table-checkbox"
                    checked={selectableUsers.length > 0 && selectableUsers.every((u) => selectedUsers.includes(u.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(Array.from(new Set([...selectedUsers, ...selectableUsers.map((u) => u.id)])))
                      } else {
                        const selectableIds = new Set(selectableUsers.map((u) => u.id))
                        setSelectedUsers((prev) => prev.filter((id) => !selectableIds.has(id)))
                      }
                    }}
                    aria-label="Chọn tất cả tài khoản có thể thao tác"
                  />
                </span>
                <span>Tài khoản</span>
                <span>Ngày tạo</span>
                <span>Vi phạm</span>
                <span>Thao tác</span>
              </div>
              {filteredUsers.length ? filteredUsers.map((user) => {
                const targetIsAdmin = user.roles.includes('Admin')
                const targetIsManager = user.roles.includes('Manager')
                const canModerate = user.id !== session.user.id && !targetIsAdmin && (isAdmin || !targetIsManager)
                const canChangeManager = isAdmin && user.id !== session.user.id && !targetIsAdmin && (targetIsManager || (user.roles.includes('Customer') && !user.roles.includes('Provider')))
                return (
                  <div className="table-row" key={user.id}>
                    <span className="checkbox-cell">
                      {canModerate ? (
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            setSelectedUsers((prev) =>
                              e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                            )
                          }}
                          aria-label={`Chọn ${user.displayName}`}
                        />
                      ) : <span />}
                    </span>
                    <span>
                      <b>{user.displayName}</b>
                      <small>{user.email} · {roleLabel(user.roles)}</small>
                    </span>
                    <span>{formatTime(user.createdAtUtc)}</span>
                    <span>
                      {user.strikeCount} strike {user.isSuspended && <small className="text-danger">Tài khoản bị khóa</small>}
                    </span>
                    <span className="admin-actions">
                      {canModerate && (
                        <button
                          onClick={() => toggleUser(user)}
                          className={`btn btn-sm ${user.isSuspended ? 'btn-outline-success' : 'btn-outline-danger'}`}
                          title={user.isSuspended ? 'Mở lại quyền truy cập cho tài khoản' : 'Tạm dừng quyền đăng nhập và đặt chỗ (vẫn bảo lưu toàn bộ dữ liệu)'}
                        >
                          {user.isSuspended ? 'Mở khóa' : 'Tạm khóa'}
                        </button>
                      )}
                      {canChangeManager && (
                        <button
                          onClick={() => toggleManager(user)}
                          className={`btn btn-sm ${targetIsManager ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                          title={targetIsManager ? 'Thu hồi quyền Manager' : 'Cấp quyền Manager'}
                        >
                          {targetIsManager ? 'Thu hồi Manager' : 'Cấp Manager'}
                        </button>
                      )}
                      {isAdmin && user.id !== session.user.id && !targetIsAdmin && (
                        <button
                          onClick={() => deleteUser(user)}
                          className="btn btn-sm btn-outline-danger"
                          title="Xóa vĩnh viễn tài khoản khỏi hệ thống (yêu cầu không có booking/giữ chỗ hoạt động)"
                        >
                          <i className="bi bi-trash" /> Xóa
                        </button>
                      )}
                      {!canModerate && !canChangeManager && (!isAdmin || user.id === session.user.id || targetIsAdmin) && (
                        <span className="section-note">{targetIsAdmin ? 'Tài khoản Admin' : user.id === session.user.id ? 'Tài khoản hiện tại' : 'Chỉ có thể theo dõi'}</span>
                      )}
                    </span>
                  </div>
                )
              }) : (
                <div className="empty-state"><p>Không tìm thấy tài khoản phù hợp.</p></div>
              )}
            </div>
          </>
        )}
      </div>
    )}

    {/* TAB 4: CATALOG & SERVICES */}
    {activeTab === 'catalog' && (
      <div className="admin-tab-content">
        {isAdmin && <CategoryManagementPanel token={session.accessToken} isAdmin={isAdmin} />}
        <div className="admin-section-title">
          <h2>Kiểm duyệt dịch vụ</h2>
          <span className="section-note">{managedServices.filter((x) => !x.isActive).length} dịch vụ đang ẩn</span>
        </div>
        {tabLoading.catalog && managedServices.length === 0 ? (
          <TableSkeleton rows={4} columns={5} />
        ) : (
          <>
            <div className="section-toolbar">
              <div className="section-search">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Tìm dịch vụ theo tên, danh mục, địa điểm, đối tác..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
                {serviceSearch && (
                  <button className="search-clear" onClick={() => setServiceSearch('')} title="Xóa tìm kiếm">
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
              {selectedServices.length > 0 && (
                <div className="bulk-actions-bar">
                  <span className="bulk-count">Đã chọn <b>{selectedServices.length}</b></span>
                  <div className="bulk-buttons">
                    <button className="btn btn-sm btn-outline-danger" onClick={() => bulkToggleServices(false)}>
                      <i className="bi bi-eye-slash" /> Ẩn
                    </button>
                    <button className="btn btn-sm btn-outline-success" onClick={() => bulkToggleServices(true)}>
                      <i className="bi bi-eye" /> Mở lại
                    </button>
                    {isAdmin && (
                      <button className="btn btn-sm btn-danger" onClick={bulkDeleteServices}>
                        <i className="bi bi-trash" /> Xóa dịch vụ
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedServices([])}>
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="provider-table service-table">
              <div className="table-head">
                <span className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="table-checkbox"
                    checked={filteredServices.length > 0 && selectedServices.length === filteredServices.length}
                    onChange={(e) => setSelectedServices(e.target.checked ? filteredServices.map((s) => s.id) : [])}
                    aria-label="Chọn tất cả dịch vụ"
                  />
                </span>
                <span>Dịch vụ</span>
                <span>Đối tác</span>
                <span>Giá gốc</span>
                <span>Thao tác</span>
              </div>
              {filteredServices.length ? filteredServices.map((service) => (
                <div className="table-row" key={service.id}>
                  <span className="checkbox-cell">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={selectedServices.includes(service.id)}
                      onChange={(e) => {
                        setSelectedServices((prev) =>
                          e.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id)
                        )
                      }}
                      aria-label={`Chọn ${service.name}`}
                    />
                  </span>
                  <span>
                    <b>{service.name}</b>
                    <small>
                      {service.categoryName} · {service.venueName}
                      {!service.isActive && <span className="text-warning ms-1">(Ngưng hoạt động)</span>}
                    </small>
                  </span>
                  <span>{service.providerName}</span>
                  <span>{formatMoney(service.basePriceVnd)}</span>
                  <span className="admin-actions">
                    <button
                      onClick={() => toggleService(service)}
                      className={`btn btn-sm ${service.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      title={service.isActive ? 'Tạm ẩn dịch vụ khỏi trang tìm kiếm của khách' : 'Mở lại dịch vụ cho khách tìm kiếm và đặt chỗ'}
                    >
                      {service.isActive ? 'Ẩn' : 'Mở lại'}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => deleteService(service)}
                        className="btn btn-sm btn-outline-danger"
                        title="Xóa dịch vụ (xóa hoàn toàn nếu chưa có booking, hoặc chuyển ngưng hoạt động nếu đã có lịch sử booking)"
                      >
                        <i className="bi bi-trash" /> Xóa
                      </button>
                    )}
                  </span>
                </div>
              )) : (
                <div className="empty-state"><p>Không tìm thấy dịch vụ phù hợp.</p></div>
              )}
            </div>
          </>
        )}
      </div>
    )}

    {/* TAB 5: SLOTS MODERATION */}
    {activeTab === 'slots' && (
      <div className="admin-tab-content">
        <div className="admin-section-title">
          <h2>Kiểm duyệt slot</h2>
          <span className="section-note">Tối đa 200 slot gần nhất</span>
        </div>
        {tabLoading.slots && managedSlots.length === 0 ? (
          <TableSkeleton rows={5} columns={5} />
        ) : (
          <>
            <div className="section-toolbar">
              <div className="section-search">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Tìm slot theo tên dịch vụ, địa điểm, đối tác..."
                  value={slotSearch}
                  onChange={(e) => setSlotSearch(e.target.value)}
                />
                {slotSearch && (
                  <button className="search-clear" onClick={() => setSlotSearch('')} title="Xóa tìm kiếm">
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
              {selectedSlots.length > 0 && (
                <div className="bulk-actions-bar">
                  <span className="bulk-count">Đã chọn <b>{selectedSlots.length}</b></span>
                  <div className="bulk-buttons">
                    {cancellableSlotsSelected.length > 0 && (
                      <button className="btn btn-sm btn-outline-danger" onClick={bulkCancelSlots}>
                        <i className="bi bi-x-circle" /> Hủy ({cancellableSlotsSelected.length})
                      </button>
                    )}
                    {reopenableSlotsSelected.length > 0 && (
                      <button className="btn btn-sm btn-outline-success" onClick={bulkReopenSlots}>
                        <i className="bi bi-arrow-clockwise" /> Mở lại ({reopenableSlotsSelected.length})
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedSlots([])}>
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="provider-table slot-admin-table">
              <div className="table-head">
                <span className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="table-checkbox"
                    checked={selectableSlots.length > 0 && selectableSlots.every((s) => selectedSlots.includes(s.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSlots(Array.from(new Set([...selectedSlots, ...selectableSlots.map((s) => s.id)])))
                      } else {
                        const selectableIds = new Set(selectableSlots.map((s) => s.id))
                        setSelectedSlots((prev) => prev.filter((id) => !selectableIds.has(id)))
                      }
                    }}
                    aria-label="Chọn tất cả slot có thể thao tác"
                  />
                </span>
                <span>Slot</span>
                <span>Đối tác</span>
                <span>Trạng thái</span>
                <span>Đã đặt</span>
                <span>Thao tác</span>
              </div>
              {filteredSlots.length ? filteredSlots.map((slot) => {
                const isFuture = new Date(slot.startAtUtc).getTime() > Date.now() && (!slot.bookingClosesAtUtc || new Date(slot.bookingClosesAtUtc).getTime() > Date.now())
                const canCancel = slot.status < 3 && slot.confirmedBookingCount === 0
                const canReopen = slot.status === 4 && isFuture
                const canSelect = canCancel || canReopen

                return (
                  <div className="table-row" key={slot.id}>
                    <span className="checkbox-cell">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={selectedSlots.includes(slot.id)}
                          onChange={(e) => {
                            setSelectedSlots((prev) =>
                              e.target.checked ? [...prev, slot.id] : prev.filter((id) => id !== slot.id)
                            )
                          }}
                          aria-label={`Chọn slot ${slot.serviceName}`}
                        />
                      ) : <span />}
                    </span>
                    <span>
                      <b>{slot.serviceName}</b>
                      <small>{slot.venueName} · {formatTime(slot.startAtUtc)}</small>
                    </span>
                    <span>{slot.providerName}</span>
                    <span>
                      {slot.status === 0 && <span className="os-badge os-badge-draft">Nháp</span>}
                      {slot.status === 1 && <span className="os-badge os-badge-open">Đang mở</span>}
                      {slot.status === 2 && <span className="os-badge os-badge-full">Kín chỗ</span>}
                      {slot.status === 3 && <span className="os-badge os-badge-expired">Hết hạn</span>}
                      {slot.status === 4 && <span className="os-badge os-badge-cancelled">Đã hủy</span>}
                    </span>
                    <span>{slot.confirmedBookingCount}/{slot.capacity}</span>
                    <span className="admin-actions">
                      {canCancel && (
                        <button onClick={() => cancelSlot(slot)} className="btn btn-sm btn-outline-danger">
                          Hủy
                        </button>
                      )}
                      {canReopen && (
                        <button onClick={() => reopenSlot(slot)} className="btn btn-sm btn-outline-success">
                          Mở lại
                        </button>
                      )}
                      {!canCancel && !canReopen && (
                        <span className="section-note">
                          {slot.status === 1 && slot.confirmedBookingCount > 0 ? 'Có booking' : slot.status === 4 ? 'Đã qua giờ' : 'Không khả dụng'}
                        </span>
                      )}
                    </span>
                  </div>
                )
              }) : (
                <div className="empty-state"><p>Không tìm thấy slot phù hợp.</p></div>
              )}
            </div>
          </>
        )}
      </div>
    )}

    {/* TAB 6: REPORTS */}
    {activeTab === 'reports' && (
      <div className="admin-tab-content">
        <div className="admin-section-title report-title">
          <h2>Báo cáo vi phạm</h2>
          <span>{reports.filter((x) => x.status === 0).length} báo cáo đang mở</span>
        </div>
        {tabLoading.reports && reports.length === 0 ? (
          <TableSkeleton rows={4} columns={3} />
        ) : (
          <>
            <div className="section-toolbar">
              <div className="section-search">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Tìm báo cáo theo đối tượng, người báo cáo, lý do..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
                {reportSearch && (
                  <button className="search-clear" onClick={() => setReportSearch('')} title="Xóa tìm kiếm">
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
              {selectedReports.length > 0 && (
                <div className="bulk-actions-bar">
                  <span className="bulk-count">Đã chọn <b>{selectedReports.length}</b></span>
                  <div className="bulk-buttons">
                    <button className="btn btn-sm btn-outline-success" onClick={bulkResolveReports}>
                      <i className="bi bi-check2-circle" /> Đánh dấu đã xử lý
                    </button>
                    {isAdmin && (
                      <button className="btn btn-sm btn-outline-danger" onClick={bulkDeleteReports}>
                        <i className="bi bi-trash" /> Xóa báo cáo
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedReports([])}>
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
            </div>
            {filteredReports.length > 0 && (
              <label className="d-flex align-items-center gap-2 mb-2" style={{ cursor: 'pointer', fontSize: '13px', color: '#526075' }}>
                <input
                  type="checkbox"
                  className="table-checkbox"
                  checked={filteredReports.length > 0 && selectedReports.length === filteredReports.length}
                  onChange={(e) => setSelectedReports(e.target.checked ? filteredReports.map((r) => r.id) : [])}
                />
                <span>Chọn tất cả ({filteredReports.length} báo cáo)</span>
              </label>
            )}
            <div className="report-list">
              {filteredReports.length ? filteredReports.map((report) => (
                <article key={report.id}>
                  <div className="item-with-checkbox">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={selectedReports.includes(report.id)}
                      onChange={(e) => {
                        setSelectedReports((prev) =>
                          e.target.checked ? [...prev, report.id] : prev.filter((id) => id !== report.id)
                        )
                      }}
                      aria-label={`Chọn báo cáo ${report.id}`}
                    />
                    <div>
                      <b>{report.targetType} · {report.targetId}</b>
                      <small>{report.reporterName} ({report.reporterEmail}) · {formatTime(report.createdAtUtc)}</small>
                      <p>{report.reason}</p>
                    </div>
                  </div>
                  {report.status === 0 ? (
                    <button className="btn btn-sm btn-outline-success" onClick={() => resolve(report)}>
                      Đánh dấu đã xử lý
                    </button>
                  ) : (
                    <span className="status-pill">Đã xử lý</span>
                  )}
                </article>
              )) : (
                <div className="empty-state"><p>Không tìm thấy báo cáo nào phù hợp.</p></div>
              )}
            </div>
          </>
        )}
      </div>
    )}

    {confirmModal && (
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        loading={confirmLoading}
        onConfirm={async () => {
          try {
            setConfirmLoading(true)
            setError('')
            await confirmModal.onConfirm()
            toast.success('Thao tác thành công!')
            setConfirmModal(null)
          } catch (e) {
            setMessage('')
            setError(e instanceof Error ? e.message : 'Thao tác không thành công.')
            setConfirmModal(null)
          } finally {
            setConfirmLoading(false)
          }
        }}
        onCancel={() => {
          if (!confirmLoading) setConfirmModal(null)
        }}
      />
    )}
  </div>
}

function ProviderDetailPanel({ detail, onClose }: { detail: AdminProviderDetail; onClose: () => void }) {
  const slotStatus = (status: number) => status === 0 ? 'Nháp' : status === 1 ? 'Đang mở' : status === 2 ? 'Hết chỗ' : status === 3 ? 'Đã hủy' : 'Đã hết hạn'
  return <section className="provider-detail-panel" aria-live="polite"><div className="provider-detail-heading"><div><p className="eyebrow">Chi tiết đối tác</p><h2>{detail.businessName}</h2><p>{detail.ownerName} · {detail.ownerEmail} · {detail.contactPhone}</p></div><button className="btn btn-outline-secondary btn-sm" onClick={onClose}><i className="bi bi-x-lg" /> Đóng</button></div>{detail.description && <p className="provider-detail-description">{detail.description}</p>}<div className="detail-stat-grid"><article><small>Địa điểm</small><b>{detail.summary.venueCount}</b></article><article><small>Đơn vị đặt chỗ</small><b>{detail.summary.resourceCount}</b></article><article><small>Dịch vụ</small><b>{detail.summary.serviceCount}</b></article><article><small>Slot đang mở</small><b>{detail.summary.publishedSlotCount}</b></article><article><small>Lượt đã đặt</small><b>{detail.summary.bookingCount}</b></article></div><div className="detail-section"><h3>Địa điểm và đơn vị nhận đặt chỗ</h3>{detail.venues.length ? <div className="detail-venue-grid">{detail.venues.map((venue) => <article key={venue.id}><b><i className="bi bi-geo-alt" /> {venue.name}</b><span>{venue.addressLine}, {venue.district}, {venue.city}</span>{venue.resources.length ? <ul>{venue.resources.map((resource) => <li key={resource.id}><strong>{resource.name}</strong>{resource.code && ` · ${resource.code}`}{resource.floorOrZone && ` · ${resource.floorOrZone}`}<small>{resource.resourceType}{resource.positionDescription ? ` · ${resource.positionDescription}` : ''} · tối đa {resource.maxCapacity} chỗ</small></li>)}</ul> : <em>Chưa khai báo đơn vị đặt chỗ.</em>}</article>)}</div> : <p className="section-note">Đối tác chưa có địa điểm.</p>}</div><div className="detail-section"><h3>Dịch vụ đang khai báo</h3>{detail.services.length ? <div className="detail-list">{detail.services.map((service) => <article key={service.id}><div><b>{service.name}</b><span>{service.categoryName} · {service.venueName}</span></div><strong>{formatMoney(service.basePriceVnd)}</strong><span className={`status-pill ${service.isActive ? '' : 'provider-status status-2'}`}>{service.isActive ? 'Đang hoạt động' : 'Đang ẩn'}</span></article>)}</div> : <p className="section-note">Chưa có dịch vụ.</p>}</div><div className="detail-section"><h3>30 slot gần nhất</h3>{detail.slots.length ? <div className="detail-list">{detail.slots.map((slot) => <article key={slot.id}><div><b>{slot.serviceName}</b><span>{slot.venueName}{slot.resourceName ? ` · ${slot.resourceName}${slot.resourceCode ? ` (${slot.resourceCode})` : ''}` : ''} · {formatSlotWindow(slot.startAtUtc, slot.endAtUtc)}</span></div><strong>{formatMoney(slot.dealPriceVnd)}</strong><span className="status-pill">{slotStatus(slot.status)} · {slot.confirmedBookingCount}/{slot.capacity}</span></article>)}</div> : <p className="section-note">Chưa có slot nào.</p>}</div></section>
}

const RECOMMENDED_CATEGORY_TAGS = [
  { name: 'Thể thao & Sân bãi', iconName: 'trophy', symbol: '🏸', serviceTypes: 'Sân cầu lông, Pickleball, Bóng đá, Tennis' },
  { name: 'Làm đẹp & Spa', iconName: 'sparkles', symbol: '💅', serviceTypes: 'Nail, Nối mi, Gội đầu dưỡng sinh, Spa massage' },
  { name: 'Không gian làm việc', iconName: 'laptop', symbol: '💻', serviceTypes: 'Coworking, Phòng họp, Bàn làm việc' },
  { name: 'Studio & Nghệ thuật', iconName: 'camera', symbol: '📸', serviceTypes: 'Chụp ảnh cưới/concept, Quay phim, Podcast' },
  { name: 'Giải trí & Trò chơi', iconName: 'joystick', symbol: '🎮', serviceTypes: 'Bàn bida, Gaming zone, Boardgame' },
  { name: 'Ăn uống & Cà phê', iconName: 'cup-hot', symbol: '☕', serviceTypes: 'Quán cafe, Đặt bàn ẩm thực, Trà chiều' },
  { name: 'Sức khỏe & Thể hình', iconName: 'heart-pulse', symbol: '💪', serviceTypes: 'Phòng gym, Yoga, Pilates, Trị liệu' },
  { name: 'Âm nhạc & Karaoke', iconName: 'mic', symbol: '🎤', serviceTypes: 'Phòng karaoke mini, Phòng luyện thanh' },
  { name: 'Giáo dục & Kỹ năng', iconName: 'book', symbol: '📚', serviceTypes: 'Phòng học nhóm, Workshop, Lớp học ngắn hạn' },
  { name: 'Dịch vụ kỹ thuật', iconName: 'tools', symbol: '🚗', serviceTypes: 'Rửa xe, Giặt ủi công nghiệp, Sửa chữa' }
]

const CATEGORY_ICON_DEFINITIONS = [
  { value: 'tag', symbol: '🏷️', label: 'Danh mục chung', note: 'Dịch vụ đa năng, tổng hợp' },
  { value: 'trophy', symbol: '🏸', label: 'Thể thao & Sân bãi', note: 'Sân cầu lông, Pickleball, Bóng đá' },
  { value: 'sparkles', symbol: '💅', label: 'Làm đẹp & Spa', note: 'Nail, Mi, Gội đầu, Massage' },
  { value: 'laptop', symbol: '💻', label: 'Không gian làm việc', note: 'Coworking, Phòng họp, Bàn việc' },
  { value: 'camera', symbol: '📸', label: 'Studio & Nhiếp ảnh', note: 'Chụp ảnh, Quay podcast, Phim' },
  { value: 'joystick', symbol: '🎮', label: 'Giải trí & Trò chơi', note: 'Bida, Game PS5, Board game' },
  { value: 'cup-hot', symbol: '☕', label: 'Ăn uống & Cà phê', note: 'Quán cafe, Nhà hàng, Đặt bàn' },
  { value: 'heart-pulse', symbol: '💓', label: 'Sức khỏe & Thể thao', note: 'Gym, Yoga, Pilates' },
  { value: 'mic', symbol: '🎤', label: 'Âm nhạc & Karaoke', note: 'Phòng hát, Nhạc cụ, Thu âm' },
  { value: 'book', symbol: '📚', label: 'Học tập & Giáo dục', note: 'Phòng học nhóm, Workshop' },
  { value: 'tools', symbol: '🛠️', label: 'Kỹ thuật & Tiện ích', note: 'Rửa xe, Giặt sấy, Sửa chữa' }
]

function CategoryManagementPanel({ token, isAdmin }: { token: string; isAdmin?: boolean }) {
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [name, setName] = useState('')
  const [iconName, setIconName] = useState('tag')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    variant?: 'danger' | 'warning' | 'primary'
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const refresh = () => { api.adminCategories(token).then(setCategories).catch((e: Error) => setError(e.message)) }
  useEffect(refresh, [token])

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories
    const q = normalizeSearch(categorySearch)
    return categories.filter((c) =>
      normalizeSearch(c.name).includes(q) ||
      normalizeSearch(c.slug).includes(q)
    )
  }, [categories, categorySearch])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await api.createAdminCategory({ name, iconName }, token)
      setName('')
      setIconName('tag')
      setMessage('Đã tạo danh mục để Provider lựa chọn khi đăng dịch vụ.')
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo danh mục.')
    }
  }
  const toggle = async (category: AdminCategory) => {
    try {
      await api.setAdminCategoryActive(category.id, !category.isActive, token)
      setMessage(`Đã ${category.isActive ? 'tạm ngưng' : 'mở lại'} danh mục ${category.name}.`)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật danh mục.')
    }
  }
  const remove = (category: AdminCategory) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa danh mục',
      message: `Xóa danh mục "${category.name}"? Danh mục chỉ có thể xóa khi chưa có dịch vụ nào liên kết.`,
      confirmText: 'Xác nhận xóa',
      variant: 'danger',
      onConfirm: async () => {
        await api.adminDeleteCategory(category.id, token)
        setMessage(`Đã xóa danh mục ${category.name}.`)
        refresh()
      }
    })
  }

  const bulkToggleCategories = (active: boolean) => {
    const label = active ? 'mở lại' : 'tạm ngưng'
    setConfirmModal({
      isOpen: true,
      title: `Xác nhận ${label} danh mục`,
      message: `Xác nhận ${label} ${selectedCategories.length} danh mục đã chọn?`,
      confirmText: `Xác nhận ${label}`,
      variant: active ? 'primary' : 'warning',
      onConfirm: async () => {
        const res = active
          ? await api.bulkActivateCategories(selectedCategories, token)
          : await api.bulkDeactivateCategories(selectedCategories, token)
        setMessage(`Đã ${label} ${res.updatedCount} danh mục.`)
        setSelectedCategories([])
        refresh()
      }
    })
  }

  const bulkDeleteCategories = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa hàng loạt danh mục',
      message: `Xác nhận xóa ${selectedCategories.length} danh mục đã chọn? Chỉ danh mục chưa có dịch vụ liên kết mới có thể xóa.`,
      confirmText: 'Xóa danh mục đã chọn',
      variant: 'danger',
      onConfirm: async () => {
        const res = await api.bulkDeleteCategories(selectedCategories, token)
        let msg = `Đã xóa ${res.deletedCount} danh mục.`
        if (res.skippedCount > 0) msg += ` Bỏ qua ${res.skippedCount} danh mục do đang có dịch vụ liên kết.`
        setMessage(msg)
        setSelectedCategories([])
        refresh()
      }
    })
  }

  return (
    <section className="catalog-panel manager-catalog">
      <div className="admin-section-title">
        <div>
          <p className="eyebrow">Danh mục toàn nền tảng</p>
          <h2>Nhóm dịch vụ do Manager quản lý</h2>
        </div>
        <span className="section-note">Provider tự tạo dịch vụ cụ thể và chọn một danh mục phù hợp.</span>
      </div>

      <form onSubmit={create} className="provider-form catalog-form">
        <h3>Tạo danh mục mới</h3>
        <label>
          Tên danh mục
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Ăn uống, Thể thao & Sân bãi..."
          />
        </label>
        <label>
          <span>Biểu tượng hiển thị</span>
          <div className="icon-select-preview">
            <span className="icon-preview-box" title={`Biểu tượng Bootstrap: bi-${iconName}`}>
              <i className={`bi bi-${iconName}`} />
            </span>
            <select value={iconName} onChange={(e) => setIconName(e.target.value)}>
              {CATEGORY_ICON_DEFINITIONS.map((icon) => (
                <option value={icon.value} key={icon.value}>
                  {icon.symbol} {icon.value} — {icon.label} ({icon.note})
                </option>
              ))}
            </select>
          </div>
        </label>
        <button className="btn btn-primary rounded-pill">Thêm danh mục</button>
      </form>

      {/* Recommended Tag Presets with Service Symbols */}
      <div className="category-recommend-container">
        <div className="category-recommend-title">
          <i className="bi bi-tags-fill text-danger" />
          <span>Gợi ý danh mục phổ biến (nhấp để chọn nhanh tên và biểu tượng phù hợp):</span>
        </div>
        <div className="category-recommend-grid">
          {RECOMMENDED_CATEGORY_TAGS.map((tag) => (
            <button
              type="button"
              key={tag.name}
              className={`category-recommend-btn ${name === tag.name ? 'active' : ''}`}
              onClick={() => {
                setName(tag.name)
                setIconName(tag.iconName)
              }}
              title={`Áp dụng cho: ${tag.serviceTypes}`}
            >
              <span className="category-recommend-symbol">{tag.symbol}</span>
              <div className="category-recommend-info">
                <span className="category-recommend-name">{tag.name}</span>
                <span className="category-recommend-note">{tag.serviceTypes}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {message && <div className="alert alert-success mt-3">{message}</div>}

      <div className="section-toolbar">
        <div className="section-search">
          <i className="bi bi-search" />
          <input
            type="text"
            placeholder="Tìm kiếm danh mục theo tên, slug..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
          />
          {categorySearch && (
            <button className="search-clear" onClick={() => setCategorySearch('')} title="Xóa tìm kiếm">
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
        {selectedCategories.length > 0 && (
          <div className="bulk-actions-bar">
            <span className="bulk-count">Đã chọn <b>{selectedCategories.length}</b></span>
            <div className="bulk-buttons">
              <button className="btn btn-sm btn-outline-success" onClick={() => bulkToggleCategories(true)}>
                <i className="bi bi-check-lg" /> Mở lại
              </button>
              <button className="btn btn-sm btn-outline-warning" onClick={() => bulkToggleCategories(false)}>
                <i className="bi bi-pause-fill" /> Tạm ngưng
              </button>
              {isAdmin && (
                <button className="btn btn-sm btn-outline-danger" onClick={bulkDeleteCategories}>
                  <i className="bi bi-trash" /> Xóa
                </button>
              )}
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedCategories([])}>
                Bỏ chọn
              </button>
            </div>
          </div>
        )}
      </div>

      {filteredCategories.length > 0 && (
        <label className="d-flex align-items-center gap-2 mb-2" style={{ cursor: 'pointer', fontSize: '13px', color: '#526075' }}>
          <input
            type="checkbox"
            className="table-checkbox"
            checked={filteredCategories.length > 0 && selectedCategories.length === filteredCategories.length}
            onChange={(e) => setSelectedCategories(e.target.checked ? filteredCategories.map((c) => c.id) : [])}
          />
          <span>Chọn tất cả ({filteredCategories.length} danh mục)</span>
        </label>
      )}

      <div className="resource-list">
        {filteredCategories.length ? filteredCategories.map((category) => (
          <article className={!category.isActive ? 'inactive' : ''} key={category.id}>
            <div className="item-with-checkbox">
              <input
                type="checkbox"
                className="table-checkbox"
                checked={selectedCategories.includes(category.id)}
                onChange={(e) => {
                  setSelectedCategories((prev) =>
                    e.target.checked ? [...prev, category.id] : prev.filter((id) => id !== category.id)
                  )
                }}
                aria-label={`Chọn danh mục ${category.name}`}
              />
              <div>
                <b>
                  <i className={`bi bi-${category.iconName}`} /> {category.name}
                </b>
                <span>{category.slug} · {category.serviceCount} dịch vụ đang phân loại</span>
              </div>
            </div>
            <div className="category-actions">
              <button
                onClick={() => toggle(category)}
                className={`btn btn-sm ${category.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
              >
                {category.isActive ? 'Tạm ngưng' : 'Mở lại'}
              </button>
              {isAdmin && (
                <button
                  onClick={() => remove(category)}
                  disabled={category.serviceCount > 0}
                  title={category.serviceCount > 0 ? 'Không thể xóa danh mục đang có dịch vụ liên kết' : 'Xóa danh mục'}
                  className="btn btn-sm btn-outline-danger"
                >
                  Xóa
                </button>
              )}
            </div>
          </article>
        )) : (
          <div className="empty-state"><p>Không tìm thấy danh mục phù hợp.</p></div>
        )}
      </div>
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          variant={confirmModal.variant}
          loading={confirmLoading}
          onConfirm={async () => {
            try {
              setConfirmLoading(true)
              await confirmModal.onConfirm()
              setConfirmModal(null)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Thao tác không thành công.')
              setConfirmModal(null)
            } finally {
              setConfirmLoading(false)
            }
          }}
          onCancel={() => {
            if (!confirmLoading) setConfirmModal(null)
          }}
        />
      )}
    </section>
  )
}

function NotificationsPage({ session, onRead }: { session: Session; onRead?: () => void }) {
  const navigate = useNavigate(); const [items, setItems] = useState<Notification[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  // oxlint-disable-next-line react/set-state-in-effect -- loading belongs to the request lifecycle
  const refresh = () => { setLoading(true); api.notifications(session.accessToken).then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }
  useEffect(refresh, [session.accessToken])
  const read = async (item: Notification) => { if (!item.isRead) { await api.readNotification(item.id, session.accessToken); onRead?.() }; if (item.link) { try { const url = new URL(item.link, window.location.origin); if (url.origin === window.location.origin) navigate(url.pathname + url.search + url.hash); else window.location.assign(item.link) } catch { refresh() } } else refresh() }
  const readAll = async () => { await api.readAllNotifications(session.accessToken); onRead?.(); refresh() }
  return <div className="container dashboard"><div className="provider-heading"><div><p className="eyebrow">Trung tâm cập nhật</p><h1>Thông báo</h1></div>{items.some((x) => !x.isRead) && <button className="btn btn-outline-primary rounded-pill" onClick={readAll}>Đánh dấu đã đọc</button>}</div>{error && <div className="alert alert-danger">{error}</div>}{loading ? <div className="empty-state"><div className="spinner-border text-primary" /></div> : <div className="notification-list">{items.length ? items.map((item) => <button onClick={() => read(item)} className={item.isRead ? 'read' : ''} key={item.id}><i className={`bi ${item.isRead ? 'bi-check-circle' : 'bi-bell-fill'}`} /><span><b>{item.title}</b><small>{item.message}</small><time>{formatTime(item.createdAtUtc)}</time></span></button>) : <div className="empty-state"><i className="bi bi-bell-slash" /><h3>Chưa có thông báo</h3></div>}</div>}</div>
}

function NotFoundPage() { return <div className="container confirmation-page"><div className="confirmation-card"><span className="success-mark not-found-mark"><i className="bi bi-signpost-split" /></span><p className="eyebrow">404 · Không tìm thấy</p><h1>Trang này không còn ở đây</h1><p>Đường dẫn có thể đã thay đổi hoặc slot không tồn tại.</p><NavLink to="/" className="btn btn-primary rounded-pill px-4">Về trang khám phá</NavLink></div></div> }

export default App
