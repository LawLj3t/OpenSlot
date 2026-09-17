namespace OpenSlot.Api.Infrastructure;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string GoogleClientId { get; init; } = string.Empty;
    public string GoogleClientSecret { get; init; } = string.Empty;
    public string GoogleRefreshToken { get; init; } = string.Empty;
    public string GoogleSenderEmail { get; init; } = string.Empty;
    public string FromName { get; init; } = "OpenSlot";
    public string PublicBaseUrl { get; init; } = string.Empty;

    // Optional standard SMTP fallback configuration
    public string SmtpHost { get; init; } = string.Empty;
    public int SmtpPort { get; init; } = 587;
    public string SmtpUsername { get; init; } = string.Empty;
    public string SmtpPassword { get; init; } = string.Empty;
    public bool SmtpEnableSsl { get; init; } = true;
}
