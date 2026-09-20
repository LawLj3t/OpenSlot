using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Admin;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Realtime;
using OpenSlot.Api.Services;

namespace OpenSlot.Api.Controllers;

[Authorize(Roles = RoleNames.ManagerOrAdmin)]
[ApiController]
[Route("api/admin")]
public sealed class AdminController(AppDbContext db, UserManager<ApplicationUser> userManager, ISlotAvailabilityNotifier? availabilityNotifier = null) : ControllerBase
{
    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken cancellationToken)
    {
        var users = await db.Users.AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var response = new List<object>(users.Count);
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            response.Add(new
            {
                user.Id,
                user.DisplayName,
                user.Email,
                user.IsSuspended,
                user.StrikeCount,
                user.BookingSuspendedUntilUtc,
                user.CreatedAtUtc,
                Roles = roles.OrderBy(role => role).ToArray()
            });
        }
        return Ok(response);
    }

    [HttpPost("users/{userId}/suspend")]
    public Task<IActionResult> SuspendUser(string userId, CancellationToken cancellationToken) => SetUserSuspended(userId, true, cancellationToken);

    [HttpPost("users/{userId}/restore")]
    public Task<IActionResult> RestoreUser(string userId, CancellationToken cancellationToken) => SetUserSuspended(userId, false, cancellationToken);

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("users/{userId}/grant-manager")]
    public Task<IActionResult> GrantManager(string userId, CancellationToken cancellationToken) => SetManagerRole(userId, true, cancellationToken);

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("users/{userId}/revoke-manager")]
    public Task<IActionResult> RevokeManager(string userId, CancellationToken cancellationToken) => SetManagerRole(userId, false, cancellationToken);

    [Authorize(Roles = RoleNames.Admin)]
    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> DeleteUser(string userId, CancellationToken cancellationToken)
    {
        var (success, error) = await TryDeleteUserInternalAsync(userId, cancellationToken);
        if (!success) throw new ApiException(error ?? "Không thể xóa tài khoản.", StatusCodes.Status400BadRequest);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("users/bulk-delete")]
    public async Task<IActionResult> BulkDeleteUsers(BulkIdsRequest<string> request, CancellationToken cancellationToken)
    {
        var deletedCount = 0;
        var skipped = new List<string>();
        foreach (var id in request.Ids.Distinct())
        {
            var (success, error) = await TryDeleteUserInternalAsync(id, cancellationToken);
            if (success) deletedCount++;
            else if (!string.IsNullOrWhiteSpace(error)) skipped.Add(error);
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { deletedCount, skippedCount = skipped.Count, skipped });
    }

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
        var query = db.ProviderProfiles.AsNoTracking().Include(x => x.User).Include(x => x.Category).AsQueryable();
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
            x.CategoryId,
            categoryName = x.Category != null ? x.Category.Name : null,
            x.CreatedAtUtc,
            ownerName = x.User.DisplayName,
            ownerEmail = x.User.Email
        }).ToListAsync(cancellationToken);
        return Ok(providers);
    }

    [HttpGet("providers/{providerId:guid}/detail")]
    public async Task<IActionResult> GetProviderDetail(Guid providerId, CancellationToken cancellationToken)
    {
        var provider = await db.ProviderProfiles.AsNoTracking()
            .Include(x => x.User)
            .Include(x => x.Category)
            .Include(x => x.Venues).ThenInclude(x => x.Resources)
            .Include(x => x.Venues).ThenInclude(x => x.ServiceOfferings).ThenInclude(x => x.Category)
            .Include(x => x.Venues).ThenInclude(x => x.ServiceOfferings).ThenInclude(x => x.DealSlots).ThenInclude(x => x.BookableResource)
            .SingleOrDefaultAsync(x => x.Id == providerId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy đối tác.", StatusCodes.Status404NotFound);

        var slots = provider.Venues.SelectMany(venue => venue.ServiceOfferings.SelectMany(service => service.DealSlots.Select(slot => new
            {
                slot.Id,
                serviceName = service.Name,
                categoryName = service.Category.Name,
                venueName = venue.Name,
                resourceName = slot.BookableResource?.Name,
                resourceCode = slot.BookableResource?.Code,
                slot.StartAtUtc,
                slot.EndAtUtc,
                slot.Capacity,
                slot.ConfirmedBookingCount,
                slot.DealPriceVnd,
                slot.Status
            })))
            .OrderByDescending(slot => slot.StartAtUtc)
            .Take(30)
            .ToList();

        return Ok(new
        {
            provider.Id,
            provider.BusinessName,
            provider.ContactPhone,
            provider.Description,
            provider.Status,
            provider.CategoryId,
            categoryName = provider.Category != null ? provider.Category.Name : null,
            provider.CreatedAtUtc,
            ownerName = provider.User.DisplayName,
            ownerEmail = provider.User.Email,
            summary = new
            {
                venueCount = provider.Venues.Count,
                resourceCount = provider.Venues.Sum(venue => venue.Resources.Count),
                serviceCount = provider.Venues.Sum(venue => venue.ServiceOfferings.Count),
                publishedSlotCount = provider.Venues.SelectMany(venue => venue.ServiceOfferings).SelectMany(service => service.DealSlots).Count(slot => slot.Status is DealSlotStatus.Published or DealSlotStatus.SoldOut),
                bookingCount = provider.Venues.SelectMany(venue => venue.ServiceOfferings).SelectMany(service => service.DealSlots).Sum(slot => slot.ConfirmedBookingCount)
            },
            venues = provider.Venues.OrderBy(venue => venue.Name).Select(venue => new
            {
                venue.Id,
                venue.Name,
                venue.AddressLine,
                venue.District,
                venue.City,
                resources = venue.Resources.OrderBy(resource => resource.Name).Select(resource => new
                {
                    resource.Id,
                    resource.Name,
                    resource.ResourceType,
                    resource.Code,
                    resource.FloorOrZone,
                    resource.PositionDescription,
                    resource.MaxCapacity,
                    resource.IsActive
                })
            }),
            services = provider.Venues.SelectMany(venue => venue.ServiceOfferings.Select(service => new
            {
                service.Id,
                service.Name,
                categoryName = service.Category.Name,
                venueName = venue.Name,
                service.BasePriceVnd,
                service.IsActive
            })).OrderBy(service => service.Name),
            slots
        });
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

    [HttpPost("services/bulk-active")]
    public async Task<IActionResult> BulkSetServiceActive(BulkActiveRequest request, CancellationToken cancellationToken)
    {
        var updatedCount = 0;
        foreach (var id in request.Ids.Distinct())
        {
            var service = await db.ServiceOfferings.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (service == null || service.IsActive == request.IsActive) continue;
            service.IsActive = request.IsActive;
            db.AuditLogs.Add(new AuditLog
            {
                ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                Action = request.IsActive ? "service.activated" : "service.deactivated",
                EntityType = nameof(ServiceOffering),
                EntityId = service.Id.ToString()
            });
            updatedCount++;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { updatedCount });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpDelete("services/{serviceId:guid}")]
    public async Task<IActionResult> DeleteService(Guid serviceId, CancellationToken cancellationToken)
    {
        var (success, error, isSoftDeleted) = await TryDeleteServiceInternalAsync(serviceId, cancellationToken);
        if (!success) throw new ApiException(error ?? "Không thể xóa dịch vụ.", StatusCodes.Status400BadRequest);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new
        {
            success = true,
            isSoftDeleted,
            message = isSoftDeleted
                ? "Dịch vụ đã có lịch sử đặt chỗ trước đây. Hệ thống đã chuyển sang trạng thái ngưng hoạt động (ẩn) để bảo toàn dữ liệu giao dịch cho khách hàng và đối tác, đồng thời hủy các slot chưa diễn ra."
                : "Dịch vụ đã được xóa hoàn toàn khỏi hệ thống do chưa có lịch sử đặt chỗ nào."
        });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("services/bulk-delete")]
    public async Task<IActionResult> BulkDeleteServices(BulkIdsRequest<Guid> request, CancellationToken cancellationToken)
    {
        var deletedCount = 0;
        var softDeletedCount = 0;
        var skipped = new List<string>();
        foreach (var id in request.Ids.Distinct())
        {
            var (success, error, isSoftDeleted) = await TryDeleteServiceInternalAsync(id, cancellationToken);
            if (success)
            {
                if (isSoftDeleted) softDeletedCount++;
                else deletedCount++;
            }
            else if (!string.IsNullOrWhiteSpace(error)) skipped.Add(error);
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { deletedCount, softDeletedCount, skippedCount = skipped.Count, skipped });
    }

    [HttpGet("slots")]
    public async Task<IActionResult> Slots(CancellationToken cancellationToken) => Ok(await db.DealSlots.AsNoTracking()
        .Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
        .OrderByDescending(x => x.StartAtUtc).Take(200)
        .Select(x => new { x.Id, serviceName = x.ServiceOffering.Name, venueName = x.ServiceOffering.Venue.Name, providerName = x.ServiceOffering.Venue.ProviderProfile.BusinessName, x.StartAtUtc, x.EndAtUtc, x.BookingClosesAtUtc, x.Capacity, x.ConfirmedBookingCount, x.Status })
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
        if (availabilityNotifier != null)
        {
            await availabilityNotifier.PublishAsync(
                new SlotAvailabilityUpdate(
                    slot.Id,
                    0,
                    slot.Capacity,
                    slot.Status,
                    "slot-cancelled"),
                cancellationToken);
        }
        return NoContent();
    }

    [HttpPost("slots/bulk-cancel")]
    public async Task<IActionResult> BulkCancelSlots(BulkIdsRequest<Guid> request, CancellationToken cancellationToken)
    {
        var cancelledCount = 0;
        var skipped = new List<string>();
        var cancelledSlots = new List<DealSlot>();
        foreach (var id in request.Ids.Distinct())
        {
            var slot = await db.DealSlots
                .Include(x => x.ServiceOffering)
                    .ThenInclude(s => s.Venue)
                        .ThenInclude(v => v.ProviderProfile)
                .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

            if (slot == null || slot.Status is DealSlotStatus.Cancelled or DealSlotStatus.Expired) continue;
            if (slot.ConfirmedBookingCount > 0)
            {
                skipped.Add($"Slot “{slot.ServiceOffering.Name}” đã có khách đặt chỗ.");
                continue;
            }
            slot.Status = DealSlotStatus.Cancelled;
            slot.ConcurrencyToken = Guid.NewGuid();
            db.AuditLogs.Add(new AuditLog
            {
                ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                Action = "slot.admin-cancelled",
                EntityType = nameof(DealSlot),
                EntityId = slot.Id.ToString()
            });
            db.Notifications.Add(new Notification
            {
                UserId = slot.ServiceOffering.Venue.ProviderProfile.UserId,
                Title = "Slot bị quản trị viên hủy",
                Message = $"Slot {slot.ServiceOffering.Name} đã bị hủy sau kiểm duyệt.",
                Link = "/provider"
            });
            cancelledSlots.Add(slot);
            cancelledCount++;
        }
        await db.SaveChangesAsync(cancellationToken);
        if (availabilityNotifier != null)
        {
            foreach (var s in cancelledSlots)
            {
                await availabilityNotifier.PublishAsync(
                    new SlotAvailabilityUpdate(
                        s.Id,
                        0,
                        s.Capacity,
                        s.Status,
                        "slot-cancelled"),
                    cancellationToken);
            }
        }
        return Ok(new { cancelledCount, skippedCount = skipped.Count, skipped });
    }

    [HttpPost("slots/{slotId:guid}/reopen")]
    public async Task<IActionResult> ReopenSlot(Guid slotId, CancellationToken cancellationToken)
    {
        var (success, error) = await TryReopenSlotInternalAsync(slotId, cancellationToken);
        if (!success) throw new ApiException(error ?? "Không thể mở lại slot.", StatusCodes.Status400BadRequest);
        await db.SaveChangesAsync(cancellationToken);
        if (availabilityNotifier != null)
        {
            var slot = await db.DealSlots.AsNoTracking().FirstOrDefaultAsync(x => x.Id == slotId, cancellationToken);
            if (slot != null)
            {
                await availabilityNotifier.PublishAsync(
                    new SlotAvailabilityUpdate(
                        slot.Id,
                        SlotAvailabilityPolicy.RemainingCapacity(slot.Capacity, slot.ConfirmedBookingCount, 0),
                        slot.Capacity,
                        slot.Status,
                        "slot-reopened"),
                    cancellationToken);
            }
        }
        return NoContent();
    }

    [HttpPost("slots/bulk-reopen")]
    public async Task<IActionResult> BulkReopenSlots(BulkIdsRequest<Guid> request, CancellationToken cancellationToken)
    {
        var reopenedCount = 0;
        var skipped = new List<string>();
        var reopenedIds = new List<Guid>();
        foreach (var id in request.Ids.Distinct())
        {
            var (success, error) = await TryReopenSlotInternalAsync(id, cancellationToken);
            if (success)
            {
                reopenedCount++;
                reopenedIds.Add(id);
            }
            else if (!string.IsNullOrWhiteSpace(error)) skipped.Add(error);
        }
        await db.SaveChangesAsync(cancellationToken);
        if (availabilityNotifier != null && reopenedIds.Count > 0)
        {
            var reopenedSlots = await db.DealSlots.AsNoTracking().Where(x => reopenedIds.Contains(x.Id)).ToListAsync(cancellationToken);
            foreach (var slot in reopenedSlots)
            {
                await availabilityNotifier.PublishAsync(
                    new SlotAvailabilityUpdate(
                        slot.Id,
                        SlotAvailabilityPolicy.RemainingCapacity(slot.Capacity, slot.ConfirmedBookingCount, 0),
                        slot.Capacity,
                        slot.Status,
                        "slot-reopened"),
                    cancellationToken);
            }
        }
        return Ok(new { reopenedCount, skippedCount = skipped.Count, skipped });
    }

    [HttpPost("providers/{providerId:guid}/approve")]
    public Task<IActionResult> Approve(Guid providerId, CancellationToken cancellationToken) => SetProviderStatus(providerId, ProviderStatus.Approved, cancellationToken);

    [HttpPost("providers/{providerId:guid}/suspend")]
    public Task<IActionResult> Suspend(Guid providerId, CancellationToken cancellationToken) => SetProviderStatus(providerId, ProviderStatus.Suspended, cancellationToken);

    [HttpPost("providers/{providerId:guid}/reject")]
    public Task<IActionResult> Reject(Guid providerId, CancellationToken cancellationToken) => SetProviderStatus(providerId, ProviderStatus.Rejected, cancellationToken);

    [HttpPost("providers/bulk-status")]
    public async Task<IActionResult> BulkSetProviderStatus(BulkStatusRequest request, CancellationToken cancellationToken)
    {
        var updatedCount = 0;
        foreach (var id in request.Ids.Distinct())
        {
            var provider = await db.ProviderProfiles.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (provider == null || provider.Status == request.Status) continue;
            provider.Status = request.Status;
            db.AuditLogs.Add(new()
            {
                ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                Action = $"provider.{request.Status.ToString().ToLowerInvariant()}",
                EntityType = nameof(ProviderProfile),
                EntityId = id.ToString()
            });
            var (title, message) = request.Status switch
            {
                ProviderStatus.Approved => ("Hồ sơ đối tác đã được duyệt", "Bạn có thể phát hành slot trên OpenSlot."),
                ProviderStatus.Rejected => ("Hồ sơ đối tác cần bổ sung", "Hãy cập nhật thông tin cửa hàng rồi gửi lại để Manager xét duyệt."),
                ProviderStatus.Deleted => ("Hồ sơ đối tác đã bị xóa", "Hồ sơ của bạn đã bị xóa bởi quản trị viên hệ thống."),
                _ => ("Hồ sơ đối tác bị tạm khóa", "Liên hệ quản trị viên nếu bạn cần hỗ trợ.")
            };
            db.Notifications.Add(new Notification { UserId = provider.UserId, Title = title, Message = message, Link = "/provider" });
            updatedCount++;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { updatedCount });
    }

    private async Task<(bool Success, string? Error)> TryDeleteProviderInternalAsync(Guid providerId, CancellationToken cancellationToken)
    {
        var provider = await db.ProviderProfiles
            .Include(x => x.Venues)
                .ThenInclude(v => v.ServiceOfferings)
                    .ThenInclude(s => s.DealSlots)
            .SingleOrDefaultAsync(x => x.Id == providerId, cancellationToken);

        if (provider == null) return (false, "Không tìm thấy đối tác.");
        if (provider.Status == ProviderStatus.Deleted) return (false, "Đối tác này đã được xóa trước đó.");

        var activeBookingsCount = await db.Bookings.CountAsync(b =>
            b.DealSlot.ServiceOffering.Venue.ProviderProfileId == providerId &&
            (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.CheckedIn),
            cancellationToken);

        if (activeBookingsCount > 0)
        {
            return (false, $"Đối tác “{provider.BusinessName}” còn {activeBookingsCount} booking đang hoạt động.");
        }

        var now = DateTime.UtcNow;
        var activeHoldsCount = await db.SlotHolds.CountAsync(h =>
            h.DealSlot.ServiceOffering.Venue.ProviderProfileId == providerId &&
            h.Status == SlotHoldStatus.Active &&
            h.ExpiresAtUtc > now,
            cancellationToken);

        if (activeHoldsCount > 0)
        {
            return (false, $"Đối tác “{provider.BusinessName}” đang có khách hàng giữ chỗ thanh toán.");
        }

        provider.Status = ProviderStatus.Deleted;

        var slotsToCancel = provider.Venues
            .SelectMany(v => v.ServiceOfferings)
            .SelectMany(s => s.DealSlots)
            .Where(s => s.Status is DealSlotStatus.Published or DealSlotStatus.Draft)
            .ToList();

        foreach (var slot in slotsToCancel)
        {
            slot.Status = DealSlotStatus.Cancelled;
            slot.ConcurrencyToken = Guid.NewGuid();
        }

        foreach (var venue in provider.Venues)
        {
            foreach (var service in venue.ServiceOfferings)
            {
                service.IsActive = false;
            }
        }

        var resources = await db.BookableResources
            .Where(r => r.Venue.ProviderProfileId == providerId)
            .ToListAsync(cancellationToken);

        foreach (var resource in resources)
        {
            resource.IsActive = false;
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            Action = "provider.deleted",
            EntityType = nameof(ProviderProfile),
            EntityId = provider.Id.ToString()
        });

        db.Notifications.Add(new Notification
        {
            UserId = provider.UserId,
            Title = "Hồ sơ đối tác đã bị xóa",
            Message = $"Hồ sơ đối tác {provider.BusinessName} đã bị xóa bởi quản trị viên hệ thống.",
            Link = "/provider"
        });

        return (true, null);
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpDelete("providers/{providerId:guid}")]
    public async Task<IActionResult> DeleteProvider(Guid providerId, CancellationToken cancellationToken)
    {
        var (success, error) = await TryDeleteProviderInternalAsync(providerId, cancellationToken);
        if (!success) throw new ApiException(error ?? "Không thể xóa đối tác.", StatusCodes.Status400BadRequest);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("providers/bulk-delete")]
    public async Task<IActionResult> BulkDeleteProviders(BulkIdsRequest<Guid> request, CancellationToken cancellationToken)
    {
        var deletedCount = 0;
        var skipped = new List<string>();
        foreach (var id in request.Ids.Distinct())
        {
            var (success, error) = await TryDeleteProviderInternalAsync(id, cancellationToken);
            if (success) deletedCount++;
            else if (error != null) skipped.Add(error);
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { deletedCount, skippedCount = skipped.Count, skipped });
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken cancellationToken) => Ok(await db.Categories.AsNoTracking()
        .OrderBy(x => x.Name)
        .Select(x => new { x.Id, x.Name, x.Slug, x.IconName, x.IsActive, serviceCount = x.ServiceOfferings.Count })
        .ToListAsync(cancellationToken));

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory(CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        var baseSlug = CategorySlugGenerator.Generate(request.Name);
        if (string.IsNullOrWhiteSpace(baseSlug)) throw new ApiException("Tên danh mục phải chứa chữ hoặc số.");
        var slug = baseSlug;
        var suffix = 2;
        while (await db.Categories.AnyAsync(x => x.Slug == slug, cancellationToken)) slug = $"{baseSlug}-{suffix++}";

        var category = new Category { Name = request.Name.Trim(), Slug = slug, IconName = request.IconName.Trim(), IsActive = true };
        db.Categories.Add(category);
        await db.SaveChangesAsync(cancellationToken);
        db.AuditLogs.Add(new AuditLog { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = "category.created", EntityType = nameof(Category), EntityId = category.Id.ToString() });
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/admin/categories/{category.Id}", new { category.Id, category.Name, category.Slug, category.IconName, category.IsActive });
    }

    [HttpPut("categories/{categoryId:int}")]
    public async Task<IActionResult> UpdateCategory(int categoryId, UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == categoryId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy danh mục.", StatusCodes.Status404NotFound);
        category.Name = request.Name.Trim();
        category.IconName = request.IconName.Trim();
        db.AuditLogs.Add(new AuditLog { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = "category.updated", EntityType = nameof(Category), EntityId = category.Id.ToString() });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("categories/{categoryId:int}/activate")]
    public Task<IActionResult> ActivateCategory(int categoryId, CancellationToken cancellationToken) => SetCategoryActive(categoryId, true, cancellationToken);

    [HttpPost("categories/{categoryId:int}/deactivate")]
    public Task<IActionResult> DeactivateCategory(int categoryId, CancellationToken cancellationToken) => SetCategoryActive(categoryId, false, cancellationToken);

    [Authorize(Roles = RoleNames.Admin)]
    [HttpDelete("categories/{categoryId:int}")]
    public async Task<IActionResult> DeleteCategory(int categoryId, CancellationToken cancellationToken)
    {
        var category = await db.Categories.Include(x => x.ServiceOfferings)
            .SingleOrDefaultAsync(x => x.Id == categoryId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy danh mục.", StatusCodes.Status404NotFound);

        if (category.ServiceOfferings.Any())
        {
            throw new ApiException($"Không thể xóa danh mục “{category.Name}” vì đang có {category.ServiceOfferings.Count} dịch vụ liên kết. Hãy chuyển hoặc xóa dịch vụ trước.", StatusCodes.Status409Conflict);
        }

        db.Categories.Remove(category);
        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            Action = "category.deleted",
            EntityType = nameof(Category),
            EntityId = category.Id.ToString()
        });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("categories/bulk-delete")]
    public async Task<IActionResult> BulkDeleteCategories(BulkIdsRequest<int> request, CancellationToken cancellationToken)
    {
        var deletedCount = 0;
        var skipped = new List<string>();
        foreach (var id in request.Ids.Distinct())
        {
            var category = await db.Categories.Include(x => x.ServiceOfferings)
                .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (category == null) continue;
            if (category.ServiceOfferings.Any())
            {
                skipped.Add($"Danh mục “{category.Name}” đang có {category.ServiceOfferings.Count} dịch vụ liên kết.");
                continue;
            }
            db.Categories.Remove(category);
            db.AuditLogs.Add(new AuditLog
            {
                ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                Action = "category.deleted",
                EntityType = nameof(Category),
                EntityId = category.Id.ToString()
            });
            deletedCount++;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { deletedCount, skippedCount = skipped.Count, skipped });
    }

    [HttpPost("categories/bulk-activate")]
    public async Task<IActionResult> BulkActivateCategories(BulkIdsRequest<int> request, CancellationToken cancellationToken)
    {
        var updatedCount = 0;
        foreach (var id in request.Ids.Distinct())
        {
            var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (category == null || category.IsActive) continue;
            category.IsActive = true;
            db.AuditLogs.Add(new AuditLog { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = "category.activated", EntityType = nameof(Category), EntityId = category.Id.ToString() });
            updatedCount++;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { updatedCount });
    }

    [HttpPost("categories/bulk-deactivate")]
    public async Task<IActionResult> BulkDeactivateCategories(BulkIdsRequest<int> request, CancellationToken cancellationToken)
    {
        var updatedCount = 0;
        var skipped = new List<string>();
        var now = DateTime.UtcNow;
        foreach (var id in request.Ids.Distinct())
        {
            var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (category == null || !category.IsActive) continue;
            var hasFutureSlots = await db.DealSlots.AnyAsync(x => x.ServiceOffering.CategoryId == id && x.Status == DealSlotStatus.Published && x.StartAtUtc > now, cancellationToken);
            if (hasFutureSlots)
            {
                skipped.Add($"Danh mục “{category.Name}” đang có slot công khai trong tương lai.");
                continue;
            }
            category.IsActive = false;
            db.AuditLogs.Add(new AuditLog { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = "category.deactivated", EntityType = nameof(Category), EntityId = category.Id.ToString() });
            updatedCount++;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { updatedCount, skippedCount = skipped.Count, skipped });
    }

    [HttpPost("users/bulk-suspend")]
    public async Task<IActionResult> BulkSetUserSuspended(BulkUserSuspendRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isCurrentAdmin = User.IsInRole(RoleNames.Admin);
        var updatedCount = 0;
        foreach (var id in request.Ids.Distinct())
        {
            if (id == currentUserId) continue;
            var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (user == null || user.IsSuspended == request.IsSuspended) continue;
            var targetRoles = await userManager.GetRolesAsync(user);
            if (targetRoles.Contains(RoleNames.Admin)) continue;
            if (!isCurrentAdmin && targetRoles.Contains(RoleNames.Manager)) continue;

            user.IsSuspended = request.IsSuspended;
            db.AuditLogs.Add(new()
            {
                ActorUserId = currentUserId,
                Action = request.IsSuspended ? "user.suspended" : "user.restored",
                EntityType = "ApplicationUser",
                EntityId = user.Id
            });
            updatedCount++;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { updatedCount });
    }

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
        var (title, message) = status switch
        {
            ProviderStatus.Approved => ("Hồ sơ đối tác đã được duyệt", "Bạn có thể phát hành slot trên OpenSlot."),
            ProviderStatus.Rejected => ("Hồ sơ đối tác cần bổ sung", "Hãy cập nhật thông tin cửa hàng rồi gửi lại để Manager xét duyệt."),
            ProviderStatus.Deleted => ("Hồ sơ đối tác đã bị xóa", "Hồ sơ của bạn đã bị xóa bởi quản trị viên hệ thống."),
            _ => ("Hồ sơ đối tác bị tạm khóa", "Liên hệ quản trị viên nếu bạn cần hỗ trợ.")
        };
        db.Notifications.Add(new OpenSlot.Api.Domain.Entities.Notification { UserId = provider.UserId, Title = title, Message = message, Link = "/provider" });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { provider.Id, provider.Status });
    }

    private async Task<IActionResult> SetCategoryActive(int categoryId, bool active, CancellationToken cancellationToken)
    {
        var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == categoryId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy danh mục.", StatusCodes.Status404NotFound);
        if (category.IsActive == active) return Ok(new { category.Id, category.IsActive });
        if (!active && await db.DealSlots.AnyAsync(x => x.ServiceOffering.CategoryId == categoryId && x.Status == DealSlotStatus.Published && x.StartAtUtc > DateTime.UtcNow, cancellationToken))
        {
            throw new ApiException("Không thể tạm ngưng danh mục đang có slot công khai trong tương lai.", StatusCodes.Status409Conflict);
        }
        category.IsActive = active;
        db.AuditLogs.Add(new AuditLog { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = active ? "category.activated" : "category.deactivated", EntityType = nameof(Category), EntityId = category.Id.ToString() });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { category.Id, category.IsActive });
    }

    private async Task<IActionResult> SetUserSuspended(string userId, bool suspended, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy người dùng.", StatusCodes.Status404NotFound);
        if (user.Id == User.FindFirstValue(ClaimTypes.NameIdentifier)) throw new ApiException("Admin không thể tự khóa tài khoản đang đăng nhập.");
        var targetRoles = await userManager.GetRolesAsync(user);
        if (targetRoles.Contains(RoleNames.Admin)) throw new ApiException("Không thể khóa tài khoản Admin.", StatusCodes.Status403Forbidden);
        if (!User.IsInRole(RoleNames.Admin) && targetRoles.Contains(RoleNames.Manager))
        {
            throw new ApiException("Manager không thể khóa tài khoản Manager khác.", StatusCodes.Status403Forbidden);
        }
        user.IsSuspended = suspended;
        db.AuditLogs.Add(new() { ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier), Action = suspended ? "user.suspended" : "user.restored", EntityType = "ApplicationUser", EntityId = user.Id });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<IActionResult> SetManagerRole(string userId, bool grant, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy người dùng.", StatusCodes.Status404NotFound);
        if (user.Id == User.FindFirstValue(ClaimTypes.NameIdentifier)) throw new ApiException("Admin không thể tự thay đổi quyền của chính mình.");

        var roles = await userManager.GetRolesAsync(user);
        if (roles.Contains(RoleNames.Admin)) throw new ApiException("Không thể thay đổi quyền Manager của Admin.", StatusCodes.Status409Conflict);
        if (grant && roles.Contains(RoleNames.Provider)) throw new ApiException("Tài khoản Provider không thể đồng thời là Manager.", StatusCodes.Status409Conflict);
        if (grant && roles.Contains(RoleNames.Manager)) throw new ApiException("Tài khoản này đã là Manager.", StatusCodes.Status409Conflict);
        if (!grant && !roles.Contains(RoleNames.Manager)) throw new ApiException("Tài khoản này không phải Manager.", StatusCodes.Status409Conflict);

        IdentityResult result;
        if (grant)
        {
            result = await userManager.AddToRoleAsync(user, RoleNames.Manager);
            if (!result.Succeeded)
            {
                throw new ApiException("Không thể cập nhật quyền Manager: " + string.Join(" ", result.Errors.Select(error => error.Description)));
            }
            if (roles.Contains(RoleNames.Customer))
            {
                result = await userManager.RemoveFromRoleAsync(user, RoleNames.Customer);
                if (!result.Succeeded)
                {
                    await userManager.RemoveFromRoleAsync(user, RoleNames.Manager);
                    throw new ApiException("Không thể chuyển tài khoản sang Manager: " + string.Join(" ", result.Errors.Select(error => error.Description)));
                }
            }
        }
        else
        {
            result = roles.Contains(RoleNames.Customer)
                ? IdentityResult.Success
                : await userManager.AddToRoleAsync(user, RoleNames.Customer);
            if (!result.Succeeded)
            {
                throw new ApiException("Không thể chuyển tài khoản về Customer: " + string.Join(" ", result.Errors.Select(error => error.Description)));
            }
            result = await userManager.RemoveFromRoleAsync(user, RoleNames.Manager);
        }
        if (!result.Succeeded)
        {
            throw new ApiException("Không thể cập nhật quyền Manager: " + string.Join(" ", result.Errors.Select(error => error.Description)));
        }

        db.AuditLogs.Add(new()
        {
            ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            Action = grant ? "user.manager-granted" : "user.manager-revoked",
            EntityType = "ApplicationUser",
            EntityId = user.Id
        });
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

    private async Task<(bool Success, string? Error)> TryDeleteUserInternalAsync(string userId, CancellationToken cancellationToken)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == currentUserId)
        {
            return (false, "Admin không thể tự xóa tài khoản của chính mình.");
        }

        var user = await db.Users
            .Include(u => u.ProviderProfile)
            .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user == null)
        {
            return (false, "Không tìm thấy người dùng.");
        }

        var targetRoles = await userManager.GetRolesAsync(user);
        if (targetRoles.Contains(RoleNames.Admin))
        {
            return (false, "Không thể xóa tài khoản Admin.");
        }

        var activeCustomerBookings = await db.Bookings.CountAsync(b =>
            b.CustomerUserId == userId &&
            (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.CheckedIn),
            cancellationToken);

        if (activeCustomerBookings > 0)
        {
            return (false, $"Không thể xóa tài khoản “{user.DisplayName}” vì còn {activeCustomerBookings} lịch đặt chỗ đang hoạt động. Vui lòng đợi các booking hoàn tất hoặc sử dụng tính năng “Tạm khóa” để vô hiệu hóa tài khoản mà vẫn bảo toàn lịch sử.");
        }

        var now = DateTime.UtcNow;
        var activeCustomerHolds = await db.SlotHolds.CountAsync(h =>
            h.CustomerUserId == userId &&
            h.Status == SlotHoldStatus.Active &&
            h.ExpiresAtUtc > now,
            cancellationToken);

        if (activeCustomerHolds > 0)
        {
            return (false, $"Không thể xóa tài khoản “{user.DisplayName}” vì đang có phiên giữ chỗ thanh toán chưa hoàn tất. Vui lòng thử lại sau ít phút.");
        }

        if (user.ProviderProfile != null)
        {
            var providerId = user.ProviderProfile.Id;
            var providerActiveBookings = await db.Bookings.CountAsync(b =>
                b.DealSlot.ServiceOffering.Venue.ProviderProfileId == providerId &&
                (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.CheckedIn),
                cancellationToken);

            if (providerActiveBookings > 0)
            {
                return (false, $"Không thể xóa tài khoản đối tác “{user.DisplayName}” vì còn {providerActiveBookings} lịch đặt chỗ của khách hàng đang hoạt động. Vui lòng xử lý các booking hoặc sử dụng tính năng “Tạm khóa” tài khoản.");
            }

            var providerActiveHolds = await db.SlotHolds.CountAsync(h =>
                h.DealSlot.ServiceOffering.Venue.ProviderProfileId == providerId &&
                h.Status == SlotHoldStatus.Active &&
                h.ExpiresAtUtc > now,
                cancellationToken);

            if (providerActiveHolds > 0)
            {
                return (false, $"Không thể xóa tài khoản đối tác “{user.DisplayName}” vì đang có khách hàng giữ chỗ thanh toán. Vui lòng thử lại sau khi phiên giữ chỗ kết thúc.");
            }

            user.ProviderProfile.Status = ProviderStatus.Deleted;
            var slotsToCancel = await db.DealSlots
                .Where(s => s.ServiceOffering.Venue.ProviderProfileId == providerId &&
                            (s.Status == DealSlotStatus.Published || s.Status == DealSlotStatus.Draft))
                .ToListAsync(cancellationToken);
            foreach (var s in slotsToCancel)
            {
                s.Status = DealSlotStatus.Cancelled;
                s.ConcurrencyToken = Guid.NewGuid();
            }
        }

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return (false, "Không thể xóa người dùng: " + string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentUserId,
            Action = "user.deleted",
            EntityType = "ApplicationUser",
            EntityId = userId,
            Metadata = user.Email
        });

        return (true, null);
    }

    private async Task<(bool Success, string? Error, bool IsSoftDeleted)> TryDeleteServiceInternalAsync(Guid serviceId, CancellationToken cancellationToken)
    {
        var service = await db.ServiceOfferings
            .Include(x => x.Venue).ThenInclude(v => v.ProviderProfile)
            .Include(x => x.DealSlots)
            .SingleOrDefaultAsync(x => x.Id == serviceId, cancellationToken);

        if (service == null) return (false, "Không tìm thấy dịch vụ.", false);

        var activeBookingsCount = await db.Bookings.CountAsync(b =>
            b.DealSlot.ServiceOfferingId == serviceId &&
            (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.CheckedIn),
            cancellationToken);

        if (activeBookingsCount > 0)
        {
            return (false, $"Không thể xóa dịch vụ “{service.Name}” vì còn {activeBookingsCount} lịch đặt chỗ đang hoạt động. Vui lòng hoàn tất hoặc hủy các booking trước, hoặc chọn “Ẩn” dịch vụ.", false);
        }

        var now = DateTime.UtcNow;
        var activeHoldsCount = await db.SlotHolds.CountAsync(h =>
            h.DealSlot.ServiceOfferingId == serviceId &&
            h.Status == SlotHoldStatus.Active &&
            h.ExpiresAtUtc > now,
            cancellationToken);

        if (activeHoldsCount > 0)
        {
            return (false, $"Không thể xóa dịch vụ “{service.Name}” vì đang có khách hàng giữ chỗ thanh toán. Vui lòng thử lại sau ít phút.", false);
        }

        var futureSlots = service.DealSlots
            .Where(s => s.Status is DealSlotStatus.Published or DealSlotStatus.Draft)
            .ToList();
        foreach (var s in futureSlots)
        {
            s.Status = DealSlotStatus.Cancelled;
            s.ConcurrencyToken = Guid.NewGuid();
        }

        var hasHistoricalBookings = await db.Bookings.AnyAsync(b => b.DealSlot.ServiceOfferingId == serviceId, cancellationToken);
        var isSoftDeleted = false;
        if (hasHistoricalBookings)
        {
            service.IsActive = false;
            isSoftDeleted = true;
        }
        else
        {
            var slotIds = service.DealSlots.Select(s => s.Id).ToList();
            if (slotIds.Count > 0)
            {
                var relatedHolds = await db.SlotHolds.Where(h => slotIds.Contains(h.DealSlotId)).ToListAsync(cancellationToken);
                if (relatedHolds.Count > 0)
                {
                    db.SlotHolds.RemoveRange(relatedHolds);
                }
            }
            db.DealSlots.RemoveRange(service.DealSlots);
            db.ServiceOfferings.Remove(service);
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            Action = "service.deleted",
            EntityType = nameof(ServiceOffering),
            EntityId = service.Id.ToString(),
            Metadata = service.Name
        });

        if (service.Venue?.ProviderProfile?.UserId != null)
        {
            db.Notifications.Add(new Notification
            {
                UserId = service.Venue.ProviderProfile.UserId,
                Title = isSoftDeleted ? "Dịch vụ đã ngưng hoạt động" : "Dịch vụ đã bị xóa",
                Message = isSoftDeleted
                    ? $"Dịch vụ “{service.Name}” đã được quản trị viên chuyển sang ngưng hoạt động để bảo toàn dữ liệu lịch sử đặt chỗ của khách hàng."
                    : $"Dịch vụ “{service.Name}” đã bị xóa hoàn toàn bởi quản trị viên hệ thống.",
                Link = "/provider"
            });
        }

        return (true, null, isSoftDeleted);
    }

    private async Task<(bool Success, string? Error)> TryReopenSlotInternalAsync(Guid slotId, CancellationToken cancellationToken)
    {
        var slot = await db.DealSlots
            .Include(x => x.ServiceOffering)
                .ThenInclude(s => s.Venue)
                    .ThenInclude(v => v.ProviderProfile)
            .Include(x => x.BookableResource)
            .SingleOrDefaultAsync(x => x.Id == slotId, cancellationToken);

        if (slot == null) return (false, "Không tìm thấy slot.");

        if (slot.Status != DealSlotStatus.Cancelled)
        {
            return (false, $"Chỉ có thể mở lại slot đã bị hủy (trạng thái hiện tại: {slot.Status}).");
        }

        var now = DateTime.UtcNow;
        if (slot.StartAtUtc <= now)
        {
            return (false, "Không thể mở lại slot trong quá khứ.");
        }

        if (slot.BookingClosesAtUtc <= now)
        {
            slot.BookingClosesAtUtc = slot.StartAtUtc > now.AddMinutes(15)
                ? slot.StartAtUtc.AddMinutes(-15)
                : slot.StartAtUtc;
        }

        if (slot.BookingOpensAtUtc > now)
        {
            slot.BookingOpensAtUtc = now;
        }

        if (!slot.ServiceOffering.IsActive)
        {
            return (false, "Dịch vụ liên kết đang bị ẩn.");
        }

        if (slot.ServiceOffering.Venue.ProviderProfile.Status != ProviderStatus.Approved)
        {
            return (false, "Hồ sơ đối tác chưa được duyệt hoặc đang bị khóa.");
        }

        if (slot.BookableResource != null && !slot.BookableResource.IsActive)
        {
            return (false, "Đơn vị đặt chỗ (sân/bàn/phòng) của slot đang bị vô hiệu hóa.");
        }

        if (slot.BookableResourceId.HasValue)
        {
            var conflict = await db.DealSlots.AnyAsync(x =>
                x.Id != slotId &&
                x.BookableResourceId == slot.BookableResourceId &&
                x.Status != DealSlotStatus.Cancelled &&
                x.Status != DealSlotStatus.Expired &&
                x.StartAtUtc < slot.EndAtUtc &&
                x.EndAtUtc > slot.StartAtUtc,
                cancellationToken);
            if (conflict)
            {
                return (false, "Đã có slot khác trùng khung giờ trên đơn vị đặt chỗ này.");
            }
        }

        slot.Status = DealSlotStatus.Published;
        slot.ConcurrencyToken = Guid.NewGuid();

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            Action = "slot.admin-reopened",
            EntityType = nameof(DealSlot),
            EntityId = slot.Id.ToString()
        });

        db.Notifications.Add(new Notification
        {
            UserId = slot.ServiceOffering.Venue.ProviderProfile.UserId,
            Title = "Slot đã được mở lại",
            Message = $"Slot “{slot.ServiceOffering.Name}” lúc {slot.StartAtUtc:dd/MM/yyyy HH:mm} đã được mở lại bởi ban quản trị.",
            Link = "/provider"
        });

        return (true, null);
    }
}
