using OpenSlot.Api.Contracts.Chat;
using OpenSlot.Api.Contracts.Slots;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Tests;

public sealed class ChatContractsTests
{
    [Fact]
    public void CreateConversationRequest_can_be_initialized()
    {
        var providerId = Guid.NewGuid();
        var request = new CreateConversationRequest
        {
            ProviderId = providerId,
            Topic = "Tư vấn ưu đãi",
            InitialMessage = "Xin chào, còn chỗ không?"
        };

        Assert.Equal(providerId, request.ProviderId);
        Assert.Equal("Tư vấn ưu đãi", request.Topic);
        Assert.Equal("Xin chào, còn chỗ không?", request.InitialMessage);
    }

    [Fact]
    public void SendChatMessageRequest_can_be_initialized()
    {
        var request = new SendChatMessageRequest
        {
            Content = "Tôi muốn đặt 2 vé."
        };

        Assert.Equal("Tôi muốn đặt 2 vé.", request.Content);
    }

    [Fact]
    public void DealSlotDetails_exposes_provider_metadata()
    {
        var providerId = Guid.NewGuid();
        var details = new DealSlotDetails(
            Guid.NewGuid(),
            "Sân cầu lông A",
            "Mô tả sân",
            null,
            "Thể thao",
            "sports",
            "Nhà thi đấu X",
            "Sân 1",
            "S1",
            "Tầng 1",
            "123 Cầu Giấy",
            "Cầu Giấy",
            "Hà Nội",
            21.03,
            105.78,
            DateTime.UtcNow,
            DateTime.UtcNow.AddHours(1),
            DateTime.UtcNow,
            DateTime.UtcNow.AddMinutes(45),
            100_000,
            60_000,
            4,
            4,
            DealSlotStatus.Published,
            providerId,
            "CLB Cầu Lông Hà Nội");

        Assert.Equal(providerId, details.ProviderId);
        Assert.Equal("CLB Cầu Lông Hà Nội", details.ProviderBusinessName);
    }
}
