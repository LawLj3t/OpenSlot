using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace OpenSlot.Api.Realtime;

[Authorize]
public sealed class ChatHub : Hub
{
    public async Task JoinConversation(string conversationId)
    {
        if (!string.IsNullOrWhiteSpace(conversationId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation-{conversationId}");
        }
    }

    public async Task LeaveConversation(string conversationId)
    {
        if (!string.IsNullOrWhiteSpace(conversationId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation-{conversationId}");
        }
    }
}
