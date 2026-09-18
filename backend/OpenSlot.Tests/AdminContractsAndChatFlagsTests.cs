using OpenSlot.Api.Contracts.Admin;
using OpenSlot.Api.Domain.Entities;

namespace OpenSlot.Tests;

public sealed class AdminContractsAndChatFlagsTests
{
    [Fact]
    public void ChatConversation_has_soft_delete_flags_defaulting_to_false()
    {
        var conversation = new ChatConversation
        {
            CustomerId = "cust-1",
            CustomerName = "Customer Test",
            Topic = "Support"
        };

        Assert.False(conversation.IsDeletedByCustomer);
        Assert.False(conversation.IsDeletedByProvider);
    }

    [Fact]
    public void BulkIdsRequest_with_string_and_guid_works()
    {
        var stringIds = new BulkIdsRequest<string>
        {
            Ids = ["user1", "user2"]
        };
        Assert.Equal(2, stringIds.Ids.Count);

        var guidId = Guid.NewGuid();
        var guidIds = new BulkIdsRequest<Guid>
        {
            Ids = [guidId]
        };
        Assert.Single(guidIds.Ids);
        Assert.Equal(guidId, guidIds.Ids[0]);
    }
}
