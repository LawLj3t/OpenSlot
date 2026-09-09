export type Category = {
  id: string
  name: string
  slug: string
  icon: string
}

export type DealSlot = {
  id: string
  serviceName: string
  categoryName: string
  categorySlug: string
  venueName: string
  district: string
  city: string
  latitude: number
  longitude: number
  startAtUtc: string
  endAtUtc: string
  bookingClosesAtUtc: string
  originalPriceVnd: number
  dealPriceVnd: number
  capacity: number
  remainingCapacity: number
  status: number
  distanceKm: number | null
}

export type CurrentUser = {
  id: string
  email: string
  displayName: string
  roles: string[]
}

export type Session = {
  accessToken: string
  user: CurrentUser
}

export type Booking = {
  id: string
  publicCode: string
  status: number
  serviceName: string
  venueName: string
  startAtUtc: string
  endAtUtc: string
  dealPriceVnd: number
  bookedAtUtc: string
}

export type BookingConfirmation = {
  bookingId: string
  publicCode: string
  checkInPin: string
  qrPayload: string
  startAtUtc: string
  expiresAtUtc: string
}

export type ProviderService = {
  id: string
  name: string
  venueName: string
  defaultDurationMinutes: number
  basePriceVnd: number
}

export type ProviderVenue = {
  id: string
  name: string
  addressLine: string
  district: string
  city: string
  latitude: number
  longitude: number
}

export type MyProviderProfile = {
  id: string
  businessName: string
  contactPhone: string
  description: string | null
  status: number
}

export type ProviderSlot = {
  id: string
  serviceName: string
  venueName: string
  startAtUtc: string
  endAtUtc: string
  bookingOpensAtUtc: string
  bookingClosesAtUtc: string
  originalPriceVnd: number
  dealPriceVnd: number
  capacity: number
  confirmedBookingCount: number
  status: number
}

export type ProviderProfile = {
  id: string
  businessName: string
  contactPhone: string
  description: string | null
  status: number
  createdAtUtc: string
  ownerName: string
  ownerEmail: string
}

export type Notification = {
  id: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAtUtc: string
}

export type Report = {
  id: string
  targetType: string
  targetId: string
  reason: string
  status: number
  createdAtUtc: string
  reporterName: string
  reporterEmail: string
}

export type AdminDashboard = {
  users: number
  providers: number
  pendingProviders: number
  publishedSlots: number
  bookings: number
  upcomingBookings: number
  openReports: number
  noShows: number
  fillRatePercent: number
}

export type AdminUser = {
  id: string
  displayName: string
  email: string
  isSuspended: boolean
  strikeCount: number
  bookingSuspendedUntilUtc: string | null
  createdAtUtc: string
}

export type AdminService = {
  id: string
  name: string
  categoryName: string
  venueName: string
  providerName: string
  basePriceVnd: number
  isActive: boolean
}

export type AdminSlot = {
  id: string
  serviceName: string
  venueName: string
  providerName: string
  startAtUtc: string
  capacity: number
  confirmedBookingCount: number
  status: number
}
