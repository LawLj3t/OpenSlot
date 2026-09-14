using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenSlot.Api.Data;
using OpenSlot.Api.Domain.Entities;
using OpenSlot.Api.Infrastructure;
using OpenSlot.Api.Services;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using System.Security.Claims;
using Microsoft.AspNetCore.HttpOverrides;
using OpenSlot.Api.Realtime;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var connectionString = builder.Configuration.GetConnectionString("OpenSlotDb")
    ?? throw new InvalidOperationException("Connection string 'OpenSlotDb' is not configured.");
var usesPostgreSql = IsPostgreSqlConnectionString(connectionString);
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("JWT configuration is missing.");
if (string.IsNullOrWhiteSpace(jwtOptions.Key))
{
    throw new InvalidOperationException("JWT key is not configured. Set Jwt__Key as an environment variable.");
}
if (Encoding.UTF8.GetByteCount(jwtOptions.Key) < 32)
{
    throw new InvalidOperationException("JWT key must be at least 32 bytes.");
}

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection(EmailOptions.SectionName));
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
var dataProtectionPath = Path.Combine(Path.GetTempPath(), "OpenSlot-DataProtection-Keys");
Directory.CreateDirectory(dataProtectionPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionPath))
    .SetApplicationName("OpenSlot");
builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (usesPostgreSql)
    {
        // Booking uses an explicit transaction to prevent two customers from
        // reserving the same capacity. Npgsql's automatic retry strategy does
        // not support a manually managed transaction unless every operation is
        // wrapped in an execution strategy, so use the provider default here.
        options.UseNpgsql(connectionString);
        return;
    }

    options.UseSqlite(connectionString);
});
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireNonAlphanumeric = false;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
    options.TokenLifespan = TimeSpan.FromMinutes(30));

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrWhiteSpace(userId))
                {
                    context.Fail("Token does not contain a valid user identifier.");
                    return;
                }

                var securityStamp = context.Principal?.FindFirstValue("security_stamp");
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var isActive = await db.Users.AnyAsync(
                    user => user.Id == userId && !user.IsSuspended &&
                            !string.IsNullOrWhiteSpace(securityStamp) && user.SecurityStamp == securityStamp,
                    context.HttpContext.RequestAborted);
                if (!isActive)
                {
                    context.Fail("The account is suspended or no longer exists.");
                }
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        var response = context.HttpContext.Response;
        response.StatusCode = StatusCodes.Status429TooManyRequests;
        response.ContentType = "application/problem+json";
        await response.WriteAsJsonAsync(new
        {
            type = "https://httpstatuses.com/429",
            title = "Request failed",
            status = StatusCodes.Status429TooManyRequests,
            detail = "Bạn đã gửi quá nhiều yêu cầu email. Vui lòng chờ ít phút rồi thử lại."
        }, cancellationToken);
    };
    options.AddPolicy("booking", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        httpContext.User.Identity?.Name ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 6,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
    // Only routes that actually send an email share this quota. Confirmation
    // and password reset submissions do not send mail and must not consume it.
    options.AddPolicy("email-send", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 8,
            Window = TimeSpan.FromMinutes(15),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
});
builder.Services.AddCors(options => options.AddPolicy("OpenSlotWeb", policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()));
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddHttpClient<IEmailVerificationService, GmailApiEmailVerificationService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<IPasswordHasher<Booking>, PasswordHasher<Booking>>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddSingleton<ISlotAvailabilityNotifier, SlotAvailabilityNotifier>();
builder.Services.AddHostedService<SlotLifecycleWorker>();

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseForwardedHeaders();
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // The existing migrations were generated for SQLite. A new PostgreSQL
    // database is created from the current EF model so provider-specific
    // identity columns are generated correctly; SQLite keeps its migrations
    // for local development and backwards compatibility.
    if (usesPostgreSql)
    {
        await db.Database.EnsureCreatedAsync();
        await CheckoutHoldSchemaInitializer.EnsureCreatedAsync(db);
    }
    else
    {
        await db.Database.MigrateAsync();
    }
    if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("SeedDemoData"))
    {
        await DbInitializer.InitializeAsync(scope.ServiceProvider);
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
var spaIndexPath = Path.Combine(app.Environment.WebRootPath ?? string.Empty, "index.html");
if (File.Exists(spaIndexPath))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
app.UseCors("OpenSlotWeb");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.MapHub<AvailabilityHub>("/hubs/availability");
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "OpenSlot.Api", utcNow = DateTime.UtcNow }));
if (File.Exists(spaIndexPath))
{
    app.MapFallbackToFile("index.html");
}

app.Run();

static bool IsPostgreSqlConnectionString(string value) =>
    value.StartsWith("Host=", StringComparison.OrdinalIgnoreCase)
    || value.StartsWith("Server=", StringComparison.OrdinalIgnoreCase)
    || value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
    || value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase);

public partial class Program;
