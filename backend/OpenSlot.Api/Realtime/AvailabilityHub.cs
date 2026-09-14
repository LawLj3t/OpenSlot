using Microsoft.AspNetCore.SignalR;

namespace OpenSlot.Api.Realtime;

/// <summary>
/// Public availability updates. The data is intentionally limited to slot capacity,
/// so customers do not receive information about who is holding a slot.
/// </summary>
public sealed class AvailabilityHub : Hub;
