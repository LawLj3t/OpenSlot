using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using OpenSlot.Api.Contracts.Bookings;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Services;

public sealed class BookingService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    IPasswordHasher<Booking> passwordHasher,
    ILogger<BookingService> logger) : IBookingService
{
    private const int MaxDailyActiveBookings = 3;
    private const int StrikeLockThreshold = 3;

    public async Task<BookingConfirmationResponse> CreateAsync(
        Guid dealSlotId,
        string customerUserId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var customer = await userManager.FindByIdAsync(customerUserId)
            ?? throw new ApiException("Không tìm thấy tài khoản.", StatusCodes.Status401Unauthorized);

        if (customer.IsSuspended)
        {
            throw new ApiException("Tài khoản hiện đang bị khóa.", StatusCodes.Status403Forbidden);
        }

        if (customer.BookingSuspendedUntilUtc is { } suspendedUntil && suspendedUntil > now)
        {
            throw new ApiException($"Tài khoản tạm thời không thể săn deal đến {suspendedUntil:O}.", StatusCodes.Status403Forbidden);
        }

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, VietnamTimeZone);
        var localDayStart = DateTime.SpecifyKind(localNow.Date, DateTimeKind.Unspecified);
        var dayStart = TimeZoneInfo.ConvertTimeToUtc(localDayStart, VietnamTimeZone);
        var nextDayStart = TimeZoneInfo.ConvertTimeToUtc(localDayStart.AddDays(1), VietnamTimeZone);
        var activeBookingCount = await db.Bookings.CountAsync(
            x => x.CustomerUserId == customerUserId &&
                 x.BookedAtUtc >= dayStart && x.BookedAtUtc < nextDayStart &&
                 (x.Status == BookingStatus.Confirmed || x.Status == BookingStatus.CheckedIn),
            cancellationToken);

        if (activeBookingCount >= MaxDailyActiveBookings)
        {
            throw new ApiException("Bạn đã đạt giới hạn 3 booking deal đang hoạt động hôm nay.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var slot = await db.DealSlots
                .Include(x => x.ServiceOffering)
                .ThenInclude(x => x.Venue)
                .ThenInclude(x => x.ProviderProfile)
                .SingleOrDefaultAsync(x => x.Id == dealSlotId, cancellationToken)
                ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);

            ValidateBookable(slot, now);

            var alreadyBooked = await db.Bookings.AnyAsync(
                x => x.DealSlotId == dealSlotId && x.CustomerUserId == customerUserId,
                cancellationToken);
            if (alreadyBooked)
            {
                throw new ApiException("Bạn đã từng đặt slot này.");
            }

            var pin = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            var booking = new Booking
            {
                DealSlotId = slot.Id,
                CustomerUserId = customerUserId,
                PublicCode = CreatePublicCode(),
                Status = BookingStatus.Confirmed,
                BookedAtUtc = now
            };
            booking.CheckInPinHash = passwordHasher.HashPassword(booking, pin);

            slot.ConfirmedBookingCount++;
            slot.ConcurrencyToken = Guid.NewGuid();
            if (slot.ConfirmedBookingCount >= slot.Capacity)
            {
                slot.Status = DealSlotStatus.SoldOut;
            }

            db.Bookings.Add(booking);
            db.Notifications.Add(new Notification
            {
                UserId = customerUserId,
                Title = "Giữ chỗ thành công",
                Message = $"Booking {booking.PublicCode} đã được xác nhận tại {slot.ServiceOffering.Venue.Name}.",
                Link = "/bookings"
            });
            db.Notifications.Add(new Notification
            {
                UserId = slot.ServiceOffering.Venue.ProviderProfile.UserId,
                Title = "Có booking mới",
                Message = $"{slot.ServiceOffering.Name} vừa có thêm một khách đặt chỗ.",
                Link = "/provider"
            });
            db.AuditLogs.Add(CreateAuditLog(customerUserId, "booking.created", nameof(Booking), booking.Id.ToString(), $"slot:{slot.Id}"));
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new BookingConfirmationResponse(
                booking.Id,
                booking.PublicCode,
                pin,
                $"openslot://check-in/{booking.PublicCode}",
                slot.StartAtUtc,
                slot.StartAtUtc.AddMinutes(slot.CheckInLateMinutes));
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ApiException("Slot vừa được người khác đặt trước. Vui lòng chọn deal khác.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ApiException("Bạn đã từng đặt slot này hoặc slot vừa hết chỗ.", StatusCodes.Status409Conflict);
        }
    }

    public async Task CancelAsync(Guid bookingId, string customerUserId, string? reason, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var booking = await db.Bookings
            .Include(x => x.DealSlot)
            .SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerUserId == customerUserId, cancellationToken)
            ?? throw new ApiException("Không tìm thấy booking.", StatusCodes.Status404NotFound);

        if (booking.Status != BookingStatus.Confirmed)
        {
            throw new ApiException("Booking hiện không thể hủy.");
        }

        if (now >= booking.DealSlot.StartAtUtc)
        {
            throw new ApiException("Không thể hủy sau khi dịch vụ đã bắt đầu.");
        }

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAtUtc = now;
        booking.CancellationReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        booking.DealSlot.ConfirmedBookingCount = Math.Max(0, booking.DealSlot.ConfirmedBookingCount - 1);
        booking.DealSlot.ConcurrencyToken = Guid.NewGuid();

        if (booking.DealSlot.Status == DealSlotStatus.SoldOut && now < booking.DealSlot.BookingClosesAtUtc)
        {
            booking.DealSlot.Status = DealSlotStatus.Published;
        }

        if (now >= booking.DealSlot.StartAtUtc.AddHours(-2))
        {
            await AddStrikeAsync(customerUserId, now, cancellationToken);
        }

        db.AuditLogs.Add(CreateAuditLog(customerUserId, "booking.cancelled", nameof(Booking), booking.Id.ToString(), null));
        db.Notifications.Add(new Notification { UserId = customerUserId, Title = "Đã hủy booking", Message = $"Booking {booking.PublicCode} đã được hủy.", Link = "/bookings" });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task CheckInAsync(string providerUserId, CheckInRequest request, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var booking = await db.Bookings
            .Include(x => x.DealSlot)
            .ThenInclude(x => x.ServiceOffering)
            .ThenInclude(x => x.Venue)
            .ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.PublicCode == request.PublicCode.Trim().ToUpperInvariant(), cancellationToken)
            ?? throw new ApiException("Không tìm thấy mã booking.", StatusCodes.Status404NotFound);

        if (booking.DealSlot.ServiceOffering.Venue.ProviderProfile.UserId != providerUserId)
        {
            throw new ApiException("Bạn không có quyền check-in booking này.", StatusCodes.Status403Forbidden);
        }

        if (booking.Status != BookingStatus.Confirmed)
        {
            throw new ApiException("Booking không ở trạng thái có thể check-in.");
        }

        var earliest = booking.DealSlot.StartAtUtc.AddMinutes(-booking.DealSlot.CheckInEarlyMinutes);
        var latest = booking.DealSlot.StartAtUtc.AddMinutes(booking.DealSlot.CheckInLateMinutes);
        if (now < earliest || now > latest)
        {
            throw new ApiException("Booking nằm ngoài thời gian check-in cho phép.");
        }

        var verification = passwordHasher.VerifyHashedPassword(booking, booking.CheckInPinHash, request.Pin.Trim());
        if (verification == PasswordVerificationResult.Failed)
        {
            throw new ApiException("PIN check-in không đúng.");
        }

        booking.Status = BookingStatus.CheckedIn;
        booking.CheckedInAtUtc = now;
        db.Notifications.Add(new Notification { UserId = booking.CustomerUserId, Title = "Check-in thành công", Message = $"Booking {booking.PublicCode} đã check-in.", Link = "/bookings" });
        db.AuditLogs.Add(CreateAuditLog(providerUserId, "booking.checked-in", nameof(Booking), booking.Id.ToString(), null));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task CompleteAsync(string providerUserId, string publicCode, CancellationToken cancellationToken = default)
    {
        var booking = await db.Bookings
            .Include(x => x.DealSlot).ThenInclude(x => x.ServiceOffering).ThenInclude(x => x.Venue).ThenInclude(x => x.ProviderProfile)
            .SingleOrDefaultAsync(x => x.PublicCode == publicCode.Trim().ToUpperInvariant(), cancellationToken)
            ?? throw new ApiException("Không tìm thấy mã booking.", StatusCodes.Status404NotFound);
        if (booking.DealSlot.ServiceOffering.Venue.ProviderProfile.UserId != providerUserId)
        {
            throw new ApiException("Bạn không có quyền hoàn tất booking này.", StatusCodes.Status403Forbidden);
        }
        if (booking.Status != BookingStatus.CheckedIn)
        {
            throw new ApiException("Chỉ booking đã check-in mới có thể hoàn tất.");
        }
        booking.Status = BookingStatus.Completed;
        booking.CompletedAtUtc = DateTime.UtcNow;
        db.Notifications.Add(new Notification { UserId = booking.CustomerUserId, Title = "Dịch vụ đã hoàn tất", Message = $"Cảm ơn bạn đã sử dụng {booking.DealSlot.ServiceOffering.Name}.", Link = "/bookings" });
        db.AuditLogs.Add(CreateAuditLog(providerUserId, "booking.completed", nameof(Booking), booking.Id.ToString(), null));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task ProcessExpirationsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var slotsToExpire = await db.DealSlots
            .Where(x => (x.Status == DealSlotStatus.Published || x.Status == DealSlotStatus.SoldOut) && x.EndAtUtc <= now)
            .ToListAsync(cancellationToken);

        foreach (var slot in slotsToExpire)
        {
            slot.Status = DealSlotStatus.Expired;
            slot.ConcurrencyToken = Guid.NewGuid();
        }

        var noShows = await db.Bookings
            .Include(x => x.DealSlot)
            .Where(x => x.Status == BookingStatus.Confirmed &&
                        x.DealSlot.StartAtUtc.AddMinutes(x.DealSlot.CheckInLateMinutes) < now)
            .ToListAsync(cancellationToken);

        foreach (var booking in noShows)
        {
            booking.Status = BookingStatus.NoShow;
            await AddStrikeAsync(booking.CustomerUserId, now, cancellationToken);
            db.AuditLogs.Add(CreateAuditLog(booking.CustomerUserId, "booking.no-show", nameof(Booking), booking.Id.ToString(), null));
        }

        if (slotsToExpire.Count > 0 || noShows.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Processed {ExpiredSlotCount} expired slots and {NoShowCount} no-shows.", slotsToExpire.Count, noShows.Count);
        }
    }

    private static void ValidateBookable(DealSlot slot, DateTime now)
    {
        if (slot.Status is not DealSlotStatus.Published)
        {
            throw new ApiException("Slot hiện không còn mở bán.", StatusCodes.Status409Conflict);
        }

        if (now < slot.BookingOpensAtUtc || now >= slot.BookingClosesAtUtc)
        {
            throw new ApiException("Slot không nằm trong thời gian có thể đặt.");
        }

        if (slot.ConfirmedBookingCount >= slot.Capacity)
        {
            throw new ApiException("Slot đã hết chỗ.", StatusCodes.Status409Conflict);
        }
    }

    private async Task AddStrikeAsync(string userId, DateTime now, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return;
        }

        if (user.StrikeWindowStartedAtUtc is null || user.StrikeWindowStartedAtUtc < now.AddDays(-30))
        {
            user.StrikeCount = 0;
            user.StrikeWindowStartedAtUtc = now;
        }

        user.StrikeCount++;
        if (user.StrikeCount >= StrikeLockThreshold)
        {
            user.BookingSuspendedUntilUtc = now.AddDays(7);
            user.StrikeCount = 0;
            user.StrikeWindowStartedAtUtc = now;
        }

        await userManager.UpdateAsync(user);
    }

    private static string CreatePublicCode() => $"OS-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";

    private static AuditLog CreateAuditLog(string? actorUserId, string action, string entityType, string entityId, string? metadata) =>
        new()
        {
            ActorUserId = actorUserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Metadata = metadata
        };

    private static bool IsUniqueConstraintViolation(DbUpdateException exception) =>
        exception.InnerException?.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase) == true;

    private static readonly TimeZoneInfo VietnamTimeZone = FindVietnamTimeZone();

    private static TimeZoneInfo FindVietnamTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
    }
}
