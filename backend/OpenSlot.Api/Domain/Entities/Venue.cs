namespace OpenSlot.Api.Domain.Entities;

public sealed class Venue
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProviderProfileId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string AddressLine { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string City { get; set; } = "Hà Nội";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ProviderProfile ProviderProfile { get; set; } = null!;
    public ICollection<ServiceOffering> ServiceOfferings { get; set; } = new List<ServiceOffering>();
    public ICollection<BookableResource> Resources { get; set; } = new List<BookableResource>();
}
