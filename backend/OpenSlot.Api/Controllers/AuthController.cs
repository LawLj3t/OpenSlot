using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
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
public sealed class AuthController(
    UserManager<ApplicationUser> userManager,
    IJwtTokenService jwtTokenService,
    IEmailVerificationService emailVerificationService,
    IOptions<EmailOptions> emailOptions,
    AppDbContext db) : ControllerBase
{
    [HttpPost("register")]
    [EnableRateLimiting("email-send")]
    [ProducesResponseType<RegistrationResponse>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<RegistrationResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!emailVerificationService.IsConfigured)
        {
            throw new ApiException("Dịch vụ gửi email đang được thiết lập. Vui lòng thử lại sau.", StatusCodes.Status503ServiceUnavailable);
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            DisplayName = request.DisplayName.Trim(),
            EmailConfirmed = false
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                errors = result.Errors.Select(x => new { x.Code, x.Description })
            });
        }

        var roleResult = await userManager.AddToRoleAsync(user, RoleNames.Customer);
        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);
            throw new ApiException("Không thể tạo quyền Khách hàng cho tài khoản.");
        }

        try
        {
            await SendConfirmationAsync(user, cancellationToken);
        }
        catch
        {
            await userManager.DeleteAsync(user);
            throw new ApiException("Không thể gửi email xác minh. Vui lòng thử lại sau.", StatusCodes.Status503ServiceUnavailable);
        }

        return Accepted(new RegistrationResponse(email, "OpenSlot đã gửi link xác minh tới Gmail của bạn. Hãy mở email và xác minh trước khi đăng nhập."));
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

        if (!user.EmailConfirmed)
        {
            throw new ApiException("Email chưa được xác minh. Hãy kiểm tra Gmail hoặc yêu cầu gửi lại link xác minh.", StatusCodes.Status403Forbidden);
        }

        return Ok(await jwtTokenService.CreateAsync(user, cancellationToken));
    }

    [HttpPost("confirm-email")]
    [ProducesResponseType<EmailConfirmationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailConfirmationResponse>> ConfirmEmail(ConfirmEmailRequest request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(request.UserId);
        if (user is null)
        {
            throw new ApiException("Link xác minh không hợp lệ hoặc tài khoản không còn tồn tại.", StatusCodes.Status400BadRequest);
        }

        if (user.EmailConfirmed)
        {
            return Ok(new EmailConfirmationResponse("Email này đã được xác minh. Bạn có thể đăng nhập OpenSlot."));
        }

        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (FormatException)
        {
            throw new ApiException("Link xác minh không hợp lệ.", StatusCodes.Status400BadRequest);
        }

        var result = await userManager.ConfirmEmailAsync(user, token);
        if (!result.Succeeded)
        {
            throw new ApiException("Link xác minh đã hết hạn hoặc không hợp lệ. Hãy yêu cầu gửi lại email.", StatusCodes.Status400BadRequest);
        }

        return Ok(new EmailConfirmationResponse("Xác minh email thành công. Bạn có thể đăng nhập OpenSlot."));
    }

    [HttpPost("resend-verification")]
    [EnableRateLimiting("email-send")]
    [ProducesResponseType<EmailConfirmationResponse>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<EmailConfirmationResponse>> ResendVerification(ResendEmailVerificationRequest request, CancellationToken cancellationToken)
    {
        if (!emailVerificationService.IsConfigured)
        {
            throw new ApiException("Dịch vụ gửi email đang được thiết lập. Vui lòng thử lại sau.", StatusCodes.Status503ServiceUnavailable);
        }

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is { EmailConfirmed: false })
        {
            try
            {
                await SendConfirmationAsync(user, cancellationToken);
            }
            catch
            {
                throw new ApiException("Không thể gửi email xác minh. Vui lòng thử lại sau.", StatusCodes.Status503ServiceUnavailable);
            }
        }

        return Accepted(new EmailConfirmationResponse("Nếu Gmail này có tài khoản chưa xác minh, OpenSlot đã gửi lại link xác minh."));
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("email-send")]
    [ProducesResponseType<PasswordResetRequestResponse>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<PasswordResetRequestResponse>> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        if (!emailVerificationService.IsConfigured)
        {
            throw new ApiException("Dịch vụ gửi email đang được thiết lập. Vui lòng thử lại sau.", StatusCodes.Status503ServiceUnavailable);
        }

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is { EmailConfirmed: true, IsSuspended: false })
        {
            try
            {
                await SendPasswordResetAsync(user, cancellationToken);
            }
            catch
            {
                throw new ApiException("Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.", StatusCodes.Status503ServiceUnavailable);
            }
        }

        return Accepted(new PasswordResetRequestResponse("Nếu Gmail này có tài khoản đã xác minh, OpenSlot đã gửi link đặt lại mật khẩu."));
    }

    [HttpPost("reset-password")]
    [ProducesResponseType<EmailConfirmationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailConfirmationResponse>> ResetPassword(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        if (!string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal))
        {
            throw new ApiException("Mật khẩu xác nhận không khớp.", StatusCodes.Status400BadRequest);
        }

        var user = await userManager.FindByIdAsync(request.UserId);
        if (user is null)
        {
            throw new ApiException("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", StatusCodes.Status400BadRequest);
        }

        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (FormatException)
        {
            throw new ApiException("Link đặt lại mật khẩu không hợp lệ.", StatusCodes.Status400BadRequest);
        }

        var result = await userManager.ResetPasswordAsync(user, token, request.Password);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(error => error.Code == "InvalidToken"))
            {
                throw new ApiException("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", StatusCodes.Status400BadRequest);
            }
            return BadRequest(new { errors = result.Errors.Select(x => new { x.Code, x.Description }) });
        }

        return Ok(new EmailConfirmationResponse("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."));
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

    private async Task SendConfirmationAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var publicBaseUrl = emailOptions.Value.PublicBaseUrl.TrimEnd('/');
        if (!Uri.TryCreate(publicBaseUrl, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException("Email:PublicBaseUrl is not configured.");
        }

        var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        var link = QueryHelpers.AddQueryString($"{publicBaseUrl}/verify-email", new Dictionary<string, string?>
        {
            ["userId"] = user.Id,
            ["token"] = encodedToken
        });
        await emailVerificationService.SendConfirmationAsync(user, link, cancellationToken);
    }

    private async Task SendPasswordResetAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var publicBaseUrl = emailOptions.Value.PublicBaseUrl.TrimEnd('/');
        if (!Uri.TryCreate(publicBaseUrl, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException("Email:PublicBaseUrl is not configured.");
        }

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        var link = QueryHelpers.AddQueryString($"{publicBaseUrl}/reset-password", new Dictionary<string, string?>
        {
            ["userId"] = user.Id,
            ["token"] = encodedToken
        });
        await emailVerificationService.SendPasswordResetAsync(user, link, cancellationToken);
    }
}
