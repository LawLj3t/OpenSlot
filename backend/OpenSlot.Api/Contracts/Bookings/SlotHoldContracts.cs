namespace OpenSlot.Api.Contracts.Bookings;

public sealed record SlotHoldResponse(
    Guid HoldId,
    Guid DealSlotId,
    DateTime ExpiresAtUtc,
    int RemainingCapacity,
    int Capacity);
