using System.ComponentModel.DataAnnotations;

namespace OpenSlot.Api.Contracts.Support;

public sealed class CreateSupportTicketRequest
{
    [Required]
    [MaxLength(30)]
    public string UserRole { get; init; } = "Buyer"; // "Buyer" | "Seller"

    [Required]
    [MaxLength(120)]
    public string Category { get; init; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(160)]
    public string SenderEmail { get; init; } = string.Empty;

    [Required]
    [MinLength(10)]
    [MaxLength(4000)]
    public string Content { get; init; } = string.Empty;

    [MaxLength(260)]
    public string? AttachmentFileName { get; init; }

    public string? AttachmentData { get; init; }
}

public sealed class ResolveSupportTicketRequest
{
    [Required]
    [MinLength(5)]
    [MaxLength(4000)]
    public string ResolutionNote { get; init; } = string.Empty;

    public int? Status { get; init; } = 2; // Default: 2 = Resolved
}

public sealed record SupportTicketDto(
    Guid Id,
    string? UserId,
    string UserRole,
    string Category,
    string SenderEmail,
    string Content,
    string? AttachmentFileName,
    string? AttachmentData,
    int Status,
    string? ResolutionNote,
    string? ResolvedByName,
    DateTime CreatedAtUtc,
    DateTime? ResolvedAtUtc);
