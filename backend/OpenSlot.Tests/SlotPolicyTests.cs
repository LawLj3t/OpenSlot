using OpenSlot.Api.Contracts.Slots;
using OpenSlot.Api.Services;

namespace OpenSlot.Tests;

public sealed class SlotPolicyTests
{
    [Fact]
    public void Valid_slot_returns_no_error()
    {
        Assert.Null(SlotPolicy.Validate(ValidRequest()));
    }

    [Fact]
    public void Deal_price_must_be_lower_than_original_price()
    {
        var request = ValidRequest(dealPriceVnd: 100_000);
        Assert.Equal("Giá deal phải thấp hơn giá gốc.", SlotPolicy.Validate(request));
    }

    [Fact]
    public void Booking_must_close_at_least_15_minutes_before_start()
    {
        var request = ValidRequest(closeMinutesBeforeStart: 10);
        Assert.Equal("Booking phải đóng ít nhất 15 phút trước giờ bắt đầu.", SlotPolicy.Validate(request));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Capacity_must_stay_in_supported_range(int capacity)
    {
        var request = ValidRequest(capacity: capacity);
        Assert.Equal("Số chỗ phải nằm trong khoảng 1 đến 100.", SlotPolicy.Validate(request));
    }

    [Fact]
    public void Prices_must_be_positive()
    {
        Assert.Equal("Giá phải lớn hơn 0.", SlotPolicy.Validate(ValidRequest(dealPriceVnd: 0)));
    }

    [Fact]
    public void End_time_must_be_after_start_time()
    {
        var start = DateTime.UtcNow.AddHours(2);
        var request = new CreateDealSlotRequest
        {
            ServiceOfferingId = Guid.NewGuid(), StartAtUtc = start, EndAtUtc = start,
            BookingOpensAtUtc = DateTime.UtcNow, BookingClosesAtUtc = start.AddMinutes(-15),
            OriginalPriceVnd = 100_000, DealPriceVnd = 70_000, Capacity = 2
        };
        Assert.Equal("Thời gian kết thúc phải sau thời gian bắt đầu.", SlotPolicy.Validate(request));
    }

    [Fact]
    public void New_slot_must_have_future_booking_window()
    {
        var now = DateTime.UtcNow;
        Assert.Equal("Slot phải bắt đầu sau hiện tại ít nhất 15 phút và thời gian đóng booking phải ở tương lai.", SlotPolicy.Validate(ValidRequest(closeMinutesBeforeStart: 130), now));
    }

    private static CreateDealSlotRequest ValidRequest(long dealPriceVnd = 70_000, int capacity = 2, int closeMinutesBeforeStart = 15)
    {
        var start = DateTime.UtcNow.AddHours(2);
        return new CreateDealSlotRequest
        {
            ServiceOfferingId = Guid.NewGuid(),
            StartAtUtc = start,
            EndAtUtc = start.AddHours(1),
            BookingOpensAtUtc = DateTime.UtcNow,
            BookingClosesAtUtc = start.AddMinutes(-closeMinutesBeforeStart),
            OriginalPriceVnd = 100_000,
            DealPriceVnd = dealPriceVnd,
            Capacity = capacity
        };
    }
}
