using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenSlot.Api.Contracts.Auth;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(UserManager<ApplicationUser> userManager, IJwtTokenService jwtTokenService) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            DisplayName = request.DisplayName.Trim(),
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                errors = result.Errors.Select(x => new { x.Code, x.Description })
            });
        }

        await userManager.AddToRoleAsync(user, RoleNames.Customer);
        var response = await jwtTokenService.CreateAsync(user, cancellationToken);
        return CreatedAtAction(nameof(Me), response);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            throw new ApiException("Email hoặc mật khẩu không đúng.", StatusCodes.Status401Unauthorized);
        }

        if (user.IsSuspended)
        {
            throw new ApiException("Tài khoản hiện đang bị khóa.", StatusCodes.Status403Forbidden);
        }

        return Ok(await jwtTokenService.CreateAsync(user, cancellationToken));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserResponse>> Me(CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(User)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        var roles = await userManager.GetRolesAsync(user);
        return Ok(new CurrentUserResponse(
            user.Id,
            user.DisplayName,
            user.Email ?? string.Empty,
            roles.ToArray(),
            user.IsSuspended,
            user.BookingSuspendedUntilUtc));
    }
}
