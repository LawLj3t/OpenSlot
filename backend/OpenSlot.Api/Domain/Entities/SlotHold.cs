using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Domain.Entities;

/// <summary>
/// A short-lived reservation created when a customer enters checkout.
/// It prevents another customer from taking the same remaining capacity while payment is in progress.
/// </summary>
public sealed class SlotHold
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DealSlotId { get; set; }
    public string CustomerUserId { get; set; } = string.Empty;
    public SlotHoldStatus Status { get; set; } = SlotHoldStatus.Active;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? ReleasedAtUtc { get; set; }
    public DateTime? ConfirmedAtUtc { get; set; }
    public Guid? BookingId { get; set; }
    public string? ReleaseReason { get; set; }

    public DealSlot DealSlot { get; set; } = null!;
}
