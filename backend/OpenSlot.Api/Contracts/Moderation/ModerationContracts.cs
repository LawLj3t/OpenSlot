using System.ComponentModel.DataAnnotations;

namespace OpenSlot.Api.Contracts.Moderation;

public sealed class CreateReportRequest
{
    [Required, MaxLength(80)]
    public string TargetType { get; init; } = string.Empty;

    [Required, MaxLength(100)]
    public string TargetId { get; init; } = string.Empty;

    [Required, MinLength(10), MaxLength(1000)]
    public string Reason { get; init; } = string.Empty;
}

public sealed class ResolveReportRequest
{
    [Required, MaxLength(1000)]
    public string ResolutionNote { get; init; } = string.Empty;
}
