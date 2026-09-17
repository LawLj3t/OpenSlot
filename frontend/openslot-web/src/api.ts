import type { AdminCategory, AdminDashboard, AdminProviderDetail, AdminService, AdminSlot, AdminUser, Booking, BookingConfirmation, Category, ChatMessage, Conversation, ConversationDetail, DealSlot, EmailConfirmationResponse, MyProviderProfile, Notification, PasswordResetRequestResponse, ProviderProfile, ProviderResource, ProviderService, ProviderSlot, ProviderVenue, RegistrationResponse, Report, Session, SlotHold } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? '/api'
const geocodingBase = import.meta.env.VITE_GEOCODING_URL ?? 'https://nominatim.openstreetmap.org'
export const realtimeHubUrl = apiBase.replace(/\/api\/?$/, '') + '/hubs/availability'
export const chatHubUrl = apiBase.replace(/\/api\/?$/, '') + '/hubs/chat'

export type GeocodedLocation = {
  label: string
  latitude: number
  longitude: number
  district?: string
  city?: string
}

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
  address?: {
    suburb?: string
    city_district?: string
    district?: string
    county?: string
    city?: string
    town?: string
    municipality?: string
    state?: string
  }
}

const geocodeCacheKey = 'openslot-geocoding-cache-v2'

function readGeocodeCache(): Record<string, GeocodedLocation> {
  try { return JSON.parse(localStorage.getItem(geocodeCacheKey) ?? '{}') as Record<string, GeocodedLocation> }
  catch (error) {
    console.warn('Geocoding cache corrupted, resetting:', error)
    localStorage.removeItem(geocodeCacheKey)
    return {}
  }
}

function toGeocodedLocation(result: NominatimResult): GeocodedLocation {
  return {
    label: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    district: result.address?.suburb ?? result.address?.city_district ?? result.address?.district ?? result.address?.county,
    city: result.address?.city ?? result.address?.town ?? result.address?.municipality ?? result.address?.state,
  }
}

async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const normalized = query.trim().toLocaleLowerCase('vi-VN')
  if (!normalized) return null
  const cache = readGeocodeCache()
  if (cache[normalized]) return cache[normalized]

  const params = new URLSearchParams({ q: `${query.trim()}, Việt Nam`, format: 'jsonv2', limit: '1', countrycodes: 'vn', addressdetails: '1', 'accept-language': 'vi' })
  const response = await fetch(`${geocodingBase}/search?${params}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Không thể xác định địa điểm lúc này.')
  const [result] = await response.json() as NominatimResult[]
  if (!result) return null

  const location = toGeocodedLocation(result)
  cache[normalized] = location
  try {
    localStorage.setItem(geocodeCacheKey, JSON.stringify(cache))
  } catch (error) {
    console.warn('Cannot save geocode cache (storage quota exceeded):', error)
  }
  return location
}

async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<GeocodedLocation | null> {
  const cacheKey = `reverse:${latitude.toFixed(6)},${longitude.toFixed(6)}`
  const cache = readGeocodeCache()
  if (cache[cacheKey]) return cache[cacheKey]

  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': 'vi' })
  const response = await fetch(`${geocodingBase}/reverse?${params}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Không thể xác định địa chỉ lúc này.')
  const result = await response.json() as NominatimResult
  if (!result?.display_name) return null

  const location = toGeocodedLocation(result)
  cache[cacheKey] = location
  try {
    localStorage.setItem(geocodeCacheKey, JSON.stringify(cache))
  } catch (error) {
    console.warn('Cannot save geocode cache (storage quota exceeded):', error)
  }
  return location
}

