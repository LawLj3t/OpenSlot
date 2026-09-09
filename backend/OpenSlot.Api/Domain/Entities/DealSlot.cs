using System.ComponentModel.DataAnnotations;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Domain.Entities;

public sealed class DealSlot
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ServiceOfferingId { get; set; }
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public DateTime BookingOpensAtUtc { get; set; }
    public DateTime BookingClosesAtUtc { get; set; }
    public long OriginalPriceVnd { get; set; }
    public long DealPriceVnd { get; set; }
    public int Capacity { get; set; }
    public int ConfirmedBookingCount { get; set; }
    public int CheckInEarlyMinutes { get; set; } = 15;
    public int CheckInLateMinutes { get; set; } = 15;
    public DealSlotStatus Status { get; set; } = DealSlotStatus.Draft;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAtUtc { get; set; }

    [ConcurrencyCheck]
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public ServiceOffering ServiceOffering { get; set; } = null!;
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
