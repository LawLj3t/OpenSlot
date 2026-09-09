import type { AdminDashboard, AdminService, AdminSlot, AdminUser, Booking, BookingConfirmation, Category, DealSlot, MyProviderProfile, Notification, ProviderProfile, ProviderService, ProviderSlot, ProviderVenue, Report, Session } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? '/api'
const geocodingBase = import.meta.env.VITE_GEOCODING_URL ?? 'https://nominatim.openstreetmap.org'

export type GeocodedLocation = {
  label: string
  latitude: number
  longitude: number
}

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
}

const geocodeCacheKey = 'openslot-geocoding-cache-v1'

function readGeocodeCache(): Record<string, GeocodedLocation> {
  try { return JSON.parse(localStorage.getItem(geocodeCacheKey) ?? '{}') as Record<string, GeocodedLocation> }
  catch { return {} }
}

async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const normalized = query.trim().toLocaleLowerCase('vi-VN')
  if (!normalized) return null
  const cache = readGeocodeCache()
  if (cache[normalized]) return cache[normalized]

  const params = new URLSearchParams({ q: `${query.trim()}, Việt Nam`, format: 'jsonv2', limit: '1', countrycodes: 'vn', 'accept-language': 'vi' })
  const response = await fetch(`${geocodingBase}/search?${params}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Không thể xác định địa điểm lúc này.')
  const [result] = await response.json() as NominatimResult[]
  if (!result) return null

  const location = { label: result.display_name, latitude: Number(result.lat), longitude: Number(result.lon) }
  cache[normalized] = location
  localStorage.setItem(geocodeCacheKey, JSON.stringify(cache))
  return location
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${apiBase}${path}`, { ...init, headers })
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string; title?: string } | null
    throw new Error(problem?.detail ?? problem?.title ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.')
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
}

export const api = {
  categories: () => request<Category[]>('/categories'),
  slots: (query = '') => request<DealSlot[]>(`/slots${query}`),
  geocodeLocation,
  slot: (id: string) => request<DealSlot>(`/slots/${id}`),
  login: (email: string, password: string) => request<Session>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  register: (displayName: string, email: string, password: string) => request<Session>('/auth/register', {
    method: 'POST', body: JSON.stringify({ displayName, email, password }),
  }),
  book: (slotId: string, token: string) => request<BookingConfirmation>(`/bookings/slots/${slotId}`, { method: 'POST' }, token),
  myBookings: (token: string) => request<Booking[]>('/bookings/mine', {}, token),
  cancelBooking: (bookingId: string, reason: string, token: string) => request<void>(`/bookings/${bookingId}/cancel`, {
    method: 'POST', body: JSON.stringify({ reason }),
  }, token),
  providerSlots: (token: string) => request<ProviderSlot[]>('/provider/slots', {}, token),
  providerServices: (token: string) => request<ProviderService[]>('/provider/slots/services', {}, token),
  providerProfile: (token: string) => request<MyProviderProfile>('/provider/profile', {}, token),
  updateProviderProfile: (payload: object, token: string) => request<void>('/provider/profile', { method: 'PUT', body: JSON.stringify(payload) }, token),
  providerVenues: (token: string) => request<ProviderVenue[]>('/provider/venues', {}, token),
  createProviderVenue: (payload: object, token: string) => request('/provider/venues', { method: 'POST', body: JSON.stringify(payload) }, token),
  createProviderService: (payload: object, token: string) => request('/provider/services', { method: 'POST', body: JSON.stringify(payload) }, token),
  createProviderSlot: (payload: object, token: string) => request('/provider/slots', { method: 'POST', body: JSON.stringify(payload) }, token),
  publishProviderSlot: (slotId: string, token: string) => request(`/provider/slots/${slotId}/publish`, { method: 'POST' }, token),
  checkIn: (publicCode: string, pin: string, token: string) => request<void>('/provider/check-ins', { method: 'POST', body: JSON.stringify({ publicCode, pin }) }, token),
  completeBooking: (publicCode: string, token: string) => request<void>(`/provider/check-ins/${encodeURIComponent(publicCode)}/complete`, { method: 'POST' }, token),
  adminProviders: (token: string, status?: number) => request<ProviderProfile[]>(`/admin/providers${status === undefined ? '' : `?status=${status}`}`, {}, token),
  adminDashboard: (token: string) => request<AdminDashboard>('/admin/dashboard', {}, token),
  adminUsers: (token: string) => request<AdminUser[]>('/admin/users', {}, token),
  adminServices: (token: string) => request<AdminService[]>('/admin/services', {}, token),
  adminSlots: (token: string) => request<AdminSlot[]>('/admin/slots', {}, token),
  setServiceActive: (serviceId: string, active: boolean, token: string) => request<void>(`/admin/services/${serviceId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }, token),
  adminCancelSlot: (slotId: string, token: string) => request<void>(`/admin/slots/${slotId}/cancel`, { method: 'POST' }, token),
  suspendUser: (userId: string, token: string) => request<void>(`/admin/users/${encodeURIComponent(userId)}/suspend`, { method: 'POST' }, token),
  restoreUser: (userId: string, token: string) => request<void>(`/admin/users/${encodeURIComponent(userId)}/restore`, { method: 'POST' }, token),
  reports: (token: string) => request<Report[]>('/reports', {}, token),
  createReport: (targetType: string, targetId: string, reason: string, token: string) => request('/reports', { method: 'POST', body: JSON.stringify({ targetType, targetId, reason }) }, token),
  resolveReport: (id: string, resolutionNote: string, token: string) => request<void>(`/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolutionNote }) }, token),
  notifications: (token: string) => request<Notification[]>('/notifications', {}, token),
  readNotification: (id: string, token: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }, token),
  readAllNotifications: (token: string) => request<void>('/notifications/read-all', { method: 'POST' }, token),
  approveProvider: (providerId: string, token: string) => request(`/admin/providers/${providerId}/approve`, { method: 'POST' }, token),
  suspendProvider: (providerId: string, token: string) => request(`/admin/providers/${providerId}/suspend`, { method: 'POST' }, token),
}
