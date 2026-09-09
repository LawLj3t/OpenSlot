using OpenSlot.Api.Contracts.Slots;

namespace OpenSlot.Api.Services;

public static class SlotPolicy
{
    public static string? Validate(CreateDealSlotRequest request, DateTime? nowUtc = null)
    {
        if (request.Capacity is < 1 or > 100)
        {
            return "Số chỗ phải nằm trong khoảng 1 đến 100.";
        }

        if (request.OriginalPriceVnd <= 0 || request.DealPriceVnd <= 0)
        {
            return "Giá phải lớn hơn 0.";
        }

        if (request.DealPriceVnd >= request.OriginalPriceVnd)
        {
            return "Giá deal phải thấp hơn giá gốc.";
        }

        if (request.EndAtUtc <= request.StartAtUtc)
        {
            return "Thời gian kết thúc phải sau thời gian bắt đầu.";
        }

        if (nowUtc.HasValue && (request.StartAtUtc <= nowUtc.Value.AddMinutes(15) || request.BookingClosesAtUtc <= nowUtc.Value))
        {
            return "Slot phải bắt đầu sau hiện tại ít nhất 15 phút và thời gian đóng booking phải ở tương lai.";
        }

        if (request.BookingOpensAtUtc >= request.BookingClosesAtUtc || request.BookingClosesAtUtc > request.StartAtUtc.AddMinutes(-15))
        {
            return "Booking phải đóng ít nhất 15 phút trước giờ bắt đầu.";
        }

        return null;
    }
}
