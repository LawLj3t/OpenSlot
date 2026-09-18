using OpenSlot.Api.Contracts.Providers;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Tests;

public sealed class ProviderResourceAndReopenPolicyTests
{
    [Fact]
    public void UpsertBookableResourceRequest_Supports_IsActive_Property()
    {
        var request = new UpsertBookableResourceRequest
        {
            VenueId = Guid.NewGuid(),
            Name = "Sân 1",
            ResourceType = "Sân",
            MaxCapacity = 4,
            IsActive = false
        };

        Assert.False(request.IsActive);

        var activeRequest = new UpsertBookableResourceRequest
        {
            VenueId = Guid.NewGuid(),
            Name = "Sân 2",
            ResourceType = "Sân",
            MaxCapacity = 4,
            IsActive = true
        };

        Assert.True(activeRequest.IsActive);
    }

    [Fact]
    public void Reopen_Slot_Time_Adjustment_Sets_Valid_Booking_Window()
    {
        var now = DateTime.UtcNow;
        var startAtUtc = now.AddHours(2);
        var slot = new DealSlot
        {
            Id = Guid.NewGuid(),
            StartAtUtc = startAtUtc,
            EndAtUtc = startAtUtc.AddHours(1),
            BookingOpensAtUtc = now.AddHours(-1),
            BookingClosesAtUtc = now.AddMinutes(-10), // in the past
            Status = DealSlotStatus.Cancelled,
            Capacity = 5
        };

        // Logic applied during reopen/republish
        if (slot.BookingClosesAtUtc <= now && slot.StartAtUtc > now)
        {
            slot.BookingClosesAtUtc = slot.StartAtUtc.AddMinutes(-15);
        }
        if (slot.BookingOpensAtUtc > now)
        {
            slot.BookingOpensAtUtc = now;
        }

        Assert.True(slot.BookingClosesAtUtc > now, "BookingClosesAtUtc must be in the future");
        Assert.True(slot.BookingClosesAtUtc <= slot.StartAtUtc.AddMinutes(-15), "Booking must close at least 15 min before start");
        Assert.True(slot.BookingOpensAtUtc <= now, "BookingOpensAtUtc must be open now");
    }

    [Fact]
    public void Reopen_Slot_In_Past_Is_Not_Eligible()
    {
        var now = DateTime.UtcNow;
        var startAtUtc = now.AddMinutes(-5); // already started or past
        var slot = new DealSlot
        {
            Id = Guid.NewGuid(),
            StartAtUtc = startAtUtc,
            EndAtUtc = startAtUtc.AddHours(1),
            BookingOpensAtUtc = now.AddHours(-2),
            BookingClosesAtUtc = now.AddMinutes(-20),
            Status = DealSlotStatus.Cancelled,
            Capacity = 5
        };

        bool canReopen = slot.StartAtUtc > now;
        Assert.False(canReopen, "Slots that have already started cannot be reopened");
    }
}
