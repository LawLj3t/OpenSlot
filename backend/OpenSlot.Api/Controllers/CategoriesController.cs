using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Data;

namespace OpenSlot.Api.Controllers;

[ApiController]
[Route("api/categories")]
public sealed class CategoriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken) =>
        Ok(await db.Categories
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.Slug, x.IconName })
            .ToListAsync(cancellationToken));
}
