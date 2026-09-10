using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Data;

public static class DbInitializer
{
    private sealed record CategorySeed(string Slug, string Name, string IconName);
    private sealed record ProviderSeed(string Email, string DisplayName, string Password, string BusinessName, string Phone, string Description);
    private sealed record VenueSeed(string ProviderEmail, string Name, string Address, string District, double Latitude, double Longitude, string? LegacyName = null);
    private sealed record ResourceSeed(string VenueName, string Name, string ResourceType, string Code, string FloorOrZone, string PositionDescription, int MaxCapacity, string? LegacyName = null, string? LegacyCode = null);
    private sealed record ServiceSeed(string VenueName, string CategorySlug, string Name, string Description, long BasePriceVnd, string[]? LegacyNames = null);
    private sealed record SlotSeed(string ServiceName, string ResourceCode, int OffsetMinutes, int DurationMinutes, long OriginalPriceVnd, long DealPriceVnd, int Capacity);

    private static readonly CategorySeed[] CategorySeeds =
    {
        new("sports", "Thể thao", "trophy"), new("beauty", "Làm đẹp", "sparkles"), new("workspace", "Không gian làm việc", "laptop"),
        new("creative", "Sáng tạo", "camera"), new("entertainment", "Giải trí", "joystick"), new("utilities", "Tiện ích", "tools")
    };

    private static readonly ProviderSeed[] ProviderSeeds =
    {
        new("provider@openslot.local", "Campus Active", "Provider@12345", "Campus Active", "0901000001", "Đối tác thể thao với các sân trống theo giờ tại Cầu Giấy."),
        new("beauty@openslot.local", "Glow Wellness", "Beauty@12345", "Glow Wellness", "0901000002", "Chăm sóc cá nhân và làm đẹp linh hoạt tại Đống Đa."),
        new("workspace@openslot.local", "Focus Hub", "Workspace@12345", "Focus Hub", "0901000003", "Không gian làm việc và họp nhóm cho người cần chỗ ngay."),
        new("creative@openslot.local", "Frame Lab", "Creative@12345", "Frame Lab", "0901000004", "Studio sáng tạo cho chụp ảnh và thu âm theo khung giờ."),
        new("entertainment@openslot.local", "Play Loft", "Entertainment@12345", "Play Loft", "0901000005", "Không gian giải trí nhóm với các suất trống sát giờ."),
        new("utility@openslot.local", "Care Express", "Utility@12345", "Care Express", "0901000006", "Dịch vụ tiện ích nhanh cho nhu cầu phát sinh trong ngày.")
    };

    private static readonly VenueSeed[] VenueSeeds =
    {
        new("provider@openslot.local", "Campus Active Cầu Giấy", "Số 8 Trần Thái Tông, Cầu Giấy, Hà Nội", "Cầu Giấy", 21.0378, 105.7901, "Campus Court"),
        new("beauty@openslot.local", "Glow Wellness Đống Đa", "Số 35 Nguyễn Chí Thanh, Đống Đa, Hà Nội", "Đống Đa", 21.0173, 105.8162, "Glow Studio"),
        new("workspace@openslot.local", "Focus Hub Cầu Giấy", "Số 18 Trần Duy Hưng, Cầu Giấy, Hà Nội", "Cầu Giấy", 21.0079, 105.7994, "Focus Hub"),
        new("creative@openslot.local", "Frame Lab Hai Bà Trưng", "Số 67 Đại Cồ Việt, Hai Bà Trưng, Hà Nội", "Hai Bà Trưng", 21.0062, 105.8551),
        new("entertainment@openslot.local", "Play Loft Ba Đình", "Số 42 Liễu Giai, Ba Đình, Hà Nội", "Ba Đình", 21.0355, 105.8265),
        new("utility@openslot.local", "Care Express Thanh Xuân", "Số 57 Khương Đình, Thanh Xuân, Hà Nội", "Thanh Xuân", 21.0005, 105.8128)
    };

