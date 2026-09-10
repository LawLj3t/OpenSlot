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

public sealed class ApplyForProviderRequest
{
    [Required, MinLength(2), MaxLength(160)]
    public string BusinessName { get; init; } = string.Empty;

    [Required, RegularExpression(@"^0\d{9}$", ErrorMessage = "Số điện thoại không hợp lệ, vui lòng nhập lại.")]
    public string ContactPhone { get; init; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; init; }
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
