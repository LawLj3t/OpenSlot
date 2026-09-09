using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Contracts.Moderation;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Domain.Enums;
using OpenSlot.Api.Infrastructure;

namespace OpenSlot.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/reports")]
public sealed class ReportsController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateReportRequest request, CancellationToken cancellationToken)
    {
        var targetType = request.TargetType.Trim().ToLowerInvariant();
        if (targetType is not ("slot" or "provider" or "booking"))
        {
            throw new ApiException("Loại đối tượng báo cáo không hợp lệ.");
        }

        var targetId = request.TargetId.Trim();
        if (!Guid.TryParse(targetId, out var parsedTargetId))
        {
            throw new ApiException("Mã đối tượng báo cáo không hợp lệ.");
        }

        var targetExists = targetType switch
        {
            "slot" => await db.DealSlots.AnyAsync(x => x.Id == parsedTargetId, cancellationToken),
            "provider" => await db.ProviderProfiles.AnyAsync(x => x.Id == parsedTargetId, cancellationToken),
            "booking" => await db.Bookings.AnyAsync(x => x.Id == parsedTargetId && x.CustomerUserId == UserId, cancellationToken),
            _ => false
        };
        if (!targetExists)
        {
            throw new ApiException("Không tìm thấy đối tượng cần báo cáo.", StatusCodes.Status404NotFound);
        }

        var duplicate = await db.Reports.AnyAsync(x => x.ReporterUserId == UserId && x.TargetType == targetType && x.TargetId == targetId && x.Status == ReportStatus.Open, cancellationToken);
        if (duplicate)
        {
            throw new ApiException("Bạn đã gửi báo cáo cho nội dung này.", StatusCodes.Status409Conflict);
        }

        var report = new Report { ReporterUserId = UserId, TargetType = targetType, TargetId = targetId, Reason = request.Reason.Trim() };
        db.Reports.Add(report);
        await db.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { report.Id, report.Status });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ReportStatus? status, CancellationToken cancellationToken)
    {
        var query = db.Reports.AsNoTracking().Include(x => x.ReporterUser).AsQueryable();
        if (status.HasValue) query = query.Where(x => x.Status == status);
        return Ok(await query.OrderByDescending(x => x.CreatedAtUtc).Select(x => new { x.Id, x.TargetType, x.TargetId, x.Reason, x.Status, x.CreatedAtUtc, reporterName = x.ReporterUser.DisplayName, reporterEmail = x.ReporterUser.Email }).ToListAsync(cancellationToken));
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id, ResolveReportRequest request, CancellationToken cancellationToken)
    {
        var report = await db.Reports.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("Không tìm thấy báo cáo.", StatusCodes.Status404NotFound);
        report.Status = ReportStatus.Resolved;
        db.AuditLogs.Add(new AuditLog { ActorUserId = UserId, Action = "report.resolved", EntityType = nameof(Report), EntityId = report.Id.ToString(), Metadata = request.ResolutionNote.Trim() });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new ApiException("Phiên đăng nhập không hợp lệ.", StatusCodes.Status401Unauthorized);
}