    private static readonly ResourceSeed[] ResourceSeeds =
    {
        new("Campus Active Cầu Giấy", "Sân cầu lông số 1", "Sân cầu lông", "CL-01", "Khu A", "Gần quầy lễ tân", 4, "Sân số 1", "S1"),
        new("Campus Active Cầu Giấy", "Sân pickleball số 2", "Sân pickleball", "PB-02", "Khu B", "Cạnh khu nước uống", 4),
        new("Glow Wellness Đống Đa", "Giường gội số 2", "Ghế gội", "G-02", "Tầng 1", "Khu gội đầu dưỡng sinh", 1, "Ghế gội số 2", "G2"),
        new("Glow Wellness Đống Đa", "Bàn nail số 5", "Bàn nail", "N-05", "Tầng 2", "Gần cửa sổ", 1),
        new("Focus Hub Cầu Giấy", "Bàn C-08", "Bàn làm việc", "C-08", "Tầng 3", "Khu yên tĩnh", 1),
        new("Focus Hub Cầu Giấy", "Phòng họp M-02", "Phòng họp", "M-02", "Tầng 4", "Màn hình trình chiếu", 6),
        new("Frame Lab Hai Bà Trưng", "Studio A", "Studio chụp ảnh", "ST-A", "Tầng 2", "Phông nền trắng và đèn liên tục", 4),
        new("Frame Lab Hai Bà Trưng", "Phòng podcast P-01", "Phòng podcast", "P-01", "Tầng 3", "Cách âm cơ bản", 3),
        new("Play Loft Ba Đình", "Bàn bi-a số 3", "Bàn bi-a", "B-03", "Tầng 1", "Khu bi-a", 4),
        new("Play Loft Ba Đình", "Phòng karaoke K-02", "Phòng karaoke", "K-02", "Tầng 2", "Phòng riêng", 6),
        new("Care Express Thanh Xuân", "Vịnh rửa số 2", "Khu rửa xe", "R-02", "Tầng trệt", "Lối vào bên phải", 1),
        new("Care Express Thanh Xuân", "Máy giặt số 4", "Máy giặt tự phục vụ", "G-04", "Tầng trệt", "Khu giặt sấy", 1)
    };

    private static readonly ServiceSeed[] ServiceSeeds =
    {
        new("Campus Active Cầu Giấy", "sports", "Sân cầu lông", "Đặt sân tiêu chuẩn trong khung giờ còn trống.", 180_000, ["Sân cầu lông 60 phút"]),
        new("Campus Active Cầu Giấy", "sports", "Sân pickleball", "Sân pickleball cho nhóm bạn cần chơi ngay.", 240_000),
        new("Glow Wellness Đống Đa", "beauty", "Gội đầu dưỡng sinh", "Suất chăm sóc tóc và thư giãn còn trống trong ngày.", 150_000, ["Gội đầu thư giãn 45 phút"]),
        new("Glow Wellness Đống Đa", "beauty", "Làm móng nhanh", "Lịch nail còn trống cho khách cần đặt sát giờ.", 220_000),
        new("Focus Hub Cầu Giấy", "workspace", "Bàn làm việc", "Chỗ ngồi yên tĩnh cho học tập và làm việc.", 100_000, ["Bàn làm việc theo giờ"]),
        new("Focus Hub Cầu Giấy", "workspace", "Phòng họp nhóm", "Phòng họp sẵn màn hình cho nhóm nhỏ.", 450_000),
        new("Frame Lab Hai Bà Trưng", "creative", "Studio chụp ảnh", "Không gian chụp ảnh cơ bản với phông nền và đèn.", 500_000),
        new("Frame Lab Hai Bà Trưng", "creative", "Phòng podcast", "Phòng thu âm dành cho podcast và phỏng vấn ngắn.", 350_000),
        new("Play Loft Ba Đình", "entertainment", "Bàn bi-a", "Bàn bi-a còn trống cho nhóm bạn sau giờ làm.", 180_000),
        new("Play Loft Ba Đình", "entertainment", "Phòng karaoke mini", "Phòng riêng cho nhóm nhỏ muốn hát sát giờ.", 600_000),
        new("Care Express Thanh Xuân", "utilities", "Rửa xe máy", "Dịch vụ rửa xe nhanh trong khi bạn chờ.", 80_000),
        new("Care Express Thanh Xuân", "utilities", "Máy giặt tự phục vụ", "Một máy giặt trống để xử lý đồ dùng ngay.", 60_000)
    };

