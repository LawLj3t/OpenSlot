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

    private static GmailApiEmailVerificationService CreateService(EmailOptions options) =>
        new(new HttpClient(), Options.Create(options), NullLogger<GmailApiEmailVerificationService>.Instance);
}
