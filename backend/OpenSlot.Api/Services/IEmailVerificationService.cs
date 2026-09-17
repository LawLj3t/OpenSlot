using OpenSlot.Api.Domain.Entities;

namespace OpenSlot.Api.Services;

public interface IEmailVerificationService
{
    bool IsConfigured { get; }
    Task SendConfirmationAsync(ApplicationUser user, string confirmationLink, CancellationToken cancellationToken = default);
    Task SendPasswordResetAsync(ApplicationUser user, string resetLink, CancellationToken cancellationToken = default);
    Task SendSupportTicketResolutionAsync(
        string recipientEmail,
        string recipientName,
        Guid ticketId,
        string category,
        string originalContent,
        string resolutionNote,
        string resolverName,
        CancellationToken cancellationToken = default);
}
