namespace OpenSlot.Api.Domain;

public static class RoleNames
{
    public const string Customer = "Customer";
    public const string Provider = "Provider";
    public const string Manager = "Manager";
    public const string Admin = "Admin";
    public const string Cskh = "CSKH";

    public const string ManagerOrAdmin = Manager + "," + Admin;
    public const string CskhOrManagerOrAdmin = Cskh + "," + Manager + "," + Admin;

    public static readonly string[] All = [Customer, Provider, Manager, Admin, Cskh];
}
