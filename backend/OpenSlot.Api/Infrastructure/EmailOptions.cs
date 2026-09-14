namespace OpenSlot.Api.Infrastructure;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string GmailAddress { get; init; } = string.Empty;
    public string GmailAppPassword { get; init; } = string.Empty;
    public string FromName { get; init; } = "OpenSlot";
    public string PublicBaseUrl { get; init; } = string.Empty;
}
