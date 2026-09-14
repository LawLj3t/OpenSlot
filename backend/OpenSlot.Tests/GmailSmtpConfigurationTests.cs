using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Tests;

public sealed class GmailSmtpConfigurationTests
{
    [Fact]
    public void CompleteGmailConfiguration_IsReadyToSend()
    {
        var service = CreateService(new EmailOptions
        {
            GmailAddress = "openslot.demo@gmail.com",
            GmailAppPassword = "abcdefghijklmnop",
            PublicBaseUrl = "https://openslot-vn.onrender.com"
        });

        Assert.True(service.IsConfigured);
    }

    [Fact]
    public void MissingAppPassword_IsNotReadyToSend()
    {
        var service = CreateService(new EmailOptions
        {
            GmailAddress = "openslot.demo@gmail.com",
            PublicBaseUrl = "https://openslot-vn.onrender.com"
        });

        Assert.False(service.IsConfigured);
    }

    private static GmailSmtpEmailVerificationService CreateService(EmailOptions options) =>
        new(Options.Create(options), NullLogger<GmailSmtpEmailVerificationService>.Instance);
}
