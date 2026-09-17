namespace OpenSlot.Api.Domain.Entities;

public sealed class ChatMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public string SenderUserId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string SenderRole { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }

    public ChatConversation Conversation { get; set; } = null!;
    public ApplicationUser SenderUser { get; set; } = null!;
}
