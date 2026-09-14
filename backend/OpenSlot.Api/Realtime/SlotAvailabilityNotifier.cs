using Microsoft.AspNetCore.SignalR;
using OpenSlot.Api.Domain.Enums;

namespace OpenSlot.Api.Realtime;

public sealed record SlotAvailabilityUpdate(
    Guid SlotId,
    int RemainingCapacity,
    int Capacity,
    DealSlotStatus Status,
    string Reason);

public interface ISlotAvailabilityNotifier
{
    Task PublishAsync(SlotAvailabilityUpdate update, CancellationToken cancellationToken = default);
}

public sealed class SlotAvailabilityNotifier(IHubContext<AvailabilityHub> hub) : ISlotAvailabilityNotifier
{
    public Task PublishAsync(SlotAvailabilityUpdate update, CancellationToken cancellationToken = default) =>
        hub.Clients.All.SendAsync("slotAvailabilityChanged", update, cancellationToken);
}
