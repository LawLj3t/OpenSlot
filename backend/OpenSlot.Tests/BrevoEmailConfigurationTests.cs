using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;

namespace OpenSlot.Tests;

public sealed class BrevoEmailConfigurationTests
{
    [Fact]
    public void CompleteBrevoConfiguration_IsReadyToSend()
    {
        var service = CreateService(new EmailOptions
        {
            BrevoApiKey = "xkeysib-test-key",
            BrevoSenderEmail = "openslot.demo@gmail.com",
            PublicBaseUrl = "https://openslot-vn.onrender.com"
        });

        Assert.True(service.IsConfigured);
    }

    [Fact]
    public void MissingApiKey_IsNotReadyToSend()
    {
        var service = CreateService(new EmailOptions
        {
            BrevoSenderEmail = "openslot.demo@gmail.com",
            PublicBaseUrl = "https://openslot-vn.onrender.com"
        });

        Assert.False(service.IsConfigured);
    }

    private static BrevoEmailVerificationService CreateService(EmailOptions options) =>
        new(new HttpClient { BaseAddress = new Uri("https://api.brevo.com/") }, Options.Create(options), NullLogger<BrevoEmailVerificationService>.Instance);
}
