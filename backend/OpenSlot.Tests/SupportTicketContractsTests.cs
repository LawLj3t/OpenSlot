using OpenSlot.Api.Contracts.Support;

namespace OpenSlot.Tests;

public sealed class SupportTicketContractsTests
{
    [Fact]
    public void CreateSupportTicketRequest_initializes_properly()
    {
        var request = new CreateSupportTicketRequest
        {
            UserRole = "Buyer",
            Category = "Đặt chỗ & Giữ chỗ",
            SenderEmail = "user@gmail.com",
            Content = "Tôi gặp lỗi khi giữ chỗ cho slot bóng đá chiều nay.",
            AttachmentFileName = "bien-lai.png",
            AttachmentData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        };

        Assert.Equal("Buyer", request.UserRole);
        Assert.Equal("Đặt chỗ & Giữ chỗ", request.Category);
        Assert.Equal("user@gmail.com", request.SenderEmail);
        Assert.StartsWith("Tôi gặp lỗi", request.Content);
        Assert.Equal("bien-lai.png", request.AttachmentFileName);
        Assert.NotNull(request.AttachmentData);
    }

    [Fact]
    public void ResolveSupportTicketRequest_initializes_properly()
    {
        var request = new ResolveSupportTicketRequest
        {
            ResolutionNote = "Đã kiểm tra và hoàn lại strike cho tài khoản của bạn.",
            Status = 2
        };

        Assert.Equal(2, request.Status);
        Assert.Contains("hoàn lại strike", request.ResolutionNote);
    }
}
