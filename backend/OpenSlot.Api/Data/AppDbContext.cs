using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Domain.Entities;

namespace OpenSlot.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<ProviderProfile> ProviderProfiles => Set<ProviderProfile>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Venue> Venues => Set<Venue>();
    public DbSet<ServiceOffering> ServiceOfferings => Set<ServiceOffering>();
    public DbSet<DealSlot> DealSlots => Set<DealSlot>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(100).IsRequired();
            entity.HasOne(x => x.ProviderProfile)
                .WithOne(x => x.User)
                .HasForeignKey<ProviderProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProviderProfile>(entity =>
        {
            entity.Property(x => x.BusinessName).HasMaxLength(160).IsRequired();
            entity.Property(x => x.ContactPhone).HasMaxLength(30).IsRequired();
            entity.HasIndex(x => x.UserId).IsUnique();
        });

        builder.Entity<Category>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(80).IsRequired();
            entity.Property(x => x.IconName).HasMaxLength(60).IsRequired();
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        builder.Entity<Venue>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.AddressLine).HasMaxLength(255).IsRequired();
            entity.Property(x => x.District).HasMaxLength(100).IsRequired();
            entity.Property(x => x.City).HasMaxLength(100).IsRequired();
            entity.HasIndex(x => new { x.City, x.District });
        });

        builder.Entity<ServiceOffering>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.ImageUrl).HasMaxLength(500);
            entity.HasIndex(x => new { x.VenueId, x.CategoryId, x.IsActive });
        });

        builder.Entity<DealSlot>(entity =>
        {
            entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            entity.HasIndex(x => new { x.Status, x.StartAtUtc });
            entity.HasIndex(x => new { x.ServiceOfferingId, x.StartAtUtc });
        });

        builder.Entity<Booking>(entity =>
        {
            entity.Property(x => x.PublicCode).HasMaxLength(20).IsRequired();
            entity.Property(x => x.CheckInPinHash).HasMaxLength(500).IsRequired();
            entity.HasIndex(x => x.PublicCode).IsUnique();
            entity.HasIndex(x => new { x.DealSlotId, x.CustomerUserId }).IsUnique();
            entity.HasIndex(x => new { x.CustomerUserId, x.Status, x.BookedAtUtc });
        });

        builder.Entity<Notification>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Link).HasMaxLength(500);
            entity.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAtUtc });
        });

        builder.Entity<Report>(entity =>
        {
            entity.Property(x => x.TargetType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.TargetId).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
            entity.HasIndex(x => new { x.Status, x.CreatedAtUtc });
        });

        builder.Entity<AuditLog>(entity =>
        {
            entity.Property(x => x.Action).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityId).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Metadata).HasMaxLength(2000);
            entity.HasIndex(x => new { x.EntityType, x.EntityId, x.CreatedAtUtc });
        });
    }
}
