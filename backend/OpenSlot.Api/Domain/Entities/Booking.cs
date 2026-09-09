using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Domain.Entities;

public sealed class Booking
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DealSlotId { get; set; }
    public string CustomerUserId { get; set; } = string.Empty;
    public string PublicCode { get; set; } = string.Empty;
    public string CheckInPinHash { get; set; } = string.Empty;
    public BookingStatus Status { get; set; } = BookingStatus.Confirmed;
    public DateTime BookedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CancelledAtUtc { get; set; }
    public DateTime? CheckedInAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? CancellationReason { get; set; }

    public DealSlot DealSlot { get; set; } = null!;
    public ApplicationUser CustomerUser { get; set; } = null!;
}
