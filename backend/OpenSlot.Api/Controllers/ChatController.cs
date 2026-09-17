using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Chat;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Realtime;

namespace OpenSlot.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/chat")]
public sealed class ChatController(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    IHubContext<ChatHub> hubContext) : ControllerBase
{
    [HttpGet("conversations")]
    public async Task<ActionResult<IReadOnlyList<ConversationDto>>> GetConversations(CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(User)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        var roles = await userManager.GetRolesAsync(user);
        var isStaff = roles.Contains(RoleNames.Admin) || roles.Contains(RoleNames.Manager);

        var providerProfile = await db.ProviderProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == user.Id, cancellationToken);

        IQueryable<ChatConversation> query = db.ChatConversations.AsNoTracking();

        if (isStaff)
        {
            // Staff can see all conversations
        }
        else if (providerProfile is not null)
        {
            // Provider sees conversations for their shop OR where they are customer
            query = query.Where(x => x.ProviderId == providerProfile.Id || x.CustomerId == user.Id);
        }
        else
        {
            // Customer only sees their conversations
            query = query.Where(x => x.CustomerId == user.Id);
        }

        var conversations = await query
            .OrderByDescending(x => x.LastMessageAtUtc)
            .Select(x => new
            {
                x.Id,
                x.CustomerId,
                x.CustomerName,
                x.ProviderId,
                x.ProviderBusinessName,
                x.Topic,
                x.LastMessageText,
                x.LastMessageAtUtc,
                x.CreatedAtUtc,
                x.IsClosed,
                UnreadCount = x.Messages.Count(m => m.SenderUserId != user.Id && !m.IsRead)
            })
            .ToListAsync(cancellationToken);

        var result = conversations.Select(x => new ConversationDto(
            x.Id,
            x.CustomerId,
            x.CustomerName,
            x.ProviderId,
            x.ProviderBusinessName,
            x.Topic,
            x.LastMessageText,
            x.LastMessageAtUtc,
            x.CreatedAtUtc,
            x.IsClosed,
            x.UnreadCount
        )).ToList();

