namespace OpenSlot.Api.Domain.Entities;

public sealed class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<ServiceOffering> ServiceOfferings { get; set; } = new List<ServiceOffering>();
}
