using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Services;

namespace OpenSlot.Tests;

public sealed class SlotAvailabilityPolicyTests
{
    [Fact]
    public void Active_checkout_hold_reduces_visible_capacity()
    {
        Assert.Equal(1, SlotAvailabilityPolicy.RemainingCapacity(capacity: 2, confirmedBookingCount: 0, activeHoldCount: 1));
    }

    [Fact]
    public void Full_checkout_hold_marks_slot_sold_out()
    {
        var status = SlotAvailabilityPolicy.ResolveStatus(DealSlotStatus.Published, 1, 0, 1, DateTime.UtcNow.AddMinutes(20), DateTime.UtcNow);
        Assert.Equal(DealSlotStatus.SoldOut, status);
    }

    [Fact]
    public void Released_hold_reopens_sold_out_slot_before_booking_close()
    {
        var status = SlotAvailabilityPolicy.ResolveStatus(DealSlotStatus.SoldOut, 1, 0, 0, DateTime.UtcNow.AddMinutes(20), DateTime.UtcNow);
        Assert.Equal(DealSlotStatus.Published, status);
    }

    [Fact]
    public void Released_hold_cannot_reopen_a_cancelled_slot()
    {
        var status = SlotAvailabilityPolicy.ResolveStatus(DealSlotStatus.Cancelled, 1, 0, 0, DateTime.UtcNow.AddMinutes(20), DateTime.UtcNow);
        Assert.Equal(DealSlotStatus.Cancelled, status);
    }
}
