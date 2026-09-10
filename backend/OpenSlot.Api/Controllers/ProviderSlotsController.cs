using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Slots;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Api.Controllers;

[Authorize(Roles = RoleNames.Provider)]
[ApiController]
[Route("api/provider/slots")]
public sealed class ProviderSlotsController(AppDbContext db) : ControllerBase
{
    [HttpGet("services")]
    public async Task<IActionResult> GetMyServices(CancellationToken cancellationToken)
    {
        var services = await db.ServiceOfferings
            .AsNoTracking()
            .Include(x => x.Venue)
            .Where(x => x.IsActive && x.Venue.ProviderProfile.UserId == UserId)
            .OrderBy(x => x.Venue.Name).ThenBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.VenueId,
                venueName = x.Venue.Name,
                x.BasePriceVnd
            })
            .ToListAsync(cancellationToken);
        return Ok(services);
    }

    [HttpGet]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var slots = await db.DealSlots
            .AsNoTracking()
            .Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .Include(x => x.BookableResource)
            .Where(x => x.ServiceOffering.Venue.ProviderProfile.UserId == UserId)
            .OrderByDescending(x => x.StartAtUtc)
            .Select(x => new
            {
                x.Id,
                serviceName = x.ServiceOffering.Name,
                venueName = x.ServiceOffering.Venue.Name,
                resourceName = x.BookableResource != null ? x.BookableResource.Name : "Chưa xác định",
                resourceCode = x.BookableResource != null ? x.BookableResource.Code : null,
                x.StartAtUtc,
                x.EndAtUtc,
                x.BookingOpensAtUtc,
                x.BookingClosesAtUtc,
                x.OriginalPriceVnd,
                x.DealPriceVnd,
                x.Capacity,
                x.ConfirmedBookingCount,
                x.Status
            })
            .ToListAsync(cancellationToken);
        return Ok(slots);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(CreateDealSlotRequest request, CancellationToken cancellationToken)
    {
        var validationError = SlotPolicy.Validate(request, DateTime.UtcNow);
        if (validationError is not null)
        {
            throw new ApiException(validationError);
        }
        var service = await db.ServiceOfferings
            .Include(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.Id == request.ServiceOfferingId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy dịch vụ.", StatusCodes.Status404NotFound);

        EnsureProviderOwnsService(service, UserId);
        var resource = await GetResourceForService(request.BookableResourceId, service, cancellationToken);
        if (request.Capacity > resource.MaxCapacity)
        {
            throw new ApiException($"Số chỗ không thể vượt quá sức chứa {resource.MaxCapacity} của {resource.Name}.");
        }
        if (await db.DealSlots.AnyAsync(x => x.BookableResourceId == request.BookableResourceId && x.Status != DealSlotStatus.Cancelled && x.Status != DealSlotStatus.Expired && x.StartAtUtc < request.EndAtUtc && x.EndAtUtc > request.StartAtUtc, cancellationToken))
        {
            throw new ApiException("Đơn vị này đã có slot trùng trong khung giờ đã chọn.", StatusCodes.Status409Conflict);
        }
        var slot = new DealSlot
        {
            ServiceOfferingId = request.ServiceOfferingId,
            BookableResourceId = resource.Id,
            StartAtUtc = request.StartAtUtc,
            EndAtUtc = request.EndAtUtc,
            BookingOpensAtUtc = request.BookingOpensAtUtc,
            BookingClosesAtUtc = request.BookingClosesAtUtc,
            OriginalPriceVnd = request.OriginalPriceVnd,
            DealPriceVnd = request.DealPriceVnd,
            Capacity = request.Capacity,
            Status = DealSlotStatus.Draft
        };
        db.DealSlots.Add(slot);
        db.AuditLogs.Add(CreateAudit("slot.created", nameof(DealSlot), slot.Id.ToString()));
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetMine), new { slot.Id }, new { slot.Id, slot.Status });
    }

    [HttpPost("{slotId:guid}/publish")]
    public async Task<IActionResult> Publish(Guid slotId, CancellationToken cancellationToken)
    {
        var slot = await db.DealSlots
            .Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .Include(x => x.BookableResource)
            .SingleOrDefaultAsync(x => x.Id == slotId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);
        EnsureProviderOwnsService(slot.ServiceOffering, UserId);

        if (slot.BookableResource is null || !slot.BookableResource.IsActive)
        {
            throw new ApiException("Slot phải gắn với một đơn vị đặt chỗ đang hoạt động.");
        }

        if (slot.ServiceOffering.Venue.ProviderProfile.Status != ProviderStatus.Approved)
        {
            throw new ApiException("Provider chưa được Admin duyệt.", StatusCodes.Status403Forbidden);
        }

        if (slot.Status != DealSlotStatus.Draft)
        {
            throw new ApiException("Chỉ slot ở trạng thái Draft mới có thể phát hành.");
        }

        if (slot.BookingClosesAtUtc <= DateTime.UtcNow)
        {
            throw new ApiException("Slot đã quá thời gian mở bán.");
        }

        slot.Status = DealSlotStatus.Published;
        slot.PublishedAtUtc = DateTime.UtcNow;
        slot.ConcurrencyToken = Guid.NewGuid();
        db.AuditLogs.Add(CreateAudit("slot.published", nameof(DealSlot), slot.Id.ToString()));
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { slot.Id, slot.Status, slot.PublishedAtUtc });
    }

    [HttpPut("{slotId:guid}")]
    public async Task<IActionResult> Update(Guid slotId, CreateDealSlotRequest request, CancellationToken cancellationToken)
    {
        var validationError = SlotPolicy.Validate(request, DateTime.UtcNow);
        if (validationError is not null) throw new ApiException(validationError);
        var slot = await db.DealSlots.Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile).Include(x => x.BookableResource)
            .SingleOrDefaultAsync(x => x.Id == slotId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);
        EnsureProviderOwnsService(slot.ServiceOffering, UserId);
        if (slot.Status is not (DealSlotStatus.Draft or DealSlotStatus.Published) || slot.ConfirmedBookingCount > 0)
            throw new ApiException("Chỉ có thể sửa slot nháp hoặc slot chưa có booking.", StatusCodes.Status409Conflict);

        var service = await db.ServiceOfferings.Include(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.Id == request.ServiceOfferingId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy dịch vụ.");
        EnsureProviderOwnsService(service, UserId);
        var resource = await GetResourceForService(request.BookableResourceId, service, cancellationToken);
        if (request.Capacity > resource.MaxCapacity)
        {
            throw new ApiException($"Số chỗ không thể vượt quá sức chứa {resource.MaxCapacity} của {resource.Name}.");
        }
        if (await db.DealSlots.AnyAsync(x => x.Id != slotId && x.BookableResourceId == request.BookableResourceId && x.Status != DealSlotStatus.Cancelled && x.Status != DealSlotStatus.Expired && x.StartAtUtc < request.EndAtUtc && x.EndAtUtc > request.StartAtUtc, cancellationToken))
        {
            throw new ApiException("Đơn vị này đã có slot trùng trong khung giờ đã chọn.", StatusCodes.Status409Conflict);
        }
        slot.ServiceOfferingId = request.ServiceOfferingId;
        slot.BookableResourceId = resource.Id;
        slot.StartAtUtc = request.StartAtUtc;
        slot.EndAtUtc = request.EndAtUtc;
        slot.BookingOpensAtUtc = request.BookingOpensAtUtc;
        slot.BookingClosesAtUtc = request.BookingClosesAtUtc;
        slot.OriginalPriceVnd = request.OriginalPriceVnd;
        slot.DealPriceVnd = request.DealPriceVnd;
        slot.Capacity = request.Capacity;
        slot.ConcurrencyToken = Guid.NewGuid();
        db.AuditLogs.Add(CreateAudit("slot.updated", nameof(DealSlot), slot.Id.ToString()));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{slotId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid slotId, CancellationToken cancellationToken)
    {
        var slot = await db.DealSlots.Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.Id == slotId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);
        EnsureProviderOwnsService(slot.ServiceOffering, UserId);
        if (slot.ConfirmedBookingCount > 0) throw new ApiException("Không thể hủy slot đang có booking.", StatusCodes.Status409Conflict);
        if (slot.Status is DealSlotStatus.Expired or DealSlotStatus.Cancelled) throw new ApiException("Slot đã kết thúc hoặc đã hủy.");
        slot.Status = DealSlotStatus.Cancelled;
        slot.ConcurrencyToken = Guid.NewGuid();
        db.AuditLogs.Add(CreateAudit("slot.cancelled", nameof(DealSlot), slot.Id.ToString()));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void EnsureProviderOwnsService(ServiceOffering service, string userId)
    {
        if (service.Venue.ProviderProfile.UserId != userId)
        {
            throw new ApiException("Bạn không có quyền quản lý dịch vụ này.", StatusCodes.Status403Forbidden);
        }
    }

    private async Task<BookableResource> GetResourceForService(Guid resourceId, ServiceOffering service, CancellationToken cancellationToken)
    {
        var resource = await db.BookableResources.SingleOrDefaultAsync(x => x.Id == resourceId && x.IsActive, cancellationToken)
            ?? throw new ApiException("Không tìm thấy đơn vị đặt chỗ đang hoạt động.", StatusCodes.Status404NotFound);
        if (resource.VenueId != service.VenueId)
        {
            throw new ApiException("Đơn vị đặt chỗ phải thuộc cùng địa điểm với dịch vụ.");
        }
        return resource;
    }

    private AuditLog CreateAudit(string action, string entityType, string entityId) => new()
    {
        ActorUserId = UserId,
        Action = action,
        EntityType = entityType,
        EntityId = entityId
    };

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
}
