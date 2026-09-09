namespace OpenSlot.Api.Infrastructure;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = "OpenSlot.Api";
    public string Audience { get; init; } = "OpenSlot.Web";
    public string Key { get; init; } = string.Empty;
    public int ExpirationMinutes { get; init; } = 120;
}
