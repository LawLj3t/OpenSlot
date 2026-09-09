using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Slots;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Controllers;

[ApiController]
[Route("api/slots")]
public sealed class SlotsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<DealSlotListItem>>> Browse(
        [FromQuery] string? category,
        [FromQuery] string? district,
        [FromQuery] string? q,
        [FromQuery] long? maxPriceVnd,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] double? latitude,
        [FromQuery] double? longitude,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var query = db.DealSlots
            .AsNoTracking()
            .Include(x => x.ServiceOffering)
            .ThenInclude(x => x.Category)
            .Include(x => x.ServiceOffering)
            .ThenInclude(x => x.Venue)
            .ThenInclude(x => x.ProviderProfile)
            .Where(x => x.Status == DealSlotStatus.Published &&
                        x.ServiceOffering.IsActive &&
                        x.ServiceOffering.Venue.ProviderProfile.Status == ProviderStatus.Approved &&
                        x.BookingOpensAtUtc <= now &&
                        x.BookingClosesAtUtc > now &&
                        x.StartAtUtc >= (fromUtc ?? now));

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(x => x.ServiceOffering.Category.Slug == category.Trim().ToLowerInvariant());
        }

        if (!string.IsNullOrWhiteSpace(district))
        {
            query = query.Where(x => EF.Functions.Like(x.ServiceOffering.Venue.District, $"%{district.Trim()}%"));
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var keyword = $"%{q.Trim()}%";
            query = query.Where(x => EF.Functions.Like(x.ServiceOffering.Name, keyword) ||
                                     EF.Functions.Like(x.ServiceOffering.Venue.Name, keyword) ||
                                     EF.Functions.Like(x.ServiceOffering.Category.Name, keyword));
        }

        if (maxPriceVnd is not null)
        {
            query = query.Where(x => x.DealPriceVnd <= maxPriceVnd);
        }

        var slots = await query.OrderBy(x => x.StartAtUtc).Take(100).ToListAsync(cancellationToken);
        var items = slots.Select(slot => ToListItem(slot, latitude, longitude))
            .OrderBy(x => x.DistanceKm ?? double.MaxValue)
            .ThenBy(x => x.StartAtUtc)
            .ToList();
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DealSlotDetails>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var slot = await db.DealSlots
            .AsNoTracking()
            .Include(x => x.ServiceOffering).ThenInclude(x => x.Category)
            .Include(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.Id == id &&
                                       x.ServiceOffering.IsActive &&
                                       x.ServiceOffering.Venue.ProviderProfile.Status == ProviderStatus.Approved &&
                                       (x.Status == DealSlotStatus.Published || x.Status == DealSlotStatus.SoldOut), cancellationToken)
            ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);

        return Ok(new DealSlotDetails(
            slot.Id,
            slot.ServiceOffering.Name,
            slot.ServiceOffering.Description,
            slot.ServiceOffering.ImageUrl,
            slot.ServiceOffering.Category.Name,
            slot.ServiceOffering.Category.Slug,
            slot.ServiceOffering.Venue.Name,
            slot.ServiceOffering.Venue.AddressLine,
            slot.ServiceOffering.Venue.District,
            slot.ServiceOffering.Venue.City,
            slot.ServiceOffering.Venue.Latitude,
            slot.ServiceOffering.Venue.Longitude,
            slot.StartAtUtc,
            slot.EndAtUtc,
            slot.BookingOpensAtUtc,
            slot.BookingClosesAtUtc,
            slot.OriginalPriceVnd,
            slot.DealPriceVnd,
            slot.Capacity,
            Math.Max(0, slot.Capacity - slot.ConfirmedBookingCount),
            slot.Status));
    }

    private static DealSlotListItem ToListItem(Domain.Entities.DealSlot slot, double? latitude, double? longitude)
    {
        double? distanceKm = latitude is not null && longitude is not null
            ? CalculateDistance(latitude.Value, longitude.Value, slot.ServiceOffering.Venue.Latitude, slot.ServiceOffering.Venue.Longitude)
            : null;

        return new DealSlotListItem(
            slot.Id,
            slot.ServiceOffering.Name,
            slot.ServiceOffering.Category.Name,
            slot.ServiceOffering.Category.Slug,
            slot.ServiceOffering.Venue.Name,
            slot.ServiceOffering.Venue.District,
            slot.ServiceOffering.Venue.City,
            slot.ServiceOffering.Venue.Latitude,
            slot.ServiceOffering.Venue.Longitude,
            slot.StartAtUtc,
            slot.EndAtUtc,
            slot.BookingClosesAtUtc,
            slot.OriginalPriceVnd,
            slot.DealPriceVnd,
            slot.Capacity,
            Math.Max(0, slot.Capacity - slot.ConfirmedBookingCount),
            slot.Status,
            distanceKm);
    }

    private static double CalculateDistance(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude)
    {
        const double earthRadiusKm = 6371;
        var latitudeDelta = DegreesToRadians(toLatitude - fromLatitude);
        var longitudeDelta = DegreesToRadians(toLongitude - fromLongitude);
        var a = Math.Sin(latitudeDelta / 2) * Math.Sin(latitudeDelta / 2) +
                Math.Cos(DegreesToRadians(fromLatitude)) * Math.Cos(DegreesToRadians(toLatitude)) *
                Math.Sin(longitudeDelta / 2) * Math.Sin(longitudeDelta / 2);
        return Math.Round(earthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a)), 1);
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180;
}
