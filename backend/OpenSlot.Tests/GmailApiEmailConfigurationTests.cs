using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Tests;

public sealed class GmailApiEmailConfigurationTests
{
    [Fact]
    public void CompleteGoogleOAuthConfiguration_IsReadyToSend()
    {
        var service = CreateService(new EmailOptions
        {
            GoogleClientId = "client-id.apps.googleusercontent.com",
            GoogleClientSecret = "client-secret",
            GoogleRefreshToken = "refresh-token",
            GoogleSenderEmail = "lam1292003@gmail.com",
            PublicBaseUrl = "https://openslot-vn.onrender.com"
        });

        Assert.True(service.IsConfigured);
    }

    [Fact]
    public void MissingRefreshToken_IsNotReadyToSend()
    {
        var service = CreateService(new EmailOptions
        {
            GoogleClientId = "client-id.apps.googleusercontent.com",
            GoogleClientSecret = "client-secret",
            GoogleSenderEmail = "lam1292003@gmail.com",
            PublicBaseUrl = "https://openslot-vn.onrender.com"
        });

        Assert.False(service.IsConfigured);
    }

    [Fact]
    public void CompleteSmtpConfiguration_IsReadyToSend()
    {
        var service = CreateService(new EmailOptions
        {
            SmtpHost = "smtp.gmail.com",
            SmtpPort = 587,
            SmtpUsername = "support@openslot.vn",
            SmtpPassword = "secret-password"
        });

        Assert.True(service.IsConfigured);
    }

    [Fact]
    public async Task UnconfiguredService_LogsAndDoesNotThrow_OnSupportTicketResolution()
    {
        var service = CreateService(new EmailOptions());
        Assert.False(service.IsConfigured);

        var exception = await Record.ExceptionAsync(() => service.SendSupportTicketResolutionAsync(
            "customer@example.com",
            "Customer",
            Guid.NewGuid(),
            "Lỗi thanh toán",
            "Tôi đã thanh toán nhưng chưa nhận được mã PIN.",
            "CSKH đã kiểm tra và gửi lại mã PIN thành công.",
            "CSKH Minh"));

        Assert.Null(exception);
    }

    private static GmailApiEmailVerificationService CreateService(EmailOptions options) =>
        new(new HttpClient(), Options.Create(options), NullLogger<GmailApiEmailVerificationService>.Instance);
}
