using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenSlot.Api.Contracts.Auth;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Services;

public sealed class JwtTokenService(
    UserManager<ApplicationUser> userManager,
    IOptions<JwtOptions> jwtOptions) : IJwtTokenService
{
    public async Task<AuthResponse> CreateAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        var options = jwtOptions.Value;
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(options.ExpirationMinutes);
        var roles = await userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.UniqueName, user.DisplayName),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.DisplayName)
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));
        var token = new JwtSecurityToken(
            options.Issuer,
            options.Audience,
            claims,
            expires: expiresAtUtc,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            expiresAtUtc,
            new CurrentUserResponse(
                user.Id,
                user.DisplayName,
                user.Email ?? string.Empty,
                roles.ToArray(),
                user.IsSuspended,
                user.BookingSuspendedUntilUtc));
    }
}