    private static readonly SlotSeed[] SlotSeeds =
    {
        new("Sân cầu lông", "CL-01", 135, 60, 180_000, 99_000, 4), new("Sân pickleball", "PB-02", 165, 90, 240_000, 139_000, 4),
        new("Gội đầu dưỡng sinh", "G-02", 195, 45, 150_000, 79_000, 1), new("Làm móng nhanh", "N-05", 225, 60, 220_000, 129_000, 1),
        new("Bàn làm việc", "C-08", 255, 120, 100_000, 49_000, 1), new("Phòng họp nhóm", "M-02", 285, 90, 450_000, 249_000, 6),
        new("Studio chụp ảnh", "ST-A", 315, 90, 500_000, 279_000, 4), new("Phòng podcast", "P-01", 345, 60, 350_000, 189_000, 3),
        new("Bàn bi-a", "B-03", 375, 90, 180_000, 99_000, 4), new("Phòng karaoke mini", "K-02", 405, 120, 600_000, 329_000, 6),
        new("Rửa xe máy", "R-02", 435, 30, 80_000, 45_000, 1), new("Máy giặt tự phục vụ", "G-04", 465, 45, 60_000, 35_000, 1)
    };

    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in RoleNames.All)
            if (!await roleManager.RoleExistsAsync(role)) await roleManager.CreateAsync(new IdentityRole(role));

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var admin = await EnsureUserAsync(userManager, "admin@openslot.local", "OpenSlot Admin", "Admin@12345", RoleNames.Admin);
        _ = await EnsureUserAsync(userManager, "manager@openslot.local", "OpenSlot Manager", "Manager@12345", RoleNames.Manager);
        _ = await EnsureUserAsync(userManager, "customer@openslot.local", "Lâm Demo", "Customer@12345", RoleNames.Customer);

        var categories = await EnsureCategoriesAsync(db, cancellationToken);
        var providers = await EnsureProvidersAsync(db, userManager, cancellationToken);
        var venues = await EnsureVenuesAsync(db, providers, cancellationToken);
        var resources = await EnsureResourcesAsync(db, venues, cancellationToken);
        var serviceOfferings = await EnsureServicesAsync(db, venues, categories, cancellationToken);
        await EnsureDemoSlotsAsync(db, serviceOfferings, resources, cancellationToken);
        await EnsureResourcesForExistingDataAsync(db, cancellationToken);

        if (!await db.AuditLogs.AnyAsync(x => x.Action == "seed.catalog-upgraded", cancellationToken))
        {
            db.AuditLogs.Add(new AuditLog { ActorUserId = admin.Id, Action = "seed.catalog-upgraded", EntityType = "DemoData", EntityId = "catalog-v2" });
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static async Task<Dictionary<string, Category>> EnsureCategoriesAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        foreach (var seed in CategorySeeds)
        {
            var category = await db.Categories.SingleOrDefaultAsync(x => x.Slug == seed.Slug, cancellationToken);
            if (category is null) db.Categories.Add(new Category { Name = seed.Name, Slug = seed.Slug, IconName = seed.IconName });
            else { category.Name = seed.Name; category.IconName = seed.IconName; category.IsActive = true; }
        }
        await db.SaveChangesAsync(cancellationToken);
        return await db.Categories.ToDictionaryAsync(x => x.Slug, cancellationToken);
    }

    private static async Task<Dictionary<string, ProviderProfile>> EnsureProvidersAsync(AppDbContext db, UserManager<ApplicationUser> userManager, CancellationToken cancellationToken)
    {
        var providers = new Dictionary<string, ProviderProfile>(StringComparer.OrdinalIgnoreCase);
        foreach (var seed in ProviderSeeds)
        {
            var user = await EnsureUserAsync(userManager, seed.Email, seed.DisplayName, seed.Password, RoleNames.Provider);
            var profile = await db.ProviderProfiles.SingleOrDefaultAsync(x => x.UserId == user.Id, cancellationToken);
            if (profile is null) { profile = new ProviderProfile { UserId = user.Id }; db.ProviderProfiles.Add(profile); }
            profile.BusinessName = seed.BusinessName; profile.ContactPhone = seed.Phone; profile.Description = seed.Description; profile.Status = ProviderStatus.Approved;
            providers.Add(seed.Email, profile);
        }
        await db.SaveChangesAsync(cancellationToken);
        return providers;
    }

    private static async Task<Dictionary<string, Venue>> EnsureVenuesAsync(AppDbContext db, IReadOnlyDictionary<string, ProviderProfile> providers, CancellationToken cancellationToken)
    {
        var venues = new Dictionary<string, Venue>(StringComparer.OrdinalIgnoreCase);
        foreach (var seed in VenueSeeds)
        {
            var venue = await db.Venues.FirstOrDefaultAsync(x => x.Name == seed.Name || x.Name == seed.LegacyName, cancellationToken);
            if (venue is null) { venue = new Venue { Name = seed.Name }; db.Venues.Add(venue); }
            venue.ProviderProfileId = providers[seed.ProviderEmail].Id; venue.AddressLine = seed.Address; venue.District = seed.District; venue.City = "Hà Nội"; venue.Latitude = seed.Latitude; venue.Longitude = seed.Longitude;
            venues.Add(seed.Name, venue);
        }
        await db.SaveChangesAsync(cancellationToken);
        return venues;
    }

    private static async Task<Dictionary<string, BookableResource>> EnsureResourcesAsync(AppDbContext db, IReadOnlyDictionary<string, Venue> venues, CancellationToken cancellationToken)
    {
        var resources = new Dictionary<string, BookableResource>(StringComparer.OrdinalIgnoreCase);
        foreach (var seed in ResourceSeeds)
        {
            var venue = venues[seed.VenueName];
            var resource = await db.BookableResources.FirstOrDefaultAsync(x => x.VenueId == venue.Id && (x.Code == seed.Code || (seed.LegacyCode != null && x.Code == seed.LegacyCode) || x.Name == seed.Name || (seed.LegacyName != null && x.Name == seed.LegacyName)), cancellationToken);
            if (resource is null) { resource = new BookableResource { VenueId = venue.Id, Code = seed.Code }; db.BookableResources.Add(resource); }
            resource.Name = seed.Name; resource.ResourceType = seed.ResourceType; resource.Code = seed.Code; resource.FloorOrZone = seed.FloorOrZone; resource.PositionDescription = seed.PositionDescription; resource.MaxCapacity = seed.MaxCapacity; resource.IsActive = true;
            resources.Add(seed.Code, resource);
        }
        await db.SaveChangesAsync(cancellationToken);
        return resources;
    }

    private static async Task<Dictionary<string, ServiceOffering>> EnsureServicesAsync(AppDbContext db, IReadOnlyDictionary<string, Venue> venues, IReadOnlyDictionary<string, Category> categories, CancellationToken cancellationToken)
    {
        var services = new Dictionary<string, ServiceOffering>(StringComparer.OrdinalIgnoreCase);
        foreach (var seed in ServiceSeeds)
        {
            var venue = venues[seed.VenueName]; var acceptedNames = new[] { seed.Name }.Concat(seed.LegacyNames ?? []).ToArray();
            var service = await db.ServiceOfferings.FirstOrDefaultAsync(x => x.VenueId == venue.Id && acceptedNames.Contains(x.Name), cancellationToken);
            if (service is null) { service = new ServiceOffering { VenueId = venue.Id }; db.ServiceOfferings.Add(service); }
            service.CategoryId = categories[seed.CategorySlug].Id; service.Name = seed.Name; service.Description = seed.Description; service.BasePriceVnd = seed.BasePriceVnd; service.IsActive = true;
            services.Add(seed.Name, service);
        }
        await db.SaveChangesAsync(cancellationToken);
        return services;
    }

    private static async Task EnsureDemoSlotsAsync(AppDbContext db, IReadOnlyDictionary<string, ServiceOffering> services, IReadOnlyDictionary<string, BookableResource> resources, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        foreach (var seed in SlotSeeds)
        {
            var service = services[seed.ServiceName]; var resource = resources[seed.ResourceCode];
            var hasUpcomingSlot = await db.DealSlots.AnyAsync(x => x.ServiceOfferingId == service.Id && x.BookableResourceId == resource.Id && x.Status == DealSlotStatus.Published && x.StartAtUtc > now, cancellationToken);
            if (!hasUpcomingSlot) db.DealSlots.Add(CreateDemoSlot(service, resource, now.AddMinutes(seed.OffsetMinutes), seed.DurationMinutes, seed.OriginalPriceVnd, seed.DealPriceVnd, seed.Capacity));
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<ApplicationUser> EnsureUserAsync(UserManager<ApplicationUser> userManager, string email, string displayName, string password, string role)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = displayName };
            var createResult = await userManager.CreateAsync(user, password);
            if (!createResult.Succeeded) throw new InvalidOperationException($"Could not seed {email}: {string.Join(", ", createResult.Errors.Select(x => x.Description))}");
        }
        else if (user.DisplayName != displayName)
        {
            user.DisplayName = displayName;
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded) throw new InvalidOperationException($"Could not update seed user {email}: {string.Join(", ", updateResult.Errors.Select(x => x.Description))}");
        }
        if (!await userManager.IsInRoleAsync(user, role)) await userManager.AddToRoleAsync(user, role);
        return user;
    }

    private static async Task EnsureResourcesForExistingDataAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var venuesWithoutResources = await db.Venues.Where(x => !x.Resources.Any()).ToListAsync(cancellationToken);
        foreach (var venue in venuesWithoutResources) db.BookableResources.Add(new BookableResource { VenueId = venue.Id, Name = "Khu vực chung", ResourceType = "Không gian chung", Code = "DEFAULT", MaxCapacity = 100 });
        if (venuesWithoutResources.Count > 0) await db.SaveChangesAsync(cancellationToken);
        var slotsWithoutResource = await db.DealSlots.Include(x => x.ServiceOffering).Where(x => x.BookableResourceId == null).ToListAsync(cancellationToken);
        if (slotsWithoutResource.Count == 0) return;
        var defaultResources = await db.BookableResources.Where(x => x.Code == "DEFAULT").ToDictionaryAsync(x => x.VenueId, cancellationToken);
        foreach (var slot in slotsWithoutResource) if (defaultResources.TryGetValue(slot.ServiceOffering.VenueId, out var resource)) slot.BookableResourceId = resource.Id;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static DealSlot CreateDemoSlot(ServiceOffering service, BookableResource resource, DateTime startAtUtc, int durationMinutes, long originalPriceVnd, long dealPriceVnd, int capacity) => new()
    {
        ServiceOfferingId = service.Id, BookableResourceId = resource.Id, StartAtUtc = startAtUtc, EndAtUtc = startAtUtc.AddMinutes(durationMinutes),
        BookingOpensAtUtc = DateTime.UtcNow.AddMinutes(-5), BookingClosesAtUtc = startAtUtc.AddMinutes(-15), OriginalPriceVnd = originalPriceVnd,
        DealPriceVnd = dealPriceVnd, Capacity = capacity, Status = DealSlotStatus.Published, PublishedAtUtc = DateTime.UtcNow
    };
}