        return Ok(result);
    }

    [HttpPost("conversations")]
    public async Task<ActionResult<ConversationDetailDto>> CreateConversation(
        CreateConversationRequest request,
        CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(User)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        var roles = await userManager.GetRolesAsync(user);

        string? providerBusinessName = null;
        Guid? providerId = request.ProviderId;

        if (providerId.HasValue)
        {
            var provider = await db.ProviderProfiles.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == providerId.Value, cancellationToken)
                ?? throw new ApiException("Không tìm thấy đối tác.", StatusCodes.Status404NotFound);
            providerBusinessName = provider.BusinessName;
        }
        else
        {
            providerBusinessName = "CSKH OpenSlot";
        }

        // Check if an open conversation already exists between this customer and provider/CSKH
        var existingConversation = await db.ChatConversations
            .Include(x => x.Messages)
            .FirstOrDefaultAsync(x =>
                x.CustomerId == user.Id &&
                x.ProviderId == providerId &&
                !x.IsClosed,
                cancellationToken);

        var conversation = existingConversation;
        var isNew = false;

        if (conversation is null)
        {
            isNew = true;
            conversation = new ChatConversation
            {
                CustomerId = user.Id,
                CustomerName = user.DisplayName,
                ProviderId = providerId,
                ProviderBusinessName = providerBusinessName,
                Topic = request.Topic.Trim(),
                LastMessageText = request.InitialMessage.Trim(),
                LastMessageAtUtc = DateTime.UtcNow,
                CreatedAtUtc = DateTime.UtcNow
            };
            db.ChatConversations.Add(conversation);
        }
        else
        {
            conversation.LastMessageText = request.InitialMessage.Trim();
            conversation.LastMessageAtUtc = DateTime.UtcNow;
        }

        var senderRole = DetermineSenderRole(user, roles, providerId);
        var senderName = DetermineSenderName(user, senderRole, providerBusinessName);

        var message = new ChatMessage
        {
            ConversationId = conversation.Id,
            SenderUserId = user.Id,
            SenderName = senderName,
            SenderRole = senderRole,
            Content = request.InitialMessage.Trim(),
            SentAtUtc = DateTime.UtcNow,
            IsRead = false
        };
        db.ChatMessages.Add(message);

        await db.SaveChangesAsync(cancellationToken);

        var messageDto = new ChatMessageDto(
            message.Id,
            message.ConversationId,
            message.SenderUserId,
            message.SenderName,
            message.SenderRole,
            message.Content,
            message.SentAtUtc,
            message.IsRead
        );

        var conversationDto = new ConversationDto(
            conversation.Id,
            conversation.CustomerId,
            conversation.CustomerName,
            conversation.ProviderId,
            conversation.ProviderBusinessName,
            conversation.Topic,
            conversation.LastMessageText,
            conversation.LastMessageAtUtc,
            conversation.CreatedAtUtc,
            conversation.IsClosed,
            0
        );

        await hubContext.Clients.Group($"conversation-{conversation.Id}").SendAsync("ReceiveMessage", messageDto, cancellationToken);
        await hubContext.Clients.All.SendAsync("ConversationUpdated", conversationDto, cancellationToken);

        var messages = isNew
            ? [messageDto]
            : await db.ChatMessages.AsNoTracking()
                .Where(m => m.ConversationId == conversation.Id)
                .OrderBy(m => m.SentAtUtc)
                .Select(m => new ChatMessageDto(m.Id, m.ConversationId, m.SenderUserId, m.SenderName, m.SenderRole, m.Content, m.SentAtUtc, m.IsRead))
                .ToListAsync(cancellationToken);

        return Ok(new ConversationDetailDto(conversationDto, messages));
    }

    [HttpGet("conversations/{id:guid}")]
    public async Task<ActionResult<ConversationDetailDto>> GetConversation(Guid id, CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(User)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        var roles = await userManager.GetRolesAsync(user);

        var conversation = await db.ChatConversations
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy cuộc trò chuyện.", StatusCodes.Status404NotFound);

        await EnsureCanAccessConversation(conversation, user.Id, roles, cancellationToken);

        var messages = await db.ChatMessages
            .AsNoTracking()
            .Where(x => x.ConversationId == id)
            .OrderBy(x => x.SentAtUtc)
            .Select(x => new ChatMessageDto(
                x.Id,
                x.ConversationId,
                x.SenderUserId,
                x.SenderName,
                x.SenderRole,
                x.Content,
                x.SentAtUtc,
                x.IsRead
            ))
            .ToListAsync(cancellationToken);

        var unreadCount = messages.Count(x => x.SenderUserId != user.Id && !x.IsRead);

        var conversationDto = new ConversationDto(
            conversation.Id,
            conversation.CustomerId,
            conversation.CustomerName,
            conversation.ProviderId,
            conversation.ProviderBusinessName,
            conversation.Topic,
            conversation.LastMessageText,
            conversation.LastMessageAtUtc,
            conversation.CreatedAtUtc,
            conversation.IsClosed,
            unreadCount
        );

        return Ok(new ConversationDetailDto(conversationDto, messages));
    }

    [HttpPost("conversations/{id:guid}/messages")]
    public async Task<ActionResult<ChatMessageDto>> SendMessage(
        Guid id,
        SendChatMessageRequest request,
        CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(User)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        var roles = await userManager.GetRolesAsync(user);

        var conversation = await db.ChatConversations
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy cuộc trò chuyện.", StatusCodes.Status404NotFound);

        await EnsureCanAccessConversation(conversation, user.Id, roles, cancellationToken);

        if (conversation.IsClosed)
        {
            throw new ApiException("Cuộc trò chuyện này đã kết thúc.", StatusCodes.Status400BadRequest);
        }

        var senderRole = DetermineSenderRole(user, roles, conversation.ProviderId);
        var senderName = DetermineSenderName(user, senderRole, conversation.ProviderBusinessName);

        var message = new ChatMessage
        {
            ConversationId = conversation.Id,
            SenderUserId = user.Id,
            SenderName = senderName,
            SenderRole = senderRole,
            Content = request.Content.Trim(),
            SentAtUtc = DateTime.UtcNow,
            IsRead = false
        };

        conversation.LastMessageText = message.Content;
        conversation.LastMessageAtUtc = message.SentAtUtc;

        db.ChatMessages.Add(message);
        await db.SaveChangesAsync(cancellationToken);

        var messageDto = new ChatMessageDto(
            message.Id,
            message.ConversationId,
            message.SenderUserId,
            message.SenderName,
            message.SenderRole,
            message.Content,
            message.SentAtUtc,
            message.IsRead
        );

        var conversationDto = new ConversationDto(
            conversation.Id,
            conversation.CustomerId,
            conversation.CustomerName,
            conversation.ProviderId,
            conversation.ProviderBusinessName,
            conversation.Topic,
            conversation.LastMessageText,
            conversation.LastMessageAtUtc,
            conversation.CreatedAtUtc,
            conversation.IsClosed,
            0
        );

        await hubContext.Clients.Group($"conversation-{id}").SendAsync("ReceiveMessage", messageDto, cancellationToken);
        await hubContext.Clients.All.SendAsync("ConversationUpdated", conversationDto, cancellationToken);

        return Created(string.Empty, messageDto);
    }

    [HttpPost("conversations/{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);

        var unreadMessages = await db.ChatMessages
            .Where(x => x.ConversationId == id && x.SenderUserId != userId && !x.IsRead)
            .ToListAsync(cancellationToken);

        if (unreadMessages.Count > 0)
        {
            foreach (var message in unreadMessages)
            {
                message.IsRead = true;
            }
            await db.SaveChangesAsync(cancellationToken);
        }

        return NoContent();
    }

    [HttpPost("conversations/{id:guid}/close")]
    public async Task<IActionResult> CloseConversation(Guid id, CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(User)
            ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
        var roles = await userManager.GetRolesAsync(user);

        var conversation = await db.ChatConversations
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy cuộc trò chuyện.", StatusCodes.Status404NotFound);

        await EnsureCanAccessConversation(conversation, user.Id, roles, cancellationToken);

        conversation.IsClosed = true;
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task EnsureCanAccessConversation(
        ChatConversation conversation,
        string userId,
        IList<string> roles,
        CancellationToken cancellationToken)
    {
        if (roles.Contains(RoleNames.Admin) || roles.Contains(RoleNames.Manager))
        {
            return;
        }

        if (conversation.CustomerId == userId)
        {
            return;
        }

        if (conversation.ProviderId.HasValue)
        {
            var isProviderOwner = await db.ProviderProfiles.AnyAsync(
                x => x.Id == conversation.ProviderId.Value && x.UserId == userId,
                cancellationToken);
            if (isProviderOwner)
            {
                return;
            }
        }

        throw new ApiException("Bạn không có quyền truy cập cuộc trò chuyện này.", StatusCodes.Status403Forbidden);
    }

    private static string DetermineSenderRole(ApplicationUser user, IList<string> roles, Guid? providerId)
    {
        if (roles.Contains(RoleNames.Admin)) return "Admin";
        if (roles.Contains(RoleNames.Manager)) return "Manager";
        if (roles.Contains(RoleNames.Provider) && providerId.HasValue) return "Provider";
        return "Customer";
    }

    private static string DetermineSenderName(ApplicationUser user, string senderRole, string? providerBusinessName)
    {
        return senderRole switch
        {
            "Admin" => $"{user.DisplayName} (Admin)",
            "Manager" => $"{user.DisplayName} (CSKH)",
            "Provider" => !string.IsNullOrWhiteSpace(providerBusinessName) ? providerBusinessName : user.DisplayName,
            _ => user.DisplayName
        };
    }
}
