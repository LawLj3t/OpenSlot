using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Services;

/// <summary>
/// Centralizes capacity math so confirmed bookings and active checkout holds
/// are always counted consistently by the API and the lifecycle worker.
/// </summary>
public static class SlotAvailabilityPolicy
{
    public static int RemainingCapacity(int capacity, int confirmedBookingCount, int activeHoldCount) =>
        Math.Max(0, capacity - confirmedBookingCount - activeHoldCount);

    public static DealSlotStatus ResolveStatus(DealSlotStatus currentStatus, int capacity, int confirmedBookingCount, int activeHoldCount, DateTime bookingClosesAtUtc, DateTime now)
    {
        if (currentStatus is DealSlotStatus.Cancelled or DealSlotStatus.Expired or DealSlotStatus.Draft)
        {
            return currentStatus;
        }

        return RemainingCapacity(capacity, confirmedBookingCount, activeHoldCount) == 0
            ? DealSlotStatus.SoldOut
            : currentStatus == DealSlotStatus.SoldOut && now < bookingClosesAtUtc
                ? DealSlotStatus.Published
                : currentStatus;
    }
}
