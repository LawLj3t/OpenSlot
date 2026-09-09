using OpenSlot.Api.Contracts.Auth;
using OpenSlot.Api.Domain.Entities;

namespace OpenSlot.Api.Services;

public interface IJwtTokenService
{
    Task<AuthResponse> CreateAsync(ApplicationUser user, CancellationToken cancellationToken = default);
}
