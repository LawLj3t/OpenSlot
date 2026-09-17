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
    public DbSet<BookableResource> BookableResources => Set<BookableResource>();
    public DbSet<ServiceOffering> ServiceOfferings => Set<ServiceOffering>();
    public DbSet<DealSlot> DealSlots => Set<DealSlot>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<SlotHold> SlotHolds => Set<SlotHold>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ChatConversation> ChatConversations => Set<ChatConversation>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();

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
            entity.HasOne(x => x.Category)
                .WithMany()
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
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

        builder.Entity<BookableResource>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ResourceType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(60);
            entity.Property(x => x.FloorOrZone).HasMaxLength(100);
            entity.Property(x => x.PositionDescription).HasMaxLength(255);
            entity.HasIndex(x => new { x.VenueId, x.IsActive });
            entity.HasIndex(x => new { x.VenueId, x.Code }).IsUnique();
        });

        builder.Entity<DealSlot>(entity =>
        {
            entity.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            entity.HasIndex(x => new { x.Status, x.StartAtUtc });
            entity.HasIndex(x => new { x.ServiceOfferingId, x.StartAtUtc });
            entity.HasIndex(x => new { x.BookableResourceId, x.StartAtUtc });
        });

        builder.Entity<Booking>(entity =>
        {
            entity.Property(x => x.PublicCode).HasMaxLength(20).IsRequired();
            entity.Property(x => x.CheckInPinHash).HasMaxLength(500).IsRequired();
            entity.HasIndex(x => x.PublicCode).IsUnique();
            entity.HasIndex(x => new { x.DealSlotId, x.CustomerUserId }).IsUnique();
            entity.HasIndex(x => new { x.CustomerUserId, x.Status, x.BookedAtUtc });
        });

        builder.Entity<SlotHold>(entity =>
        {
            entity.Property(x => x.ReleaseReason).HasMaxLength(200);
            entity.HasIndex(x => new { x.DealSlotId, x.Status, x.ExpiresAtUtc });
            entity.HasIndex(x => new { x.CustomerUserId, x.DealSlotId, x.Status });
            entity.HasOne(x => x.DealSlot)
                .WithMany(x => x.Holds)
                .HasForeignKey(x => x.DealSlotId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(x => x.CustomerUserId)
                .OnDelete(DeleteBehavior.Cascade);
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

        builder.Entity<ChatConversation>(entity =>
        {
            entity.Property(x => x.CustomerName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ProviderBusinessName).HasMaxLength(160);
            entity.Property(x => x.Topic).HasMaxLength(200).IsRequired();
            entity.Property(x => x.LastMessageText).HasMaxLength(2000);
            entity.HasIndex(x => x.CustomerId);
            entity.HasIndex(x => x.ProviderId);
            entity.HasIndex(x => x.LastMessageAtUtc);
            entity.HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Provider)
                .WithMany()
                .HasForeignKey(x => x.ProviderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<ChatMessage>(entity =>
        {
            entity.Property(x => x.SenderName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.SenderRole).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(2000).IsRequired();
            entity.HasIndex(x => new { x.ConversationId, x.SentAtUtc });
            entity.HasIndex(x => x.SenderUserId);
            entity.HasOne(x => x.Conversation)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.SenderUser)
                .WithMany()
                .HasForeignKey(x => x.SenderUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<SupportTicket>(entity =>
        {
            entity.Property(x => x.UserRole).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(120).IsRequired();
            entity.Property(x => x.SenderEmail).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.AttachmentFileName).HasMaxLength(260);
            entity.Property(x => x.AttachmentData);
            entity.Property(x => x.ResolutionNote).HasMaxLength(4000);
            entity.Property(x => x.ResolvedByName).HasMaxLength(120);
            entity.HasIndex(x => x.Status);
            entity.HasIndex(x => x.CreatedAtUtc);
            entity.HasIndex(x => x.SenderEmail);
            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.ResolvedByUser)
                .WithMany()
                .HasForeignKey(x => x.ResolvedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
