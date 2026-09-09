using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Contracts.Bookings;

public sealed record BookingConfirmationResponse(
    Guid BookingId,
    string PublicCode,
    string CheckInPin,
    string QrPayload,
    DateTime StartAtUtc,
    DateTime ExpiresAtUtc);

public sealed class CancelBookingRequest
{
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string? Reason { get; init; }
}

public sealed class CheckInRequest
{
    public string PublicCode { get; init; } = string.Empty;
    [System.ComponentModel.DataAnnotations.RegularExpression("^[0-9]{6}$", ErrorMessage = "PIN phải gồm đúng 6 chữ số.")]
    public string Pin { get; init; } = string.Empty;
}

public sealed record BookingListItem(
    Guid Id,
    string PublicCode,
    BookingStatus Status,
    string ServiceName,
    string VenueName,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    long DealPriceVnd,
    DateTime BookedAtUtc);
