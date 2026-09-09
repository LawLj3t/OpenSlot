using System.ComponentModel.DataAnnotations;

namespace OpenSlot.Api.Contracts.Auth;

public sealed class RegisterRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string DisplayName { get; init; } = string.Empty;

    [Required, EmailAddress, StringLength(256)]
    public string Email { get; init; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 8)]
    public string Password { get; init; } = string.Empty;
}

public sealed class LoginRequest
{
    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    public string Password { get; init; } = string.Empty;
}

public sealed record AuthResponse(
    string AccessToken,
    DateTime ExpiresAtUtc,
    CurrentUserResponse User);

public sealed record CurrentUserResponse(
    string Id,
    string DisplayName,
    string Email,
    IReadOnlyCollection<string> Roles,
    bool IsSuspended,
    DateTime? BookingSuspendedUntilUtc);
