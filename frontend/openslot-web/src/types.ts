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
  resourceName: string | null
  resourceCode: string | null
  resourceLocation: string | null
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
  activeRole?: PortalRole
}

export type PortalRole = 'Customer' | 'Provider' | 'Manager' | 'Admin'

export type Booking = {
  id: string
  publicCode: string
  status: number
  serviceName: string
  venueName: string
  resourceName: string | null
  resourceCode: string | null
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
  venueId: string
  venueName: string
  basePriceVnd: number
}

export type ProviderResource = {
  id: string
  venueId: string
  venueName: string
  name: string
  resourceType: string
  code: string | null
  floorOrZone: string | null
  positionDescription: string | null
  maxCapacity: number
  isActive: boolean
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
  resourceName: string
  resourceCode: string | null
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

export type AdminProviderDetail = {
  id: string
  businessName: string
  contactPhone: string
  description: string | null
  status: number
  createdAtUtc: string
  ownerName: string
  ownerEmail: string
  summary: {
    venueCount: number
    resourceCount: number
    serviceCount: number
    publishedSlotCount: number
    bookingCount: number
  }
  venues: Array<{
    id: string
    name: string
    addressLine: string
    district: string
    city: string
    resources: Array<{
      id: string
      name: string
      resourceType: string
      code: string | null
      floorOrZone: string | null
      positionDescription: string | null
      maxCapacity: number
      isActive: boolean
    }>
  }>
  services: Array<{
    id: string
    name: string
    categoryName: string
    venueName: string
    basePriceVnd: number
    isActive: boolean
  }>
  slots: Array<{
    id: string
    serviceName: string
    categoryName: string
    venueName: string
    resourceName: string | null
    resourceCode: string | null
    startAtUtc: string
    endAtUtc: string
    capacity: number
    confirmedBookingCount: number
    dealPriceVnd: number
    status: number
  }>
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
  roles: string[]
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

export type AdminCategory = {
  id: number
  name: string
  slug: string
  iconName: string
  isActive: boolean
  serviceCount: number
}
