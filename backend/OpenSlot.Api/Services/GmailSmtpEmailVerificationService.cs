using System.Text.Encodings.Web;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Services;

public sealed class GmailSmtpEmailVerificationService(
    IOptions<EmailOptions> emailOptions,
    ILogger<GmailSmtpEmailVerificationService> logger) : IEmailVerificationService
{
    private readonly EmailOptions _options = emailOptions.Value;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.GmailAddress) &&
        !string.IsNullOrWhiteSpace(_options.GmailAppPassword) &&
        Uri.TryCreate(_options.PublicBaseUrl, UriKind.Absolute, out _);

    public async Task SendConfirmationAsync(ApplicationUser user, string confirmationLink, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Dịch vụ Gmail chưa được cấu hình.");
        }

        var safeName = HtmlEncoder.Default.Encode(user.DisplayName);
        var safeLink = HtmlEncoder.Default.Encode(confirmationLink);
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.GmailAddress));
        var recipientEmail = user.Email ?? throw new InvalidOperationException("Tài khoản không có địa chỉ email.");
        message.To.Add(MailboxAddress.Parse(recipientEmail));
        message.Subject = "Xác minh email tài khoản OpenSlot";
        message.Body = new TextPart("html")
        {
            Text = $"<main style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17233a\"><h1>Chào {safeName},</h1><p>Nhấn nút bên dưới để xác minh email và hoàn tất tạo tài khoản OpenSlot.</p><p><a href=\"{safeLink}\" style=\"display:inline-block;padding:12px 20px;border-radius:999px;background:#17233a;color:#fff;text-decoration:none;font-weight:bold\">Xác minh email</a></p><p style=\"color:#667085;font-size:13px\">Nếu bạn không tạo tài khoản OpenSlot, hãy bỏ qua email này.</p></main>"
        };

        try
        {
            using var client = new SmtpClient();
            await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls, cancellationToken);
            await client.AuthenticateAsync(_options.GmailAddress, _options.GmailAppPassword, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Gmail SMTP could not send verification email for user {UserId}", user.Id);
            throw new InvalidOperationException("Gmail không thể gửi thư xác minh.", exception);
        }
    }
}
