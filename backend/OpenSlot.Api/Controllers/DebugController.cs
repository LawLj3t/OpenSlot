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
            Slots = await _db.DealSlots.CountAsync(),
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
                u.DisplayName,
                u.EmailConfirmed,
                u.IsSuspended,
                u.CreatedAtUtc
            })
            .Take(10)
            .ToListAsync();
        return Ok(users);
    }

    [HttpGet("slots")]
    public async Task<IActionResult> GetSlots()
    {
        var slots = await _db.DealSlots
            .Include(s => s.ServiceOffering)
                .ThenInclude(so => so.Category)
            .Select(s => new
            {
                s.Id,
                Title = s.ServiceOffering.Name,
                Category = s.ServiceOffering.Category.Name,
                StartsAt = s.StartAtUtc,
                EndsAt = s.EndAtUtc,
                OriginalPrice = s.OriginalPriceVnd,
                DiscountedPrice = s.DealPriceVnd,
                s.Capacity,
                s.ConfirmedBookingCount,
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
            .Include(b => b.DealSlot)
                .ThenInclude(s => s.ServiceOffering)
            .Include(b => b.CustomerUser)
            .Select(b => new
            {
                b.Id,
                b.PublicCode,
                CustomerEmail = b.CustomerUser.Email,
                SlotTitle = b.DealSlot.ServiceOffering.Name,
                TotalPrice = b.DealSlot.DealPriceVnd,
                b.Status,
                BookedAt = b.BookedAtUtc
            })
            .Take(10)
            .ToListAsync();
        return Ok(bookings);
    }
}
