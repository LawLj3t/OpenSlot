using System.ComponentModel.DataAnnotations;

namespace OpenSlot.Api.Contracts.Chat;

public sealed class CreateConversationRequest
{
    public Guid? ProviderId { get; init; }
    [Required, MinLength(2), MaxLength(200)] public string Topic { get; init; } = "Hỗ trợ & Đặt chỗ";
    [Required, MinLength(1), MaxLength(2000)] public string InitialMessage { get; init; } = string.Empty;
}

public sealed class SendChatMessageRequest
{
    [Required, MinLength(1), MaxLength(2000)] public string Content { get; init; } = string.Empty;
}

public sealed record ConversationDto(
    Guid Id,
    string CustomerId,
    string CustomerName,
    Guid? ProviderId,
    string? ProviderBusinessName,
    string Topic,
    string? LastMessageText,
    DateTime LastMessageAtUtc,
    DateTime CreatedAtUtc,
    bool IsClosed,
    int UnreadCount);

public sealed record ChatMessageDto(
    Guid Id,
    Guid ConversationId,
    string SenderUserId,
    string SenderName,
    string SenderRole,
    string Content,
    DateTime SentAtUtc,
    bool IsRead);

public sealed record ConversationDetailDto(
    ConversationDto Conversation,
    IReadOnlyList<ChatMessageDto> Messages);
