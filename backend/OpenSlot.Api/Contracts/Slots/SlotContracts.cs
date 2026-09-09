using System.ComponentModel.DataAnnotations;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Contracts.Slots;

public sealed class CreateDealSlotRequest
{
    [Required]
    public Guid ServiceOfferingId { get; init; }

    [Required]
    public Guid BookableResourceId { get; init; }

    public DateTime StartAtUtc { get; init; }
    public DateTime EndAtUtc { get; init; }
    public DateTime BookingOpensAtUtc { get; init; }
    public DateTime BookingClosesAtUtc { get; init; }

    [Range(1, 100_000_000)]
    public long OriginalPriceVnd { get; init; }

    [Range(1, 100_000_000)]
    public long DealPriceVnd { get; init; }

    [Range(1, 100)]
    public int Capacity { get; init; }
}

public sealed record DealSlotListItem(
    Guid Id,
    string ServiceName,
    string CategoryName,
    string CategorySlug,
    string VenueName,
    string? ResourceName,
    string? ResourceCode,
    string? ResourceLocation,
    string District,
    string City,
    double Latitude,
    double Longitude,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateTime BookingClosesAtUtc,
    long OriginalPriceVnd,
    long DealPriceVnd,
    int Capacity,
    int RemainingCapacity,
    DealSlotStatus Status,
    double? DistanceKm);

public sealed record DealSlotDetails(
    Guid Id,
    string ServiceName,
    string? ServiceDescription,
    string? ImageUrl,
    string CategoryName,
    string CategorySlug,
    string VenueName,
    string? ResourceName,
    string? ResourceCode,
    string? ResourceLocation,
    string AddressLine,
    string District,
    string City,
    double Latitude,
    double Longitude,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateTime BookingOpensAtUtc,
    DateTime BookingClosesAtUtc,
    long OriginalPriceVnd,
    long DealPriceVnd,
    int Capacity,
    int RemainingCapacity,
    DealSlotStatus Status);
