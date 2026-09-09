using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var db = services.GetRequiredService<AppDbContext>();

        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in RoleNames.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var admin = await EnsureUserAsync(userManager, "admin@openslot.local", "OpenSlot Admin", "Admin@12345", RoleNames.Admin);
        var providerUser = await EnsureUserAsync(userManager, "provider@openslot.local", "OpenSlot Partner", "Provider@12345", RoleNames.Provider);
        _ = await EnsureUserAsync(userManager, "customer@openslot.local", "Lâm Demo", "Customer@12345", RoleNames.Customer);

        if (!await db.Categories.AnyAsync(cancellationToken))
        {
            db.Categories.AddRange(
                new Category { Name = "Sân thể thao", Slug = "sports", IconName = "trophy" },
                new Category { Name = "Làm đẹp", Slug = "beauty", IconName = "sparkles" },
                new Category { Name = "Không gian làm việc", Slug = "workspace", IconName = "laptop" });
            await db.SaveChangesAsync(cancellationToken);
        }

        var provider = await db.ProviderProfiles.SingleOrDefaultAsync(x => x.UserId == providerUser.Id, cancellationToken);
        if (provider is null)
        {
            provider = new ProviderProfile
            {
                UserId = providerUser.Id,
                BusinessName = "OpenSlot Demo Partners",
                ContactPhone = "0900000000",
                Description = "Dữ liệu demo phục vụ trải nghiệm OpenSlot.",
                Status = ProviderStatus.Approved
            };
            db.ProviderProfiles.Add(provider);
            await db.SaveChangesAsync(cancellationToken);
        }

        if (await db.ServiceOfferings.AnyAsync(cancellationToken))
        {
            return;
        }

        var categories = await db.Categories.ToDictionaryAsync(x => x.Slug, cancellationToken);
        var sportsVenue = new Venue { ProviderProfileId = provider.Id, Name = "Campus Court", AddressLine = "Khu thể thao Cầu Giấy", District = "Cầu Giấy", City = "Hà Nội", Latitude = 21.0290, Longitude = 105.7900 };
        var beautyVenue = new Venue { ProviderProfileId = provider.Id, Name = "Glow Studio", AddressLine = "Đường Nguyễn Chí Thanh", District = "Đống Đa", City = "Hà Nội", Latitude = 21.0227, Longitude = 105.8139 };
        var workspaceVenue = new Venue { ProviderProfileId = provider.Id, Name = "Focus Hub", AddressLine = "Đường Trần Duy Hưng", District = "Cầu Giấy", City = "Hà Nội", Latitude = 21.0079, Longitude = 105.7994 };

        var servicesToSeed = new[]
        {
            new ServiceOffering { Venue = sportsVenue, CategoryId = categories["sports"].Id, Name = "Sân cầu lông 60 phút", Description = "Deal sát giờ cho một sân cầu lông tiêu chuẩn.", DefaultDurationMinutes = 60, BasePriceVnd = 180_000 },
            new ServiceOffering { Venue = beautyVenue, CategoryId = categories["beauty"].Id, Name = "Gội đầu thư giãn 45 phút", Description = "Một khung giờ làm đẹp còn trống trong ngày.", DefaultDurationMinutes = 45, BasePriceVnd = 150_000 },
            new ServiceOffering { Venue = workspaceVenue, CategoryId = categories["workspace"].Id, Name = "Bàn làm việc theo giờ", Description = "Không gian yên tĩnh dành cho học tập và làm việc.", DefaultDurationMinutes = 120, BasePriceVnd = 100_000 }
        };
        db.ServiceOfferings.AddRange(servicesToSeed);
        await db.SaveChangesAsync(cancellationToken);

        var now = DateTime.UtcNow;
        db.DealSlots.AddRange(
            CreateDemoSlot(servicesToSeed[0], now.AddHours(3), 60, 180_000, 99_000, 1),
            CreateDemoSlot(servicesToSeed[1], now.AddHours(4), 45, 150_000, 79_000, 2),
            CreateDemoSlot(servicesToSeed[2], now.AddHours(5), 120, 100_000, 49_000, 4));
        db.AuditLogs.Add(new AuditLog { ActorUserId = admin.Id, Action = "seed.created", EntityType = "DemoData", EntityId = "initial" });
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<ApplicationUser> EnsureUserAsync(UserManager<ApplicationUser> userManager, string email, string displayName, string password, string role)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = displayName };
            var createResult = await userManager.CreateAsync(user, password);
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException($"Could not seed {email}: {string.Join(", ", createResult.Errors.Select(x => x.Description))}");
            }
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            await userManager.AddToRoleAsync(user, role);
        }

        return user;
    }

    private static DealSlot CreateDemoSlot(ServiceOffering service, DateTime startAtUtc, int durationMinutes, long originalPriceVnd, long dealPriceVnd, int capacity) => new()
    {
        ServiceOfferingId = service.Id,
        StartAtUtc = startAtUtc,
        EndAtUtc = startAtUtc.AddMinutes(durationMinutes),
        BookingOpensAtUtc = DateTime.UtcNow.AddMinutes(-5),
        BookingClosesAtUtc = startAtUtc.AddMinutes(-15),
        OriginalPriceVnd = originalPriceVnd,
        DealPriceVnd = dealPriceVnd,
        Capacity = capacity,
        Status = DealSlotStatus.Published,
        PublishedAtUtc = DateTime.UtcNow
    };
}
