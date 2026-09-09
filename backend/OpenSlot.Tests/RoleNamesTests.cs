using OpenSlot.Api.Domain;

namespace OpenSlot.Tests;

public sealed class RoleNamesTests
{
    [Fact]
    public void All_roles_include_manager_and_operational_policy()
    {
        Assert.Contains(RoleNames.Manager, RoleNames.All);
        Assert.Equal("Manager,Admin", RoleNames.ManagerOrAdmin);
    }
}
