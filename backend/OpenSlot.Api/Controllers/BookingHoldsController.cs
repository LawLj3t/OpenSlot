using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenSlot.Api.Contracts.Bookings;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Api.Controllers;

[Authorize(Roles = RoleNames.Customer)]
[ApiController]
[Route("api/booking-holds")]
public sealed class BookingHoldsController(IBookingService bookingService) : ControllerBase
{
    [HttpPost("slots/{dealSlotId:guid}")]
    [EnableRateLimiting("booking")]
    [ProducesResponseType<SlotHoldResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<SlotHoldResponse>> Create(Guid dealSlotId, CancellationToken cancellationToken)
    {
        var result = await bookingService.CreateHoldAsync(dealSlotId, UserId, cancellationToken);
        return Created($"api/booking-holds/{result.HoldId}", result);
    }

    [HttpPost("{holdId:guid}/confirm")]
    [EnableRateLimiting("booking")]
    [ProducesResponseType<BookingConfirmationResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<BookingConfirmationResponse>> Confirm(Guid holdId, CancellationToken cancellationToken)
    {
        var result = await bookingService.ConfirmHoldAsync(holdId, UserId, cancellationToken);
        return Created($"/api/bookings/{result.BookingId}", result);
    }

    [HttpPost("{holdId:guid}/release")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Release(Guid holdId, CancellationToken cancellationToken)
    {
        await bookingService.ReleaseHoldAsync(holdId, UserId, cancellationToken);
        return NoContent();
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
}
