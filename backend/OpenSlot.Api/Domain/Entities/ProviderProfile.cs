using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Domain.Entities;

public sealed class ProviderProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ContactPhone { get; set; } = string.Empty;
    public ProviderStatus Status { get; set; } = ProviderStatus.Pending;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
    public ICollection<Venue> Venues { get; set; } = new List<Venue>();
}
