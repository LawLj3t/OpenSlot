using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using OpenSlot.Api.Contracts.Bookings;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Api.Controllers;

[Authorize(Roles = RoleNames.Customer)]
[ApiController]
[Route("api/bookings")]
public sealed class BookingsController(AppDbContext db, IBookingService bookingService) : ControllerBase
{
    [HttpPost("slots/{dealSlotId:guid}")]
    [EnableRateLimiting("booking")]
    [ProducesResponseType<BookingConfirmationResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<BookingConfirmationResponse>> Create(Guid dealSlotId, CancellationToken cancellationToken)
    {
        var result = await bookingService.CreateAsync(dealSlotId, UserId, cancellationToken);
        return CreatedAtAction(nameof(GetMine), new { }, result);
    }

    [HttpGet("mine")]
    public async Task<ActionResult<IReadOnlyCollection<BookingListItem>>> GetMine(CancellationToken cancellationToken)
    {
        var bookings = await db.Bookings
            .AsNoTracking()
            .Include(x => x.DealSlot).ThenInclude(x => x.ServiceOffering).ThenInclude(x => x.Venue)
            .Where(x => x.CustomerUserId == UserId)
            .OrderByDescending(x => x.DealSlot.StartAtUtc)
            .Select(x => new BookingListItem(
                x.Id,
                x.PublicCode,
                x.Status,
                x.DealSlot.ServiceOffering.Name,
                x.DealSlot.ServiceOffering.Venue.Name,
                x.DealSlot.StartAtUtc,
                x.DealSlot.EndAtUtc,
                x.DealSlot.DealPriceVnd,
                x.BookedAtUtc))
            .ToListAsync(cancellationToken);
        return Ok(bookings);
    }

    [HttpPost("{bookingId:guid}/cancel")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Cancel(Guid bookingId, CancelBookingRequest request, CancellationToken cancellationToken)
    {
        await bookingService.CancelAsync(bookingId, UserId, request.Reason, cancellationToken);
        return NoContent();
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
}
