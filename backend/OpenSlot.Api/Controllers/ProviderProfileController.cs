using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Providers;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Controllers;

[Authorize(Roles = RoleNames.Provider)]
[ApiController]
[Route("api/provider")]
public sealed class ProviderProfileController(AppDbContext db) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<IActionResult> Profile(CancellationToken cancellationToken)
    {
        var profile = await ProfileQuery().AsNoTracking().SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApiException("Không tìm thấy hồ sơ đối tác.", StatusCodes.Status404NotFound);
        return Ok(new { profile.Id, profile.BusinessName, profile.Description, profile.ContactPhone, profile.Status });
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateProviderProfileRequest request, CancellationToken cancellationToken)
    {
        var profile = await ProfileQuery().SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApiException("Không tìm thấy hồ sơ đối tác.", StatusCodes.Status404NotFound);
        profile.BusinessName = request.BusinessName.Trim();
        profile.Description = request.Description?.Trim();
        profile.ContactPhone = request.ContactPhone.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("venues")]
    public async Task<IActionResult> Venues(CancellationToken cancellationToken) => Ok(await db.Venues.AsNoTracking()
        .Where(x => x.ProviderProfile.UserId == UserId).OrderBy(x => x.Name)
        .Select(x => new { x.Id, x.Name, x.AddressLine, x.District, x.City, x.Latitude, x.Longitude }).ToListAsync(cancellationToken));

    [HttpPost("venues")]
    public async Task<IActionResult> CreateVenue(UpsertVenueRequest request, CancellationToken cancellationToken)
    {
        var profile = await ProfileQuery().SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApiException("Không tìm thấy hồ sơ đối tác.", StatusCodes.Status404NotFound);
        var venue = new Venue { ProviderProfileId = profile.Id };
        MapVenue(venue, request);
        db.Venues.Add(venue);
        await db.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { venue.Id });
    }

    [HttpPut("venues/{id:guid}")]
    public async Task<IActionResult> UpdateVenue(Guid id, UpsertVenueRequest request, CancellationToken cancellationToken)
    {
        var venue = await db.Venues.Include(x => x.ProviderProfile).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy địa điểm.", StatusCodes.Status404NotFound);
        EnsureOwner(venue.ProviderProfile.UserId);
        MapVenue(venue, request);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("services")]
    public async Task<IActionResult> CreateService(UpsertServiceRequest request, CancellationToken cancellationToken)
    {
        await ValidateReferences(request, cancellationToken);
        var service = new ServiceOffering();
        MapService(service, request);
        db.ServiceOfferings.Add(service);
        await db.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { service.Id });
    }

    [HttpPut("services/{id:guid}")]
    public async Task<IActionResult> UpdateService(Guid id, UpsertServiceRequest request, CancellationToken cancellationToken)
    {
        var service = await db.ServiceOfferings.Include(x => x.Venue).ThenInclude(x => x.ProviderProfile).SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy dịch vụ.", StatusCodes.Status404NotFound);
        EnsureOwner(service.Venue.ProviderProfile.UserId);
        if (await db.DealSlots.AnyAsync(x => x.ServiceOfferingId == id && x.ConfirmedBookingCount > 0, cancellationToken))
            throw new ApiException("Không thể sửa dịch vụ đang có booking.", StatusCodes.Status409Conflict);
        await ValidateReferences(request, cancellationToken);
        MapService(service, request);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private IQueryable<ProviderProfile> ProfileQuery() => db.ProviderProfiles.Where(x => x.UserId == UserId);
    private async Task ValidateReferences(UpsertServiceRequest request, CancellationToken cancellationToken)
    {
        var venue = await db.Venues.Include(x => x.ProviderProfile).SingleOrDefaultAsync(x => x.Id == request.VenueId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy địa điểm.");
        EnsureOwner(venue.ProviderProfile.UserId);
        if (!await db.Categories.AnyAsync(x => x.Id == request.CategoryId && x.IsActive, cancellationToken)) throw new ApiException("Danh mục không hợp lệ.");
    }
    private void EnsureOwner(string ownerId) { if (ownerId != UserId) throw new ApiException("Bạn không có quyền quản lý dữ liệu này.", StatusCodes.Status403Forbidden); }
    private static void MapVenue(Venue venue, UpsertVenueRequest request) { venue.Name = request.Name.Trim(); venue.AddressLine = request.AddressLine.Trim(); venue.District = request.District.Trim(); venue.City = request.City.Trim(); venue.Latitude = request.Latitude; venue.Longitude = request.Longitude; }
    private static void MapService(ServiceOffering service, UpsertServiceRequest request) { service.VenueId = request.VenueId; service.CategoryId = request.CategoryId; service.Name = request.Name.Trim(); service.Description = request.Description?.Trim(); service.DefaultDurationMinutes = request.DefaultDurationMinutes; service.BasePriceVnd = request.BasePriceVnd; service.ImageUrl = request.ImageUrl?.Trim(); service.IsActive = true; }
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
}
