using OpenSlot.Api.Contracts.Providers;

namespace OpenSlot.Tests;

public sealed class ProviderCategoryLockTests
{
    [Fact]
    public void UpsertServiceRequest_preserves_category_id()
    {
        var request = new UpsertServiceRequest
        {
            VenueId = Guid.NewGuid(),
            CategoryId = 5,
            Name = "Sân cầu lông VIP",
            BasePriceVnd = 150_000
        };

        Assert.Equal(5, request.CategoryId);
        Assert.Equal("Sân cầu lông VIP", request.Name);
    }

    [Fact]
    public void UpdateProviderProfileRequest_accepts_category_id()
    {
        var request = new UpdateProviderProfileRequest
        {
            BusinessName = "CLB Cầu Lông",
            ContactPhone = "0901234567",
            CategoryId = 2
        };

        Assert.Equal(2, request.CategoryId);
    }
}
