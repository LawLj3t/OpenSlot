using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Services;

public sealed class GmailApiEmailVerificationService(
    HttpClient httpClient,
    IOptions<EmailOptions> emailOptions,
    ILogger<GmailApiEmailVerificationService> logger) : IEmailVerificationService
{
    private readonly EmailOptions _options = emailOptions.Value;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.GoogleClientId) &&
        !string.IsNullOrWhiteSpace(_options.GoogleClientSecret) &&
        !string.IsNullOrWhiteSpace(_options.GoogleRefreshToken) &&
        !string.IsNullOrWhiteSpace(_options.GoogleSenderEmail) &&
        Uri.TryCreate(_options.PublicBaseUrl, UriKind.Absolute, out _);

    public async Task SendConfirmationAsync(ApplicationUser user, string confirmationLink, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Dịch vụ email chưa được cấu hình.");
        }

        var recipientEmail = user.Email ?? throw new InvalidOperationException("Tài khoản không có địa chỉ email.");
        var accessToken = await GetAccessTokenAsync(cancellationToken);
        var rawMessage = CreateRawMessage(recipientEmail, user.DisplayName, confirmationLink);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
        {
            Content = JsonContent.Create(new GmailSendRequest(rawMessage))
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Gmail API rejected verification email for user {UserId} with status {StatusCode}", user.Id, (int)response.StatusCode);
                throw new InvalidOperationException("Dịch vụ email tạm thời chưa thể gửi thư. Vui lòng thử lại sau.");
            }
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "Gmail API timed out while sending verification email for user {UserId}", user.Id);
            throw new InvalidOperationException("Dịch vụ email phản hồi chậm. Vui lòng thử lại sau.", exception);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Gmail API request failed while sending verification email for user {UserId}", user.Id);
            throw new InvalidOperationException("Không thể kết nối dịch vụ email. Vui lòng thử lại sau.", exception);
        }
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://oauth2.googleapis.com/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _options.GoogleClientId,
                ["client_secret"] = _options.GoogleClientSecret,
                ["refresh_token"] = _options.GoogleRefreshToken,
                ["grant_type"] = "refresh_token"
            })
        };

        using var response = await httpClient.SendAsync(tokenRequest, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Google OAuth token refresh failed with status {StatusCode}", (int)response.StatusCode);
            throw new InvalidOperationException("Dịch vụ email chưa thể xác thực. Vui lòng thử lại sau.");
        }

        var token = await response.Content.ReadFromJsonAsync<GoogleTokenResponse>(cancellationToken: cancellationToken);
        if (string.IsNullOrWhiteSpace(token?.AccessToken))
        {
            logger.LogWarning("Google OAuth token response did not contain an access token.");
            throw new InvalidOperationException("Dịch vụ email chưa thể xác thực. Vui lòng thử lại sau.");
        }

        return token.AccessToken;
    }

    private string CreateRawMessage(string recipientEmail, string displayName, string confirmationLink)
    {
        var safeName = HtmlEncoder.Default.Encode(displayName);
        var safeLink = HtmlEncoder.Default.Encode(confirmationLink);
        var html = $"<main style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233a\"><h1>Chào {safeName},</h1><p>Nhấn nút bên dưới để xác minh email và hoàn tất tạo tài khoản OpenSlot.</p><p><a href=\"{safeLink}\" style=\"display:inline-block;padding:12px 20px;border-radius:999px;background:#17233a;color:#fff;text-decoration:none;font-weight:bold\">Xác minh email</a></p><p style=\"color:#667085;font-size:13px\">Nếu bạn không tạo tài khoản OpenSlot, hãy bỏ qua email này.</p></main>";
        var message = string.Join("\r\n", [
            $"From: {EncodeHeader(_options.FromName)} <{_options.GoogleSenderEmail}>",
            $"To: <{recipientEmail}>",
            $"Subject: {EncodeHeader("Xác minh email tài khoản OpenSlot")}",
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=utf-8",
            "Content-Transfer-Encoding: base64",
            string.Empty,
            Convert.ToBase64String(Encoding.UTF8.GetBytes(html))
        ]);

        return Convert.ToBase64String(Encoding.UTF8.GetBytes(message))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string EncodeHeader(string value) =>
        $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(value))}?=";

    private sealed record GoogleTokenResponse([property: JsonPropertyName("access_token")] string AccessToken);
    private sealed record GmailSendRequest(string Raw);
}
