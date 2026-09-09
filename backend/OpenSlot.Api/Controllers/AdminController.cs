using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Controllers;

[Authorize(Roles = RoleNames.Admin)]
[ApiController]
[Route("api/admin")]
public sealed class AdminController(AppDbContext db) : ControllerBase
{
    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken cancellationToken) => Ok(await db.Users.AsNoTracking()
        .OrderByDescending(x => x.CreatedAtUtc)
        .Select(x => new { x.Id, x.DisplayName, x.Email, x.IsSuspended, x.StrikeCount, x.BookingSuspendedUntilUtc, x.CreatedAtUtc })
        .ToListAsync(cancellationToken));

    [HttpPost("users/{userId}/suspend")]
    public Task<IActionResult> SuspendUser(string userId, CancellationToken cancellationToken) => SetUserSuspended(userId, true, cancellationToken);

    [HttpPost("users/{userId}/restore")]
    public Task<IActionResult> RestoreUser(string userId, CancellationToken cancellationToken) => SetUserSuspended(userId, false, cancellationToken);

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var publishedSlots = await db.DealSlots.CountAsync(x => x.Status == DealSlotStatus.Published || x.Status == DealSlotStatus.SoldOut, cancellationToken);
        var totalCapacity = await db.DealSlots.Where(x => x.Status != DealSlotStatus.Draft && x.Status != DealSlotStatus.Cancelled).SumAsync(x => (int?)x.Capacity, cancellationToken) ?? 0;
        var bookedSeats = await db.DealSlots.Where(x => x.Status != DealSlotStatus.Draft && x.Status != DealSlotStatus.Cancelled).SumAsync(x => (int?)x.ConfirmedBookingCount, cancellationToken) ?? 0;
        return Ok(new
        {
            users = await db.Users.CountAsync(cancellationToken),
            providers = await db.ProviderProfiles.CountAsync(cancellationToken),
            pendingProviders = await db.ProviderProfiles.CountAsync(x => x.Status == ProviderStatus.Pending, cancellationToken),
            publishedSlots,
            bookings = await db.Bookings.CountAsync(cancellationToken),
            upcomingBookings = await db.Bookings.CountAsync(x => x.DealSlot.StartAtUtc > now && x.Status == BookingStatus.Confirmed, cancellationToken),
            openReports = await db.Reports.CountAsync(x => x.Status == ReportStatus.Open, cancellationToken),
            noShows = await db.Bookings.CountAsync(x => x.Status == BookingStatus.NoShow, cancellationToken),
            fillRatePercent = totalCapacity == 0 ? 0 : Math.Round(bookedSeats * 100d / totalCapacity, 1)
        });
    }

    [HttpGet("providers")]
    public async Task<IActionResult> GetProviders([FromQuery] ProviderStatus? status, CancellationToken cancellationToken)
    {
        var query = db.ProviderProfiles.AsNoTracking().Include(x => x.User).AsQueryable();
        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status);
        }

        var providers = await query.OrderByDescending(x => x.CreatedAtUtc).Select(x => new
        {
            x.Id,
            x.BusinessName,
            x.ContactPhone,
            x.Description,
            x.Status,
            x.CreatedAtUtc,
            ownerName = x.User.DisplayName,
            ownerEmail = x.User.Email
        }).ToListAsync(cancellationToken);
        return Ok(providers);
    }

    [HttpGet("services")]
    public async Task<IActionResult> Services(CancellationToken cancellationToken) => Ok(await db.ServiceOfferings.AsNoTracking()
        .Include(x => x.Category).Include(x => x.Venue).ThenInclude(x => x.ProviderProfile)
        .OrderByDescending(x => x.CreatedAtUtc)
        .Select(x => new { x.Id, x.Name, categoryName = x.Category.Name, venueName = x.Venue.Name, providerName = x.Venue.ProviderProfile.BusinessName, x.BasePriceVnd, x.IsActive })
        .ToListAsync(cancellationToken));

    [HttpPost("services/{serviceId:guid}/activate")]
    public Task<IActionResult> ActivateService(Guid serviceId, CancellationToken cancellationToken) => SetServiceActive(serviceId, true, cancellationToken);

    [HttpPost("services/{serviceId:guid}/deactivate")]
    public Task<IActionResult> DeactivateService(Guid serviceId, CancellationToken cancellationToken) => SetServiceActive(serviceId, false, cancellationToken);

    [HttpGet("slots")]
    public async Task<IActionResult> Slots(CancellationToken cancellationToken) => Ok(await db.DealSlots.AsNoTracking()
        .Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
        .OrderByDescending(x => x.StartAtUtc).Take(200)
        .Select(x => new { x.Id, serviceName = x.ServiceOffering.Name, venueName = x.ServiceOffering.Venue.Name, providerName = x.ServiceOffering.Venue.ProviderProfile.BusinessName, x.StartAtUtc, x.Capacity, x.ConfirmedBookingCount, x.Status })
        .ToListAsync(cancellationToken));

    [HttpPost("slots/{slotId:guid}/cancel")]
    public async Task<IActionResult> CancelSlot(Guid slotId, CancellationToken cancellationToken)
    {
        var slot = await db.DealSlots.Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.Id == slotId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);
        if (slot.ConfirmedBookingCount > 0) throw new ApiException("Không thể hủy slot đang có booking.", StatusCodes.Status409Conflict);
        if (slot.Status is DealSlotStatus.Cancelled or DealSlotStatus.Expired) throw new ApiException("Slot đã kết thúc hoặc đã hủy.");
        slot.Status = DealSlotStatus.Cancelled;
        slot.ConcurrencyToken = Guid.NewGuid();
        db.AuditLogs.Add(new() { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = "slot.admin-cancelled", EntityType = nameof(DealSlot), EntityId = slot.Id.ToString() });
        db.Notifications.Add(new Notification { UserId = slot.ServiceOffering.Venue.ProviderProfile.UserId, Title = "Slot bị quản trị viên hủy", Message = $"Slot {slot.ServiceOffering.Name} đã bị hủy sau kiểm duyệt.", Link = "/provider" });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("providers/{providerId:guid}/approve")]
    public Task<IActionResult> Approve(Guid providerId, CancellationToken cancellationToken) => SetProviderStatus(providerId, ProviderStatus.Approved, cancellationToken);

    [HttpPost("providers/{providerId:guid}/suspend")]
    public Task<IActionResult> Suspend(Guid providerId, CancellationToken cancellationToken) => SetProviderStatus(providerId, ProviderStatus.Suspended, cancellationToken);

    private async Task<IActionResult> SetProviderStatus(Guid providerId, ProviderStatus status, CancellationToken cancellationToken)
    {
        var provider = await db.ProviderProfiles.SingleOrDefaultAsync(x => x.Id == providerId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy provider.", StatusCodes.Status404NotFound);
        provider.Status = status;
        db.AuditLogs.Add(new()
        {
            ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            Action = $"provider.{status.ToString().ToLowerInvariant()}",
            EntityType = nameof(ProviderProfile),
            EntityId = providerId.ToString()
        });
        db.Notifications.Add(new OpenSlot.Api.Domain.Entities.Notification { UserId = provider.UserId, Title = status == ProviderStatus.Approved ? "Hồ sơ đối tác đã được duyệt" : "Hồ sơ đối tác bị tạm khóa", Message = status == ProviderStatus.Approved ? "Bạn có thể phát hành slot trên OpenSlot." : "Liên hệ quản trị viên nếu bạn cần hỗ trợ.", Link = "/provider" });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { provider.Id, provider.Status });
    }

    private async Task<IActionResult> SetUserSuspended(string userId, bool suspended, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy người dùng.", StatusCodes.Status404NotFound);
        if (user.Id == User.FindFirstValue(ClaimTypes.NameIdentifier)) throw new ApiException("Admin không thể tự khóa tài khoản đang đăng nhập.");
        user.IsSuspended = suspended;
        db.AuditLogs.Add(new() { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = suspended ? "user.suspended" : "user.restored", EntityType = "ApplicationUser", EntityId = user.Id });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<IActionResult> SetServiceActive(Guid serviceId, bool active, CancellationToken cancellationToken)
    {
        var service = await db.ServiceOfferings.Include(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.Id == serviceId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy dịch vụ.", StatusCodes.Status404NotFound);
        service.IsActive = active;
        db.AuditLogs.Add(new() { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = active ? "service.activated" : "service.deactivated", EntityType = nameof(ServiceOffering), EntityId = service.Id.ToString() });
        db.Notifications.Add(new Notification { UserId = service.Venue.ProviderProfile.UserId, Title = active ? "Dịch vụ đã được mở lại" : "Dịch vụ bị tạm ẩn", Message = $"Dịch vụ {service.Name} đã được quản trị viên cập nhật trạng thái.", Link = "/provider" });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
