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
}
