using Microsoft.AspNetCore.Identity;

namespace OpenSlot.Api.Domain.Entities;

public sealed class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
    public bool IsSuspended { get; set; }
    public int StrikeCount { get; set; }
    public DateTime? StrikeWindowStartedAtUtc { get; set; }
    public DateTime? BookingSuspendedUntilUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ProviderProfile? ProviderProfile { get; set; }
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
