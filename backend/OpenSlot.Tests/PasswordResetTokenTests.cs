using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain.Entities;

namespace OpenSlot.Tests;

public sealed class PasswordResetTokenTests
{
    [Fact]
    public async Task PasswordResetToken_CanOnlyBeUsedOnce_AndInvalidatesSecurityStamp()
    {
        await using var provider = CreateServices();
        using var scope = provider.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser
        {
            UserName = "reset-test@gmail.com",
            Email = "reset-test@gmail.com",
            EmailConfirmed = true,
            DisplayName = "Reset Test"
        };

        Assert.True((await users.CreateAsync(user, "Before@123")).Succeeded);
        var securityStampBefore = user.SecurityStamp;
        var token = await users.GeneratePasswordResetTokenAsync(user);

        Assert.True((await users.ResetPasswordAsync(user, token, "After@1234")).Succeeded);
        Assert.NotEqual(securityStampBefore, user.SecurityStamp);
        Assert.False((await users.ResetPasswordAsync(user, token, "Another@1234")).Succeeded);
        Assert.True(await users.CheckPasswordAsync(user, "After@1234"));
    }

    private static ServiceProvider CreateServices()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireNonAlphanumeric = false;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();
        return services.BuildServiceProvider();
    }
}
