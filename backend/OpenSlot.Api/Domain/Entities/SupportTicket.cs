namespace OpenSlot.Api.Domain.Entities;

public sealed class SupportTicket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? UserId { get; set; }
    public string UserRole { get; set; } = "Buyer"; // "Buyer" | "Seller"
    public string Category { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Status { get; set; } // 0 = Pending, 1 = InProgress, 2 = Resolved
    public string? ResolutionNote { get; set; }
    public string? ResolvedByUserId { get; set; }
    public string? ResolvedByName { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAtUtc { get; set; }

    public ApplicationUser? User { get; set; }
    public ApplicationUser? ResolvedByUser { get; set; }
}
