using System.ComponentModel.DataAnnotations;

namespace OpenSlot.Api.Contracts.Admin;

public sealed class CreateCategoryRequest
{
    [Required, MinLength(2), MaxLength(80)]
    public string Name { get; init; } = string.Empty;

    [Required, MinLength(2), MaxLength(60)]
    public string IconName { get; init; } = "tag";
}

public sealed class UpdateCategoryRequest
{
    [Required, MinLength(2), MaxLength(80)]
    public string Name { get; init; } = string.Empty;

    [Required, MinLength(2), MaxLength(60)]
    public string IconName { get; init; } = "tag";
}
