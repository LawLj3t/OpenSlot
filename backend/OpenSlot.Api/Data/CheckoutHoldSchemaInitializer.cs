using Microsoft.EntityFrameworkCore;

namespace OpenSlot.Api.Data;

/// <summary>
/// PostgreSQL is initialized with EnsureCreated because the earlier development
/// migrations target SQLite. This additive initializer upgrades an existing live
/// database without rebuilding it or deleting customer data.
/// </summary>
public static class CheckoutHoldSchemaInitializer
{
    public static async Task EnsureCreatedAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(db.Database.ProviderName, "Npgsql.EntityFrameworkCore.PostgreSQL", StringComparison.Ordinal))
        {
            return;
        }

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "SlotHolds" (
                "Id" uuid NOT NULL,
                "DealSlotId" uuid NOT NULL,
                "CustomerUserId" text NOT NULL,
                "Status" integer NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "ExpiresAtUtc" timestamp with time zone NOT NULL,
                "ReleasedAtUtc" timestamp with time zone NULL,
                "ConfirmedAtUtc" timestamp with time zone NULL,
                "BookingId" uuid NULL,
                "ReleaseReason" character varying(200) NULL,
                CONSTRAINT "PK_SlotHolds" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_SlotHolds_AspNetUsers_CustomerUserId"
                    FOREIGN KEY ("CustomerUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_SlotHolds_DealSlots_DealSlotId"
                    FOREIGN KEY ("DealSlotId") REFERENCES "DealSlots" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_SlotHolds_CustomerUserId_DealSlotId_Status"
                ON "SlotHolds" ("CustomerUserId", "DealSlotId", "Status");
            CREATE INDEX IF NOT EXISTS "IX_SlotHolds_DealSlotId_Status_ExpiresAtUtc"
                ON "SlotHolds" ("DealSlotId", "Status", "ExpiresAtUtc");
            """,
            cancellationToken);
    }
}
