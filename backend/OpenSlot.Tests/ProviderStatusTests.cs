using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Tests;

public sealed class ProviderStatusTests
{
    [Fact]
    public void ProviderStatus_includes_deleted_state_as_value_four()
    {
        Assert.Equal(4, (int)ProviderStatus.Deleted);
        Assert.Equal(ProviderStatus.Deleted, (ProviderStatus)4);
    }
}
