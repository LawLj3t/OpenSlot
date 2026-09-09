namespace OpenSlot.Api.Domain.Entities;

public sealed class ServiceOffering
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VenueId { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DefaultDurationMinutes { get; set; }
    public long BasePriceVnd { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public Venue Venue { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public ICollection<DealSlot> DealSlots { get; set; } = new List<DealSlot>();
}
