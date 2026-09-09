namespace OpenSlot.Api.Domain.Entities;

/// <summary>A concrete unit inside a venue that can receive a booking: court, room, desk, chair, etc.</summary>
public sealed class BookableResource
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VenueId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ResourceType { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? FloorOrZone { get; set; }
    public string? PositionDescription { get; set; }
    public int MaxCapacity { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public Venue Venue { get; set; } = null!;
    public ICollection<DealSlot> DealSlots { get; set; } = new List<DealSlot>();
}
