using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Encodings.Web;
using Microsoft.Extensions.Options;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Services;

public sealed class ResendEmailVerificationService(
    HttpClient httpClient,
    IOptions<EmailOptions> emailOptions,
    ILogger<ResendEmailVerificationService> logger) : IEmailVerificationService
{
    private readonly EmailOptions _options = emailOptions.Value;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ResendApiKey) &&
        !string.IsNullOrWhiteSpace(_options.FromAddress) &&
        Uri.TryCreate(_options.PublicBaseUrl, UriKind.Absolute, out _);

    public async Task SendConfirmationAsync(ApplicationUser user, string confirmationLink, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Dịch vụ email chưa được cấu hình.");
        }

        var safeName = HtmlEncoder.Default.Encode(user.DisplayName);
        var safeLink = HtmlEncoder.Default.Encode(confirmationLink);
        using var request = new HttpRequestMessage(HttpMethod.Post, "emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ResendApiKey);
        request.Content = JsonContent.Create(new
        {
            from = $"{_options.FromName} <{_options.FromAddress}>",
            to = new[] { user.Email },
            subject = "Xác minh email tài khoản OpenSlot",
            html = $"<main style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233a\"><h1>Chào {safeName},</h1><p>Nhấn nút bên dưới để xác minh email và hoàn tất tạo tài khoản OpenSlot.</p><p><a href=\"{safeLink}\" style=\"display:inline-block;padding:12px 20px;border-radius:999px;background:#17233a;color:#fff;text-decoration:none;font-weight:bold\">Xác minh email</a></p><p style=\"color:#667085;font-size:13px\">Link có hiệu lực trong thời gian do hệ thống bảo mật quy định. Nếu bạn không tạo tài khoản OpenSlot, hãy bỏ qua email này.</p></main>"
        });

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode) return;

        logger.LogWarning("Resend rejected verification email for user {UserId} with status {StatusCode}", user.Id, (int)response.StatusCode);
        throw new InvalidOperationException("Nhà cung cấp email không thể gửi thư xác minh.");
    }
}
