using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Auth;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(UserManager<ApplicationUser> userManager, IJwtTokenService jwtTokenService, AppDbContext db) : ControllerBase
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

    [Authorize(Roles = RoleNames.Customer)]
    [HttpPost("provider-applications")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AuthResponse>> ApplyForProvider(ApplyForProviderRequest request, CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(User)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);

        if (await db.ProviderProfiles.AnyAsync(x => x.UserId == user.Id, cancellationToken))
        {
            throw new ApiException("Tài khoản này đã có hồ sơ đối tác.", StatusCodes.Status409Conflict);
        }

        var addRoleResult = await userManager.AddToRoleAsync(user, RoleNames.Provider);
        if (!addRoleResult.Succeeded)
        {
            throw new ApiException("Không thể tạo quyền đối tác: " + string.Join(" ", addRoleResult.Errors.Select(x => x.Description)));
        }

        var profile = new ProviderProfile
        {
            UserId = user.Id,
            BusinessName = request.BusinessName.Trim(),
            ContactPhone = request.ContactPhone.Trim(),
            Description = request.Description?.Trim(),
            Status = ProviderStatus.Pending
        };
        db.ProviderProfiles.Add(profile);
        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = user.Id,
            Action = "provider.application-submitted",
            EntityType = nameof(ProviderProfile),
            EntityId = profile.Id.ToString()
        });

        var reviewers = (await userManager.GetUsersInRoleAsync(RoleNames.Manager))
            .Concat(await userManager.GetUsersInRoleAsync(RoleNames.Admin))
            .DistinctBy(x => x.Id);
        foreach (var reviewer in reviewers)
        {
            db.Notifications.Add(new Notification
            {
                UserId = reviewer.Id,
                Title = "Có hồ sơ đối tác cần duyệt",
                Message = $"{profile.BusinessName} vừa gửi yêu cầu trở thành đối tác.",
                Link = "/manager"
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(Me), await jwtTokenService.CreateAsync(user, cancellationToken));
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
