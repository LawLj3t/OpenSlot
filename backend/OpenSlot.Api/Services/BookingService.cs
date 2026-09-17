using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using OpenSlot.Api.Contracts.Bookings;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Realtime;
using Npgsql;

namespace OpenSlot.Api.Services;

public sealed class BookingService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    IPasswordHasher<Booking> passwordHasher,
    ILogger<BookingService> logger,
    ISlotAvailabilityNotifier availabilityNotifier) : IBookingService
{
    private const int MaxDailyActiveBookings = 3;
    private const int StrikeLockThreshold = 3;
    private static readonly TimeSpan CheckoutHoldDuration = TimeSpan.FromMinutes(10);

    public async Task<BookingConfirmationResponse> CreateAsync(
        Guid dealSlotId,
        string customerUserId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await EnsureCustomerCanStartCheckoutAsync(customerUserId, now, cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var slot = await db.DealSlots
                .Include(x => x.ServiceOffering)
                .ThenInclude(x => x.Venue)
                .ThenInclude(x => x.ProviderProfile)
                .SingleOrDefaultAsync(x => x.Id == dealSlotId, cancellationToken)
                ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);

            await ExpireHoldsForSlotAsync(slot, now, cancellationToken);
            var activeHoldCount = await CountActiveHoldsAsync(slot.Id, now, cancellationToken);
            ValidateBookable(slot, now, activeHoldCount);

            var alreadyBooked = await db.Bookings.AnyAsync(
                x => x.DealSlotId == dealSlotId && x.CustomerUserId == customerUserId,
                cancellationToken);
            if (alreadyBooked)
            {
                throw new ApiException("Bạn đã từng đặt slot này.");
            }

            var (booking, pin) = AddConfirmedBooking(slot, customerUserId, now);
            slot.ConfirmedBookingCount++;
            slot.ConcurrencyToken = Guid.NewGuid();
            UpdateSlotAvailabilityStatus(slot, slot.ConfirmedBookingCount + activeHoldCount, now);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await PublishAvailabilityAsync(slot, activeHoldCount, "booking-confirmed", CancellationToken.None);

            var providerUserId = slot.ServiceOffering?.Venue?.ProviderProfile?.UserId;
            if (!string.IsNullOrWhiteSpace(providerUserId))
            {
                await availabilityNotifier.PublishNotificationAsync(
                    providerUserId,
                    "Có booking mới",
                    $"{slot.ServiceOffering?.Name ?? "Dịch vụ"} vừa có thêm một khách đặt chỗ ({booking.PublicCode}).",
                    "/provider",
                    CancellationToken.None);
            }

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

    public async Task<SlotHoldResponse> CreateHoldAsync(
        Guid dealSlotId,
        string customerUserId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await EnsureCustomerCanUseCheckoutAsync(customerUserId, now, cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var slot = await db.DealSlots
                .Include(x => x.ServiceOffering)
                .ThenInclude(x => x.Venue)
                .ThenInclude(x => x.ProviderProfile)
                .SingleOrDefaultAsync(x => x.Id == dealSlotId, cancellationToken)
                ?? throw new ApiException("Không tìm thấy slot.", StatusCodes.Status404NotFound);

            var expiredHoldCount = await ExpireHoldsForSlotAsync(slot, now, cancellationToken);

            var existingHold = await db.SlotHolds
                .SingleOrDefaultAsync(x => x.DealSlotId == slot.Id &&
                                           x.CustomerUserId == customerUserId &&
                                           x.Status == SlotHoldStatus.Active &&
                                           x.ExpiresAtUtc > now, cancellationToken);
            var activeHoldCount = await CountActiveHoldsAsync(slot.Id, now, cancellationToken);
            if (existingHold is not null)
            {
                if (expiredHoldCount > 0)
                {
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    await PublishAvailabilityAsync(slot, activeHoldCount, "checkout-hold-expired", CancellationToken.None);
                    return ToHoldResponse(existingHold, slot, activeHoldCount);
                }
                await transaction.CommitAsync(cancellationToken);
                return ToHoldResponse(existingHold, slot, activeHoldCount);
            }

            await EnsureDailyCheckoutLimitAsync(customerUserId, now, cancellationToken);

            var alreadyBooked = await db.Bookings.AnyAsync(
                x => x.DealSlotId == slot.Id && x.CustomerUserId == customerUserId,
                cancellationToken);
            if (alreadyBooked)
            {
                throw new ApiException("Bạn đã từng đặt slot này.", StatusCodes.Status409Conflict);
            }

            ValidateBookable(slot, now, activeHoldCount);
            var expiresAtUtc = Min(now.Add(CheckoutHoldDuration), slot.BookingClosesAtUtc);
            if (expiresAtUtc <= now)
            {
                throw new ApiException("Slot đã hết thời gian thanh toán.", StatusCodes.Status409Conflict);
            }

            var hold = new SlotHold
            {
                DealSlotId = slot.Id,
                CustomerUserId = customerUserId,
                ExpiresAtUtc = expiresAtUtc
            };
            db.SlotHolds.Add(hold);
            activeHoldCount++;
            slot.ConcurrencyToken = Guid.NewGuid();
            UpdateSlotAvailabilityStatus(slot, slot.ConfirmedBookingCount + activeHoldCount, now);
            db.AuditLogs.Add(CreateAuditLog(customerUserId, "slot-hold.created", nameof(SlotHold), hold.Id.ToString(), $"slot:{slot.Id};expires:{expiresAtUtc:O}"));
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await PublishAvailabilityAsync(slot, activeHoldCount, "checkout-hold-created", CancellationToken.None);
            return ToHoldResponse(hold, slot, activeHoldCount);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ApiException("Slot vừa được người khác giữ trước. Vui lòng chọn deal khác.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ApiException("Slot vừa được người khác giữ trước. Vui lòng chọn deal khác.", StatusCodes.Status409Conflict);
        }
    }

    public async Task<BookingConfirmationResponse> ConfirmHoldAsync(
        Guid holdId,
        string customerUserId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await EnsureCustomerCanUseCheckoutAsync(customerUserId, now, cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var hold = await db.SlotHolds
                .Include(x => x.DealSlot)
                .ThenInclude(x => x.ServiceOffering)
                .ThenInclude(x => x.Venue)
                .ThenInclude(x => x.ProviderProfile)
                .SingleOrDefaultAsync(x => x.Id == holdId && x.CustomerUserId == customerUserId, cancellationToken)
                ?? throw new ApiException("Không tìm thấy phiên giữ chỗ.", StatusCodes.Status404NotFound);

            var slot = hold.DealSlot;
            if (hold.Status == SlotHoldStatus.Confirmed)
            {
                throw new ApiException("Giữ chỗ này đã được xác nhận. Hãy xem trong Lịch của tôi.", StatusCodes.Status409Conflict);
            }

            if (hold.Status != SlotHoldStatus.Active || hold.ExpiresAtUtc <= now)
            {
                if (hold.Status == SlotHoldStatus.Active)
                {
                    hold.Status = SlotHoldStatus.Expired;
                    hold.ReleasedAtUtc = now;
                    hold.ReleaseReason = "Hết thời gian thanh toán";
                    slot.ConcurrencyToken = Guid.NewGuid();
                    var activeAfterExpiration = await CountActiveHoldsAsync(slot.Id, now, cancellationToken);
                    UpdateSlotAvailabilityStatus(slot, slot.ConfirmedBookingCount + activeAfterExpiration, now);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    await PublishAvailabilityAsync(slot, activeAfterExpiration, "checkout-hold-expired", CancellationToken.None);
                }
                throw new ApiException("Thời gian giữ chỗ đã hết. Vui lòng chọn slot lại.", StatusCodes.Status409Conflict);
            }

            if (slot.Status is DealSlotStatus.Cancelled or DealSlotStatus.Expired ||
                now < slot.BookingOpensAtUtc || now >= slot.BookingClosesAtUtc)
            {
                throw new ApiException("Slot hiện không còn có thể xác nhận.", StatusCodes.Status409Conflict);
            }

            var alreadyBooked = await db.Bookings.AnyAsync(
                x => x.DealSlotId == slot.Id && x.CustomerUserId == customerUserId,
                cancellationToken);
            if (alreadyBooked)
            {
                throw new ApiException("Bạn đã từng đặt slot này.", StatusCodes.Status409Conflict);
            }

            var (booking, pin) = AddConfirmedBooking(slot, customerUserId, now);
            hold.Status = SlotHoldStatus.Confirmed;
            hold.ConfirmedAtUtc = now;
            hold.BookingId = booking.Id;
            slot.ConfirmedBookingCount++;
            slot.ConcurrencyToken = Guid.NewGuid();
            var activeHoldCount = Math.Max(0, await CountActiveHoldsAsync(slot.Id, now, cancellationToken) - 1);
            UpdateSlotAvailabilityStatus(slot, slot.ConfirmedBookingCount + activeHoldCount, now);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await PublishAvailabilityAsync(slot, activeHoldCount, "booking-confirmed", CancellationToken.None);

            var providerUserId = slot.ServiceOffering?.Venue?.ProviderProfile?.UserId;
            if (!string.IsNullOrWhiteSpace(providerUserId))
            {
                await availabilityNotifier.PublishNotificationAsync(
                    providerUserId,
                    "Có booking mới",
                    $"{slot.ServiceOffering?.Name ?? "Dịch vụ"} vừa có thêm một khách đặt chỗ ({booking.PublicCode}).",
                    "/provider",
                    CancellationToken.None);
            }

            return ToConfirmation(booking, pin, slot);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ApiException("Slot vừa được cập nhật. Vui lòng thử lại.", StatusCodes.Status409Conflict);
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ApiException("Bạn đã từng đặt slot này hoặc slot vừa hết chỗ.", StatusCodes.Status409Conflict);
        }
    }

    public async Task ReleaseHoldAsync(
        Guid holdId,
        string customerUserId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var hold = await db.SlotHolds
                .Include(x => x.DealSlot)
                .SingleOrDefaultAsync(x => x.Id == holdId && x.CustomerUserId == customerUserId, cancellationToken)
                ?? throw new ApiException("Không tìm thấy phiên giữ chỗ.", StatusCodes.Status404NotFound);

            if (hold.Status != SlotHoldStatus.Active)
            {
                await transaction.CommitAsync(cancellationToken);
                return;
            }

            hold.Status = hold.ExpiresAtUtc <= now ? SlotHoldStatus.Expired : SlotHoldStatus.Released;
            hold.ReleasedAtUtc = now;
            hold.ReleaseReason = hold.Status == SlotHoldStatus.Expired ? "Hết thời gian thanh toán" : "Khách hủy thanh toán";
            hold.DealSlot.ConcurrencyToken = Guid.NewGuid();
            var activeHoldCount = await CountActiveHoldsAsync(hold.DealSlotId, now, cancellationToken);
            if (hold.ExpiresAtUtc > now)
            {
                activeHoldCount = Math.Max(0, activeHoldCount - 1);
            }
            UpdateSlotAvailabilityStatus(hold.DealSlot, hold.DealSlot.ConfirmedBookingCount + activeHoldCount, now);
            db.AuditLogs.Add(CreateAuditLog(customerUserId, "slot-hold.released", nameof(SlotHold), hold.Id.ToString(), hold.ReleaseReason));
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await PublishAvailabilityAsync(hold.DealSlot, activeHoldCount, hold.Status == SlotHoldStatus.Expired ? "checkout-hold-expired" : "checkout-hold-released", CancellationToken.None);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ApiException("Slot vừa được cập nhật. Vui lòng thử lại.", StatusCodes.Status409Conflict);
        }
    }

    public async Task CancelAsync(Guid bookingId, string customerUserId, string? reason, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var booking = await db.Bookings
            .Include(x => x.DealSlot)
                .ThenInclude(x => x.ServiceOffering)
                    .ThenInclude(x => x.Venue)
                        .ThenInclude(x => x.ProviderProfile)
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
        var activeHoldCount = await CountActiveHoldsAsync(booking.DealSlotId, now, cancellationToken);
        UpdateSlotAvailabilityStatus(booking.DealSlot, booking.DealSlot.ConfirmedBookingCount + activeHoldCount, now);

        if (now >= booking.DealSlot.StartAtUtc.AddHours(-2))
        {
            await AddStrikeAsync(customerUserId, now, cancellationToken);
        }

        db.AuditLogs.Add(CreateAuditLog(customerUserId, "booking.cancelled", nameof(Booking), booking.Id.ToString(), null));
        db.Notifications.Add(new Notification { UserId = customerUserId, Title = "Đã hủy booking", Message = $"Booking {booking.PublicCode} đã được hủy.", Link = "/bookings" });

        var providerUserId = booking.DealSlot.ServiceOffering?.Venue?.ProviderProfile?.UserId;
        var serviceName = booking.DealSlot.ServiceOffering?.Name ?? "Dịch vụ";
        var reasonSuffix = string.IsNullOrWhiteSpace(reason) ? string.Empty : $" Lý do: {reason.Trim()}.";
        var providerTitle = "Khách đã hủy booking";
        var providerMessage = $"Khách hàng vừa hủy booking {booking.PublicCode} ({serviceName}).{reasonSuffix} Slot đã được tự động mở lại.";

        if (!string.IsNullOrWhiteSpace(providerUserId))
        {
            db.Notifications.Add(new Notification
            {
                UserId = providerUserId,
                Title = providerTitle,
                Message = providerMessage,
                Link = "/provider"
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await PublishAvailabilityAsync(booking.DealSlot, activeHoldCount, "booking-cancelled", CancellationToken.None);

        if (!string.IsNullOrWhiteSpace(providerUserId))
        {
            await availabilityNotifier.PublishNotificationAsync(
                providerUserId,
                providerTitle,
                providerMessage,
                "/provider",
                CancellationToken.None);
        }
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
        var expiredHolds = await db.SlotHolds
            .Include(x => x.DealSlot)
            .Where(x => x.Status == SlotHoldStatus.Active && x.ExpiresAtUtc <= now)
            .ToListAsync(cancellationToken);
        var availabilityChangedSlots = new Dictionary<Guid, DealSlot>();
        foreach (var group in expiredHolds.GroupBy(x => x.DealSlotId))
        {
            foreach (var hold in group)
            {
                hold.Status = SlotHoldStatus.Expired;
                hold.ReleasedAtUtc = now;
                hold.ReleaseReason = "Hết thời gian thanh toán";
            }

            var slot = group.First().DealSlot;
            slot.ConcurrencyToken = Guid.NewGuid();
            var activeHoldCount = await CountActiveHoldsAsync(slot.Id, now, cancellationToken);
            UpdateSlotAvailabilityStatus(slot, slot.ConfirmedBookingCount + activeHoldCount, now);
            availabilityChangedSlots[slot.Id] = slot;
        }

        var slotsToExpire = await db.DealSlots
            .Where(x => (x.Status == DealSlotStatus.Published || x.Status == DealSlotStatus.SoldOut) && x.EndAtUtc <= now)
            .ToListAsync(cancellationToken);

        foreach (var slot in slotsToExpire)
        {
            slot.Status = DealSlotStatus.Expired;
            slot.ConcurrencyToken = Guid.NewGuid();
            availabilityChangedSlots[slot.Id] = slot;
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

        if (slotsToExpire.Count > 0 || noShows.Count > 0 || expiredHolds.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            foreach (var slot in availabilityChangedSlots.Values)
            {
                var activeHoldCount = await CountActiveHoldsAsync(slot.Id, now, cancellationToken);
                await PublishAvailabilityAsync(slot, activeHoldCount, slot.Status == DealSlotStatus.Expired ? "slot-expired" : "checkout-hold-expired", CancellationToken.None);
            }
            logger.LogInformation("Processed {ExpiredSlotCount} expired slots, {ExpiredHoldCount} expired checkout holds and {NoShowCount} no-shows.", slotsToExpire.Count, expiredHolds.Count, noShows.Count);
        }
    }

    private static void ValidateBookable(DealSlot slot, DateTime now, int activeHoldCount)
    {
        if (slot.Status is not DealSlotStatus.Published)
        {
            throw new ApiException("Slot hiện không còn mở bán.", StatusCodes.Status409Conflict);
        }

        if (now < slot.BookingOpensAtUtc || now >= slot.BookingClosesAtUtc)
        {
            throw new ApiException("Slot không nằm trong thời gian có thể đặt.");
        }

        if (slot.ConfirmedBookingCount + activeHoldCount >= slot.Capacity)
        {
            throw new ApiException("Slot đã hết chỗ.", StatusCodes.Status409Conflict);
        }
    }

    private async Task EnsureCustomerCanStartCheckoutAsync(string customerUserId, DateTime now, CancellationToken cancellationToken)
    {
        await EnsureCustomerCanUseCheckoutAsync(customerUserId, now, cancellationToken);
        await EnsureDailyCheckoutLimitAsync(customerUserId, now, cancellationToken);
    }

    private async Task EnsureDailyCheckoutLimitAsync(string customerUserId, DateTime now, CancellationToken cancellationToken)
    {
        var (dayStart, nextDayStart) = GetVietnamDayBounds(now);
        var activeBookingCount = await db.Bookings.CountAsync(
            x => x.CustomerUserId == customerUserId &&
                 x.BookedAtUtc >= dayStart && x.BookedAtUtc < nextDayStart &&
                 (x.Status == BookingStatus.Confirmed || x.Status == BookingStatus.CheckedIn),
            cancellationToken);
        var activeHoldCount = await db.SlotHolds.CountAsync(
            x => x.CustomerUserId == customerUserId &&
                 x.CreatedAtUtc >= dayStart && x.CreatedAtUtc < nextDayStart &&
                 x.Status == SlotHoldStatus.Active && x.ExpiresAtUtc > now,
            cancellationToken);

        if (activeBookingCount + activeHoldCount >= MaxDailyActiveBookings)
        {
            throw new ApiException("Bạn đã đạt giới hạn 3 booking hoặc giữ chỗ đang hoạt động hôm nay.");
        }
    }

    private async Task EnsureCustomerCanUseCheckoutAsync(string customerUserId, DateTime now, CancellationToken cancellationToken)
    {
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
    }

    private async Task<int> CountActiveHoldsAsync(Guid dealSlotId, DateTime now, CancellationToken cancellationToken) =>
        await db.SlotHolds.CountAsync(
            x => x.DealSlotId == dealSlotId && x.Status == SlotHoldStatus.Active && x.ExpiresAtUtc > now,
            cancellationToken);

    private async Task<int> ExpireHoldsForSlotAsync(DealSlot slot, DateTime now, CancellationToken cancellationToken)
    {
        var expiredHolds = await db.SlotHolds
            .Where(x => x.DealSlotId == slot.Id && x.Status == SlotHoldStatus.Active && x.ExpiresAtUtc <= now)
            .ToListAsync(cancellationToken);
        foreach (var hold in expiredHolds)
        {
            hold.Status = SlotHoldStatus.Expired;
            hold.ReleasedAtUtc = now;
            hold.ReleaseReason = "Hết thời gian thanh toán";
        }

        if (expiredHolds.Count > 0)
        {
            slot.ConcurrencyToken = Guid.NewGuid();
            var activeHoldCount = await CountActiveHoldsAsync(slot.Id, now, cancellationToken);
            UpdateSlotAvailabilityStatus(slot, slot.ConfirmedBookingCount + activeHoldCount, now);
        }

        return expiredHolds.Count;
    }

    private (Booking Booking, string Pin) AddConfirmedBooking(DealSlot slot, string customerUserId, DateTime now)
    {
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
        return (booking, pin);
    }

    private static BookingConfirmationResponse ToConfirmation(Booking booking, string pin, DealSlot slot) =>
        new(
            booking.Id,
            booking.PublicCode,
            pin,
            $"openslot://check-in/{booking.PublicCode}",
            slot.StartAtUtc,
            slot.StartAtUtc.AddMinutes(slot.CheckInLateMinutes));

    private static SlotHoldResponse ToHoldResponse(SlotHold hold, DealSlot slot, int activeHoldCount) =>
        new(
            hold.Id,
            slot.Id,
            hold.ExpiresAtUtc,
            SlotAvailabilityPolicy.RemainingCapacity(slot.Capacity, slot.ConfirmedBookingCount, activeHoldCount),
            slot.Capacity);

    private static void UpdateSlotAvailabilityStatus(DealSlot slot, int occupiedCapacity, DateTime now)
    {
        slot.Status = SlotAvailabilityPolicy.ResolveStatus(
            slot.Status,
            slot.Capacity,
            slot.ConfirmedBookingCount,
            Math.Max(0, occupiedCapacity - slot.ConfirmedBookingCount),
            slot.BookingClosesAtUtc,
            now);
    }

    private Task PublishAvailabilityAsync(DealSlot slot, int activeHoldCount, string reason, CancellationToken cancellationToken) =>
        availabilityNotifier.PublishAsync(
            new SlotAvailabilityUpdate(
                slot.Id,
                SlotAvailabilityPolicy.RemainingCapacity(slot.Capacity, slot.ConfirmedBookingCount, activeHoldCount),
                slot.Capacity,
                slot.Status,
                reason),
            cancellationToken);

    private static (DateTime DayStart, DateTime NextDayStart) GetVietnamDayBounds(DateTime now)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, VietnamTimeZone);
        var localDayStart = DateTime.SpecifyKind(localNow.Date, DateTimeKind.Unspecified);
        return (
            TimeZoneInfo.ConvertTimeToUtc(localDayStart, VietnamTimeZone),
            TimeZoneInfo.ConvertTimeToUtc(localDayStart.AddDays(1), VietnamTimeZone));
    }

    private static DateTime Min(DateTime first, DateTime second) => first <= second ? first : second;

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
