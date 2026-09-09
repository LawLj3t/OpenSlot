namespace OpenSlot.Api.Domain.Entities;

public sealed class AuditLog
{
    public long Id { get; set; }
    public string? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Metadata { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
