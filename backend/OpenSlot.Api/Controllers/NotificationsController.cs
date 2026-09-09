using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Data;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public sealed class NotificationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var items = await db.Notifications.AsNoTracking()
            .Where(x => x.UserId == UserId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(50)
            .Select(x => new { x.Id, x.Title, x.Message, x.Link, x.IsRead, x.CreatedAtUtc })
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.UserId == UserId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy thông báo.", StatusCodes.Status404NotFound);
        item.IsRead = true;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        await db.Notifications.Where(x => x.UserId == UserId && !x.IsRead)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsRead, true), cancellationToken);
        return NoContent();
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
}
