namespace OpenSlot.Api.Domain.Entities;

public sealed class ChatConversation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public Guid? ProviderId { get; set; }
    public string? ProviderBusinessName { get; set; }
    public string Topic { get; set; } = "Hỗ trợ & Đặt chỗ";
    public string? LastMessageText { get; set; }
    public DateTime LastMessageAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public bool IsClosed { get; set; }

    public ApplicationUser Customer { get; set; } = null!;
    public ProviderProfile? Provider { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
