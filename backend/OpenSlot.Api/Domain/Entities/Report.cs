using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Domain.Entities;

public sealed class Report
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ReporterUserId { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public ReportStatus Status { get; set; } = ReportStatus.Open;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ApplicationUser ReporterUser { get; set; } = null!;
}
