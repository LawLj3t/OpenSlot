using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text;
using System.Text.Encodings.Web;
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
        IsGmailApiConfigured || IsSmtpConfigured;

    private bool IsGmailApiConfigured =>
        !string.IsNullOrWhiteSpace(_options.GoogleClientId) &&
        !string.IsNullOrWhiteSpace(_options.GoogleClientSecret) &&
        !string.IsNullOrWhiteSpace(_options.GoogleRefreshToken) &&
        !string.IsNullOrWhiteSpace(_options.GoogleSenderEmail);

    private bool IsSmtpConfigured =>
        !string.IsNullOrWhiteSpace(_options.SmtpHost) &&
        !string.IsNullOrWhiteSpace(_options.SmtpUsername) &&
        !string.IsNullOrWhiteSpace(_options.SmtpPassword);

    public async Task SendConfirmationAsync(ApplicationUser user, string confirmationLink, CancellationToken cancellationToken = default)
    {
        var html = $"<main style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233a\"><h1>Chào {HtmlEncoder.Default.Encode(user.DisplayName)},</h1><p>Nhấn nút bên dưới để xác minh email và hoàn tất tạo tài khoản OpenSlot.</p><p><a href=\"{HtmlEncoder.Default.Encode(confirmationLink)}\" style=\"display:inline-block;padding:12px 20px;border-radius:999px;background:#17233a;color:#fff;text-decoration:none;font-weight:bold\">Xác minh email</a></p><p style=\"color:#667085;font-size:13px\">Nếu bạn không tạo tài khoản OpenSlot, hãy bỏ qua email này.</p></main>";
        var recipientEmail = user.Email ?? throw new InvalidOperationException("Tài khoản không có địa chỉ email.");
        await SendEmailAsync(recipientEmail, "Xác minh email tài khoản OpenSlot", html, cancellationToken);
    }

    public async Task SendPasswordResetAsync(ApplicationUser user, string resetLink, CancellationToken cancellationToken = default)
    {
        var html = $"<main style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233a\"><h1>Chào {HtmlEncoder.Default.Encode(user.DisplayName)},</h1><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu OpenSlot của bạn.</p><p><a href=\"{HtmlEncoder.Default.Encode(resetLink)}\" style=\"display:inline-block;padding:12px 20px;border-radius:999px;background:#17233a;color:#fff;text-decoration:none;font-weight:bold\">Đặt lại mật khẩu</a></p><p>Link này chỉ có hiệu lực trong 30 phút và dùng được một lần.</p><p style=\"color:#667085;font-size:13px\">Nếu không phải bạn yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p></main>";
        var recipientEmail = user.Email ?? throw new InvalidOperationException("Tài khoản không có địa chỉ email.");
        await SendEmailAsync(recipientEmail, "Đặt lại mật khẩu OpenSlot", html, cancellationToken);
    }

    public async Task SendSupportTicketResolutionAsync(
        string recipientEmail,
        string recipientName,
        Guid ticketId,
        string category,
        string originalContent,
        string resolutionNote,
        string resolverName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(recipientEmail) || !recipientEmail.Contains('@'))
        {
            logger.LogWarning("Cannot send CSKH resolution email: invalid recipient {Email}", recipientEmail);
            return;
        }

        var shortId = ticketId.ToString()[..8].ToUpperInvariant();
        var safeName = HtmlEncoder.Default.Encode(string.IsNullOrWhiteSpace(recipientName) ? "bạn" : recipientName);
        var safeCategory = HtmlEncoder.Default.Encode(category);
        var safeContent = HtmlEncoder.Default.Encode(originalContent).Replace("\n", "<br/>");
        var safeResolution = HtmlEncoder.Default.Encode(resolutionNote).Replace("\n", "<br/>");
        var safeResolver = HtmlEncoder.Default.Encode(resolverName);
        var helpLink = string.IsNullOrWhiteSpace(_options.PublicBaseUrl)
            ? "https://openslot-vn.onrender.com/help"
            : $"{_options.PublicBaseUrl.TrimEnd('/')}/help";

        var html = $"""
            <main style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:20px auto;padding:26px;border:1px solid #e2e8f0;border-radius:14px;background-color:#ffffff;color:#17233a;line-height:1.6;">
              <div style="border-bottom:2px solid #ee4d2d;padding-bottom:14px;margin-bottom:20px;">
                <h2 style="color:#ee4d2d;margin:0;font-size:22px;font-weight:800;">OpenSlot · Chăm sóc khách hàng</h2>
                <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Yêu cầu hỗ trợ #{shortId}</p>
              </div>

              <p style="font-size:14.5px;">Xin chào <strong>{safeName}</strong>,</p>
              <p style="font-size:14px;color:#334155;">Đội ngũ CSKH OpenSlot đã kiểm tra và phản hồi yêu cầu hỗ trợ của bạn liên quan đến vấn đề <strong>{safeCategory}</strong>.</p>

              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:18px 0;">
                <p style="margin:0 0 6px;font-weight:bold;font-size:12.5px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Nội dung bạn đã gửi:</p>
                <div style="margin:0;font-size:13.5px;color:#334155;font-style:italic;">&ldquo;{safeContent}&rdquo;</div>
              </div>

              <div style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:8px;padding:16px 18px;margin:20px 0;">
                <p style="margin:0 0 8px;font-weight:bold;font-size:14px;color:#c2410c;">Phản hồi từ CSKH ({safeResolver}):</p>
                <div style="margin:0;font-size:14px;color:#1e293b;">{safeResolution}</div>
              </div>

              <p style="font-size:13px;color:#64748b;margin-top:24px;">
                Nếu có thêm thắc mắc hoặc cần hỗ trợ thêm, bạn có thể truy cập <a href="{HtmlEncoder.Default.Encode(helpLink)}" style="color:#ee4d2d;text-decoration:none;font-weight:bold;">Trung tâm trợ giúp OpenSlot</a> để gửi yêu cầu mới.
              </p>

              <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:26px;font-size:12px;color:#94a3b8;text-align:center;">
                <p style="margin:0;font-weight:600;">OpenSlot Platform · Nền tảng đặt chỗ ưu đãi giờ chót</p>
                <p style="margin:4px 0 0;">Thư này được gửi tự động tới {HtmlEncoder.Default.Encode(recipientEmail)}.</p>
              </div>
            </main>
            """;

        var subject = $"[OpenSlot] Phản hồi yêu cầu hỗ trợ #{shortId}: {category}";

        if (!IsConfigured)
        {
            logger.LogInformation(
                "Email service not configured. Simulated CSKH response to {Email} for ticket {TicketId}: {Resolution}",
                recipientEmail,
                ticketId,
                resolutionNote);
            return;
        }

        await SendEmailAsync(recipientEmail, subject, html, cancellationToken);
    }

    private async Task SendEmailAsync(string recipientEmail, string subject, string html, CancellationToken cancellationToken)
    {
        if (IsSmtpConfigured)
        {
            await SendViaSmtpAsync(recipientEmail, subject, html, cancellationToken);
            return;
        }

        if (IsGmailApiConfigured)
        {
            await SendViaGmailApiAsync(recipientEmail, subject, html, cancellationToken);
            return;
        }

        throw new InvalidOperationException("Dịch vụ email chưa được cấu hình.");
    }

    private async Task SendViaSmtpAsync(string recipientEmail, string subject, string html, CancellationToken cancellationToken)
    {
        var senderEmail = !string.IsNullOrWhiteSpace(_options.GoogleSenderEmail)
            ? _options.GoogleSenderEmail
            : _options.SmtpUsername;

        using var message = new MailMessage
        {
            From = new MailAddress(senderEmail, _options.FromName, Encoding.UTF8),
            Subject = subject,
            Body = html,
            IsBodyHtml = true,
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8
        };
        message.To.Add(new MailAddress(recipientEmail));

        using var client = new SmtpClient(_options.SmtpHost, _options.SmtpPort)
        {
            EnableSsl = _options.SmtpEnableSsl,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(_options.SmtpUsername, _options.SmtpPassword),
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            await client.SendMailAsync(message, cancellationToken);
            logger.LogInformation("Sent email via SMTP to {RecipientEmail} with subject {Subject}", recipientEmail, subject);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "SMTP delivery failed for {RecipientEmail}", recipientEmail);
            throw new InvalidOperationException("Không thể gửi email qua máy chủ SMTP. Vui lòng kiểm tra lại cấu hình.", ex);
        }
    }

    private async Task SendViaGmailApiAsync(string recipientEmail, string subject, string html, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(cancellationToken);
        var rawMessage = CreateRawMessage(recipientEmail, subject, html);
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
                logger.LogWarning("Gmail API rejected email for {Recipient} with status {StatusCode}", recipientEmail, (int)response.StatusCode);
                throw new InvalidOperationException("Dịch vụ email tạm thời chưa thể gửi thư. Vui lòng thử lại sau.");
            }
            logger.LogInformation("Sent email via Gmail API to {RecipientEmail} with subject {Subject}", recipientEmail, subject);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "Gmail API timed out while sending email for {Recipient}", recipientEmail);
            throw new InvalidOperationException("Dịch vụ email phản hồi chậm. Vui lòng thử lại sau.", exception);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Gmail API request failed while sending email for {Recipient}", recipientEmail);
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

    private string CreateRawMessage(string recipientEmail, string subject, string html)
    {
        var senderEmail = !string.IsNullOrWhiteSpace(_options.GoogleSenderEmail)
            ? _options.GoogleSenderEmail
            : _options.SmtpUsername;

        var message = string.Join("\r\n", [
            $"From: {EncodeHeader(_options.FromName)} <{senderEmail}>",
            $"To: <{recipientEmail}>",
            $"Subject: {EncodeHeader(subject)}",
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
