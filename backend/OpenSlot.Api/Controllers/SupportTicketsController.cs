using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Support;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Controllers;

[ApiController]
[Route("api/support-tickets")]
public sealed class SupportTicketsController(AppDbContext db) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost]
    public async Task<ActionResult<SupportTicketDto>> Submit(
        CreateSupportTicketRequest request,
        CancellationToken cancellationToken)
    {
        var role = string.Equals(request.UserRole, "Seller", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(request.UserRole, "Người bán", StringComparison.OrdinalIgnoreCase)
            ? "Seller"
            : "Buyer";

        var category = request.Category.Trim();
        if (string.IsNullOrWhiteSpace(category))
        {
            throw new ApiException("Vui lòng chọn vấn đề cần hỗ trợ.");
        }

        var email = request.SenderEmail.Trim();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            throw new ApiException("Email người gửi không hợp lệ.");
        }

        var content = request.Content.Trim();
        if (content.Length < 10)
        {
            throw new ApiException("Nội dung mô tả cần tối thiểu 10 ký tự.");
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var ticket = new SupportTicket
        {
            UserId = userId,
            UserRole = role,
            Category = category,
            SenderEmail = email,
            Content = content,
            AttachmentFileName = string.IsNullOrWhiteSpace(request.AttachmentFileName) ? null : request.AttachmentFileName.Trim(),
            AttachmentData = string.IsNullOrWhiteSpace(request.AttachmentData) ? null : request.AttachmentData.Trim(),
            Status = 0, // Pending
            CreatedAtUtc = DateTime.UtcNow
        };

        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync(cancellationToken);

        return Created($"/api/support-tickets/{ticket.Id}", ToDto(ticket));
    }

    [Authorize(Roles = RoleNames.CskhOrManagerOrAdmin)]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<SupportTicketDto>>> GetAll(
        [FromQuery] int? status,
        [FromQuery] string? userRole,
        CancellationToken cancellationToken)
    {
        var query = db.SupportTickets
            .AsNoTracking()
            .AsQueryable();

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(userRole))
        {
            var normalized = userRole.Trim().ToLowerInvariant();
            query = query.Where(x => x.UserRole.ToLower() == normalized);
        }

        var tickets = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(100)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);

        return Ok(tickets);
    }

    [Authorize(Roles = RoleNames.CskhOrManagerOrAdmin)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SupportTicketDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var ticket = await db.SupportTickets
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy yêu cầu hỗ trợ.", StatusCodes.Status404NotFound);

        return Ok(ToDto(ticket));
    }

    [Authorize(Roles = RoleNames.CskhOrManagerOrAdmin)]
    [HttpPost("{id:guid}/resolve")]
    public async Task<ActionResult<SupportTicketDto>> Resolve(
        Guid id,
        ResolveSupportTicketRequest request,
        CancellationToken cancellationToken)
    {
        var ticket = await db.SupportTickets
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy yêu cầu hỗ trợ.", StatusCodes.Status404NotFound);

        var resolutionNote = request.ResolutionNote.Trim();
        if (resolutionNote.Length < 5)
        {
            throw new ApiException("Nội dung phản hồi cần tối thiểu 5 ký tự.");
        }

        var resolverUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var resolverName = User.FindFirstValue(ClaimTypes.Name) ?? "CSKH OpenSlot";

        ticket.Status = request.Status ?? 2; // 2 = Resolved
        ticket.ResolutionNote = resolutionNote;
        ticket.ResolvedByUserId = resolverUserId;
        ticket.ResolvedByName = resolverName;
        ticket.ResolvedAtUtc = DateTime.UtcNow;

        if (!string.IsNullOrEmpty(resolverUserId))
        {
            db.AuditLogs.Add(new AuditLog
            {
                ActorUserId = resolverUserId,
                Action = "support-ticket.resolved",
                EntityType = nameof(SupportTicket),
                EntityId = ticket.Id.ToString(),
                Metadata = resolutionNote
            });
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(ticket));
    }

    private static SupportTicketDto ToDto(SupportTicket ticket) =>
        new(
            ticket.Id,
            ticket.UserId,
            ticket.UserRole,
            ticket.Category,
            ticket.SenderEmail,
            ticket.Content,
            ticket.AttachmentFileName,
            ticket.AttachmentData,
            ticket.Status,
            ticket.ResolutionNote,
            ticket.ResolvedByName,
            ticket.CreatedAtUtc,
            ticket.ResolvedAtUtc);
}
