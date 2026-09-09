using OpenSlot.Api.Contracts.Bookings;

namespace OpenSlot.Api.Services;

public interface IBookingService
{
    Task<BookingConfirmationResponse> CreateAsync(Guid dealSlotId, string customerUserId, CancellationToken cancellationToken = default);
    Task CancelAsync(Guid bookingId, string customerUserId, string? reason, CancellationToken cancellationToken = default);
    Task CheckInAsync(string providerUserId, CheckInRequest request, CancellationToken cancellationToken = default);
    Task CompleteAsync(string providerUserId, string publicCode, CancellationToken cancellationToken = default);
    Task ProcessExpirationsAsync(CancellationToken cancellationToken = default);
}
