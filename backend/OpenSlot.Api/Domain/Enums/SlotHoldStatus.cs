namespace OpenSlot.Api.Domain.Enums;

/// <summary>
/// Lifecycle of a checkout hold. Only an active hold reserves capacity.
/// </summary>
public enum SlotHoldStatus
{
    Active = 0,
    Confirmed = 1,
    Released = 2,
    Expired = 3
}