async function request<T>(path: string, init: RequestInit = {}, token?: string, retryCount = 0): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 25_000)
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers, signal: controller.signal })
  } catch (error) {
    window.clearTimeout(timeoutId)
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (retryCount < 2) {
        await new Promise(resolve => window.setTimeout(resolve, 1000 * (retryCount + 1)))
        return request<T>(path, init, token, retryCount + 1)
      }
      throw new Error('Yêu cầu đang mất quá lâu. Vui lòng thử lại.')
    }
    if (error instanceof TypeError && retryCount < 2) {
      await new Promise(resolve => window.setTimeout(resolve, 1000 * (retryCount + 1)))
      return request<T>(path, init, token, retryCount + 1)
    }
    throw new Error('Không thể kết nối OpenSlot. Vui lòng kiểm tra mạng và thử lại.')
  } finally {
    window.clearTimeout(timeoutId)
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as {
      detail?: string
      title?: string
      errors?: Array<{ code?: string; description?: string }> | Record<string, string[]>
    } | null

    const rawErrors = problem?.errors
    const identityErrors = Array.isArray(rawErrors) ? rawErrors : []
    const validationErrors = rawErrors && !Array.isArray(rawErrors) && typeof rawErrors === 'object'
      ? rawErrors
      : {}
    if (response.status === 429) {
      throw new Error(problem?.detail ?? 'Bạn đã gửi quá nhiều yêu cầu email. Vui lòng chờ ít phút rồi thử lại.')
    }
    if (validationErrors.ContactPhone?.length) {
      throw new Error('Số điện thoại không hợp lệ, vui lòng nhập lại.')
    }
    if (identityErrors.find((error) => error.code === 'DuplicateEmail' || error.code === 'DuplicateUserName')) {
      throw new Error('Email này đã được sử dụng. Hãy đăng nhập hoặc dùng email khác.')
    }
    if (identityErrors.find((error) => error.code?.startsWith('Password'))) {
      throw new Error('Mật khẩu cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.')
    }
    throw new Error(problem?.detail ?? Object.values(validationErrors).flat()[0] ?? problem?.title ?? identityErrors[0]?.description ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.')
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
}

export const api = {
  categories: () => request<Category[]>('/categories'),
  slots: (query = '') => request<DealSlot[]>(`/slots${query}`),
  geocodeLocation,
  reverseGeocodeLocation,
  slot: (id: string) => request<DealSlot>(`/slots/${id}`),
  login: (email: string, password: string) => request<Session>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  register: (displayName: string, email: string, password: string) => request<RegistrationResponse>('/auth/register', {
    method: 'POST', body: JSON.stringify({ displayName, email, password }),
  }),
  confirmEmail: (userId: string, token: string) => request<EmailConfirmationResponse>('/auth/confirm-email', {
    method: 'POST', body: JSON.stringify({ userId, token }),
  }),
  resendVerification: (email: string) => request<EmailConfirmationResponse>('/auth/resend-verification', {
    method: 'POST', body: JSON.stringify({ email }),
  }),
  forgotPassword: (email: string) => request<PasswordResetRequestResponse>('/auth/forgot-password', {
    method: 'POST', body: JSON.stringify({ email }),
  }),
  resetPassword: (userId: string, token: string, password: string, confirmPassword: string) => request<EmailConfirmationResponse>('/auth/reset-password', {
    method: 'POST', body: JSON.stringify({ userId, token, password, confirmPassword }),
  }),
  applyForProvider: (payload: object, token: string) => request<Session>('/auth/provider-applications', { method: 'POST', body: JSON.stringify(payload) }, token),
  book: (slotId: string, token: string) => request<BookingConfirmation>(`/bookings/slots/${slotId}`, { method: 'POST' }, token),
  createHold: (slotId: string, token: string) => request<SlotHold>(`/booking-holds/slots/${slotId}`, { method: 'POST' }, token),
  confirmHold: (holdId: string, token: string) => request<BookingConfirmation>(`/booking-holds/${holdId}/confirm`, { method: 'POST' }, token),
  releaseHold: (holdId: string, token: string) => request<void>(`/booking-holds/${holdId}/release`, { method: 'POST' }, token),
  myBookings: (token: string) => request<Booking[]>('/bookings/mine', {}, token),
  cancelBooking: (bookingId: string, reason: string, token: string) => request<void>(`/bookings/${bookingId}/cancel`, {
    method: 'POST', body: JSON.stringify({ reason }),
  }, token),
  providerSlots: (token: string) => request<ProviderSlot[]>('/provider/slots', {}, token),
  providerServices: (token: string) => request<ProviderService[]>('/provider/slots/services', {}, token),
  providerProfile: (token: string) => request<MyProviderProfile>('/provider/profile', {}, token),
  updateProviderProfile: (payload: object, token: string) => request<void>('/provider/profile', { method: 'PUT', body: JSON.stringify(payload) }, token),
  providerVenues: (token: string) => request<ProviderVenue[]>('/provider/venues', {}, token),
  providerResources: (token: string) => request<ProviderResource[]>('/provider/resources', {}, token),
  createProviderVenue: (payload: object, token: string) => request('/provider/venues', { method: 'POST', body: JSON.stringify(payload) }, token),
  createProviderResource: (payload: object, token: string) => request('/provider/resources', { method: 'POST', body: JSON.stringify(payload) }, token),
  deactivateProviderResource: (resourceId: string, token: string) => request<void>(`/provider/resources/${resourceId}/deactivate`, { method: 'POST' }, token),
  createProviderService: (payload: object, token: string) => request('/provider/services', { method: 'POST', body: JSON.stringify(payload) }, token),
  createProviderSlot: (payload: object, token: string) => request('/provider/slots', { method: 'POST', body: JSON.stringify(payload) }, token),
  publishProviderSlot: (slotId: string, token: string) => request(`/provider/slots/${slotId}/publish`, { method: 'POST' }, token),
  checkIn: (publicCode: string, pin: string, token: string) => request<void>('/provider/check-ins', { method: 'POST', body: JSON.stringify({ publicCode, pin }) }, token),
  completeBooking: (publicCode: string, token: string) => request<void>(`/provider/check-ins/${encodeURIComponent(publicCode)}/complete`, { method: 'POST' }, token),
  adminProviders: (token: string, status?: number) => request<ProviderProfile[]>(`/admin/providers${status === undefined ? '' : `?status=${status}`}`, {}, token),
  adminProviderDetail: (providerId: string, token: string) => request<AdminProviderDetail>(`/admin/providers/${providerId}/detail`, {}, token),
  adminDashboard: (token: string) => request<AdminDashboard>('/admin/dashboard', {}, token),
  adminUsers: (token: string) => request<AdminUser[]>('/admin/users', {}, token),
  adminServices: (token: string) => request<AdminService[]>('/admin/services', {}, token),
  adminSlots: (token: string) => request<AdminSlot[]>('/admin/slots', {}, token),
  adminCategories: (token: string) => request<AdminCategory[]>('/admin/categories', {}, token),
  createAdminCategory: (payload: object, token: string) => request<AdminCategory>('/admin/categories', { method: 'POST', body: JSON.stringify(payload) }, token),
  adminDeleteCategory: (categoryId: number, token: string) => request<void>(`/admin/categories/${categoryId}`, { method: 'DELETE' }, token),
  setAdminCategoryActive: (categoryId: number, active: boolean, token: string) => request<void>(`/admin/categories/${categoryId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }, token),
  setServiceActive: (serviceId: string, active: boolean, token: string) => request<void>(`/admin/services/${serviceId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }, token),
  adminCancelSlot: (slotId: string, token: string) => request<void>(`/admin/slots/${slotId}/cancel`, { method: 'POST' }, token),
  suspendUser: (userId: string, token: string) => request<void>(`/admin/users/${encodeURIComponent(userId)}/suspend`, { method: 'POST' }, token),
  restoreUser: (userId: string, token: string) => request<void>(`/admin/users/${encodeURIComponent(userId)}/restore`, { method: 'POST' }, token),
  grantManager: (userId: string, token: string) => request<void>(`/admin/users/${encodeURIComponent(userId)}/grant-manager`, { method: 'POST' }, token),
  revokeManager: (userId: string, token: string) => request<void>(`/admin/users/${encodeURIComponent(userId)}/revoke-manager`, { method: 'POST' }, token),
  reports: (token: string) => request<Report[]>('/reports', {}, token),
  createReport: (targetType: string, targetId: string, reason: string, token: string) => request('/reports', { method: 'POST', body: JSON.stringify({ targetType, targetId, reason }) }, token),
  resolveReport: (id: string, resolutionNote: string, token: string) => request<void>(`/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolutionNote }) }, token),
  notifications: (token: string) => request<Notification[]>('/notifications', {}, token),
  readNotification: (id: string, token: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }, token),
  readAllNotifications: (token: string) => request<void>('/notifications/read-all', { method: 'POST' }, token),
  approveProvider: (providerId: string, token: string) => request(`/admin/providers/${providerId}/approve`, { method: 'POST' }, token),
  suspendProvider: (providerId: string, token: string) => request(`/admin/providers/${providerId}/suspend`, { method: 'POST' }, token),
  rejectProvider: (providerId: string, token: string) => request(`/admin/providers/${providerId}/reject`, { method: 'POST' }, token),
  adminDeleteProvider: (providerId: string, token: string) => request<void>(`/admin/providers/${providerId}`, { method: 'DELETE' }, token),
  resubmitProviderProfile: (token: string) => request('/provider/profile/resubmit', { method: 'POST' }, token),
  chatConversations: (token: string) => request<Conversation[]>('/chat/conversations', {}, token),
  createConversation: (payload: { providerId?: string | null; topic: string; initialMessage: string }, token: string) => request<ConversationDetail>('/chat/conversations', { method: 'POST', body: JSON.stringify(payload) }, token),
  chatConversation: (id: string, token: string) => request<ConversationDetail>(`/chat/conversations/${id}`, {}, token),
  sendChatMessage: (id: string, content: string, token: string) => request<ChatMessage>(`/chat/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }, token),
  markConversationRead: (id: string, token: string) => request<void>(`/chat/conversations/${id}/read`, { method: 'POST' }, token),
  closeConversation: (id: string, token: string) => request<void>(`/chat/conversations/${id}/close`, { method: 'POST' }, token),
}
