using System.ComponentModel.DataAnnotations;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Contracts.Admin;

public sealed class BulkIdsRequest<T>
{
    [Required]
    public List<T> Ids { get; init; } = [];
}

public sealed class BulkStatusRequest
{
    [Required]
    public List<Guid> Ids { get; init; } = [];

    [Required]
    public ProviderStatus Status { get; init; }
}

public sealed class BulkActiveRequest
{
    [Required]
    public List<Guid> Ids { get; init; } = [];

    public bool IsActive { get; init; }
}

public sealed class BulkUserSuspendRequest
{
    [Required]
    public List<string> Ids { get; init; } = [];

    public bool IsSuspended { get; init; }
}

public sealed class BulkResolveReportsRequest
{
    [Required]
    public List<Guid> Ids { get; init; } = [];

    public string? ResolutionNote { get; init; }
}
