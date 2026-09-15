using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSlot.Api.Data;

namespace OpenSlot.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DebugController : ControllerBase
{
    private readonly AppDbContext _db;

    public DebugController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = new
        {
            Users = await _db.Users.CountAsync(),
            Slots = await _db.Slots.CountAsync(),
            Bookings = await _db.Bookings.CountAsync(),
            Categories = await _db.Categories.CountAsync(),
            ProviderProfiles = await _db.ProviderProfiles.CountAsync(),
            DatabaseProvider = _db.Database.ProviderName,
            ConnectionString = _db.Database.GetConnectionString()?.Split(';').FirstOrDefault()
        };
        return Ok(stats);
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .Select(u => new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.EmailConfirmed,
                u.IsSuspended,
                u.CreatedAt
            })
            .Take(10)
            .ToListAsync();
        return Ok(users);
    }

    [HttpGet("slots")]
    public async Task<IActionResult> GetSlots()
    {
        var slots = await _db.Slots
            .Include(s => s.Category)
            .Select(s => new
            {
                s.Id,
                s.Title,
                Category = s.Category.Name,
                s.StartsAt,
                s.EndsAt,
                s.OriginalPrice,
                s.DiscountedPrice,
                s.Capacity,
                s.Status
            })
            .Take(10)
            .ToListAsync();
        return Ok(slots);
    }

    [HttpGet("bookings")]
    public async Task<IActionResult> GetBookings()
    {
        var bookings = await _db.Bookings
            .Include(b => b.Slot)
            .Select(b => new
            {
                b.Id,
                b.CustomerEmail,
                SlotTitle = b.Slot.Title,
                b.Quantity,
                b.TotalPrice,
                b.Status,
                b.BookedAt
            })
            .Take(10)
            .ToListAsync();
        return Ok(bookings);
    }
}
