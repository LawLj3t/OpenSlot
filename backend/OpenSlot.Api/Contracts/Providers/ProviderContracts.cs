using System.ComponentModel.DataAnnotations;

namespace OpenSlot.Api.Contracts.Providers;

public sealed class UpdateProviderProfileRequest
{
    [Required, MinLength(2), MaxLength(160)] public string BusinessName { get; init; } = string.Empty;
    [MaxLength(2000)] public string? Description { get; init; }
    [Required, MinLength(8), MaxLength(30)] public string ContactPhone { get; init; } = string.Empty;
}

public sealed class UpsertVenueRequest
{
    [Required, MinLength(2), MaxLength(160)] public string Name { get; init; } = string.Empty;
    [Required, MinLength(5), MaxLength(255)] public string AddressLine { get; init; } = string.Empty;
    [Required, MaxLength(100)] public string District { get; init; } = string.Empty;
    [Required, MaxLength(100)] public string City { get; init; } = string.Empty;
    [Range(-90, 90)] public double Latitude { get; init; }
    [Range(-180, 180)] public double Longitude { get; init; }
}

public sealed class UpsertServiceRequest
{
    public Guid VenueId { get; init; }
    public int CategoryId { get; init; }
    [Required, MinLength(2), MaxLength(160)] public string Name { get; init; } = string.Empty;
    [MaxLength(2000)] public string? Description { get; init; }
    [Range(15, 1440)] public int DefaultDurationMinutes { get; init; }
    [Range(1, 100_000_000)] public long BasePriceVnd { get; init; }
    [Url, MaxLength(500)] public string? ImageUrl { get; init; }
}
