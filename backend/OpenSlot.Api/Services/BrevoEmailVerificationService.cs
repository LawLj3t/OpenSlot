using System.Net.Http.Json;
using System.Text.Encodings.Web;
using Microsoft.Extensions.Options;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Services;

public sealed class BrevoEmailVerificationService(
    HttpClient httpClient,
    IOptions<EmailOptions> emailOptions,
    ILogger<BrevoEmailVerificationService> logger) : IEmailVerificationService
{
    private readonly EmailOptions _options = emailOptions.Value;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.BrevoApiKey) &&
        !string.IsNullOrWhiteSpace(_options.BrevoSenderEmail) &&
        Uri.TryCreate(_options.PublicBaseUrl, UriKind.Absolute, out _);

    public async Task SendConfirmationAsync(ApplicationUser user, string confirmationLink, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Dịch vụ email chưa được cấu hình.");
        }

        var recipientEmail = user.Email ?? throw new InvalidOperationException("Tài khoản không có địa chỉ email.");
        var safeName = HtmlEncoder.Default.Encode(user.DisplayName);
        var safeLink = HtmlEncoder.Default.Encode(confirmationLink);
        var payload = new BrevoEmailRequest(
            new BrevoSender(_options.FromName, _options.BrevoSenderEmail),
            [new BrevoRecipient(recipientEmail)],
            "Xác minh email tài khoản OpenSlot",
            $"<main style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233a\"><h1>Chào {safeName},</h1><p>Nhấn nút bên dưới để xác minh email và hoàn tất tạo tài khoản OpenSlot.</p><p><a href=\"{safeLink}\" style=\"display:inline-block;padding:12px 20px;border-radius:999px;background:#17233a;color:#fff;text-decoration:none;font-weight:bold\">Xác minh email</a></p><p style=\"color:#667085;font-size:13px\">Nếu bạn không tạo tài khoản OpenSlot, hãy bỏ qua email này.</p></main>");

        using var request = new HttpRequestMessage(HttpMethod.Post, "v3/smtp/email")
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("api-key", _options.BrevoApiKey);
        request.Headers.Add("accept", "application/json");

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Brevo rejected verification email for user {UserId} with status {StatusCode}", user.Id, (int)response.StatusCode);
                throw new InvalidOperationException("Dịch vụ email tạm thời chưa thể gửi thư. Vui lòng thử lại sau.");
            }
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "Brevo timed out while sending verification email for user {UserId}", user.Id);
            throw new InvalidOperationException("Dịch vụ email phản hồi chậm. Vui lòng thử lại sau.", exception);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Brevo request failed while sending verification email for user {UserId}", user.Id);
            throw new InvalidOperationException("Không thể kết nối dịch vụ email. Vui lòng thử lại sau.", exception);
        }
    }

    private sealed record BrevoEmailRequest(BrevoSender Sender, IReadOnlyList<BrevoRecipient> To, string Subject, string HtmlContent);
    private sealed record BrevoSender(string Name, string Email);
    private sealed record BrevoRecipient(string Email);
}
