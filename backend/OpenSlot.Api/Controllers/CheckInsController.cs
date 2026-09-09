using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSlot.Api.Contracts.Bookings;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Api.Controllers;

[Authorize(Roles = RoleNames.Provider)]
[ApiController]
[Route("api/provider/check-ins")]
public sealed class CheckInsController(IBookingService bookingService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> CheckIn(CheckInRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PublicCode) || string.IsNullOrWhiteSpace(request.Pin))
        {
            throw new ApiException("Mã booking và PIN là bắt buộc.");
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        await bookingService.CheckInAsync(userId, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("{publicCode}/complete")]
    public async Task<IActionResult> Complete(string publicCode, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        await bookingService.CompleteAsync(userId, publicCode, cancellationToken);
        return NoContent();
    }
}
