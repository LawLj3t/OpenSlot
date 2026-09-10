using System.ComponentModel.DataAnnotations;

namespace OpenSlot.Api.Contracts.Providers;

public sealed class UpdateProviderProfileRequest
{
    [Required, MinLength(2), MaxLength(160)] public string BusinessName { get; init; } = string.Empty;
    [MaxLength(2000)] public string? Description { get; init; }
    [Required, RegularExpression(@"^0\d{9}$", ErrorMessage = "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.")] public string ContactPhone { get; init; } = string.Empty;
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
    [Range(1, 100_000_000)] public long BasePriceVnd { get; init; }
    [Url, MaxLength(500)] public string? ImageUrl { get; init; }
}

public sealed class UpsertBookableResourceRequest
{
    public Guid VenueId { get; init; }
    [Required, MinLength(2), MaxLength(120)] public string Name { get; init; } = string.Empty;
    [Required, MinLength(2), MaxLength(80)] public string ResourceType { get; init; } = string.Empty;
    [MaxLength(60)] public string? Code { get; init; }
    [MaxLength(100)] public string? FloorOrZone { get; init; }
    [MaxLength(255)] public string? PositionDescription { get; init; }
    [Range(1, 100)] public int MaxCapacity { get; init; }
}
