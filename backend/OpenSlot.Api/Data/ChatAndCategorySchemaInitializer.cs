using Microsoft.EntityFrameworkCore;

namespace OpenSlot.Api.Data;

public static class ChatAndCategorySchemaInitializer
{
    public static async Task EnsureCreatedAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        var isPostgres = string.Equals(db.Database.ProviderName, "Npgsql.EntityFrameworkCore.PostgreSQL", StringComparison.Ordinal);
        if (isPostgres)
        {
            await EnsurePostgreSqlAsync(db, cancellationToken);
        }
        else
        {
            await EnsureSqliteAsync(db, cancellationToken);
        }
    }

    private static async Task EnsureSqliteAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        // 1. Add CategoryId column to ProviderProfiles if not present
        try
        {
            using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = "PRAGMA table_info(ProviderProfiles);";
            await db.Database.OpenConnectionAsync(cancellationToken);
            var hasCategoryId = false;
            using (var reader = await command.ExecuteReaderAsync(cancellationToken))
            {
                while (await reader.ReadAsync(cancellationToken))
                {
                    var colName = reader.GetString(1);
                    if (string.Equals(colName, "CategoryId", StringComparison.OrdinalIgnoreCase))
                    {
                        hasCategoryId = true;
                        break;
                    }
                }
            }
            if (!hasCategoryId)
            {
                await db.Database.ExecuteSqlRawAsync(
                    @"ALTER TABLE ""ProviderProfiles"" ADD COLUMN ""CategoryId"" INTEGER NULL REFERENCES ""Categories""(""Id"");",
                    cancellationToken);
            }
        }
        catch
        {
            // Table might not exist yet before migrations
        }

        // 2. Create ChatConversations and ChatMessages
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "ChatConversations" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ChatConversations" PRIMARY KEY,
                "CustomerId" TEXT NOT NULL,
                "CustomerName" TEXT NOT NULL,
                "ProviderId" TEXT NULL,
                "ProviderBusinessName" TEXT NULL,
                "Topic" TEXT NOT NULL,
                "LastMessageText" TEXT NULL,
                "LastMessageAtUtc" TEXT NOT NULL,
                "CreatedAtUtc" TEXT NOT NULL,
                "IsClosed" INTEGER NOT NULL DEFAULT 0,
                "IsDeletedByCustomer" INTEGER NOT NULL DEFAULT 0,
                "IsDeletedByProvider" INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT "FK_ChatConversations_AspNetUsers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ChatConversations_ProviderProfiles_ProviderId" FOREIGN KEY ("ProviderId") REFERENCES "ProviderProfiles" ("Id") ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_ChatConversations_CustomerId" ON "ChatConversations" ("CustomerId");
            CREATE INDEX IF NOT EXISTS "IX_ChatConversations_ProviderId" ON "ChatConversations" ("ProviderId");
            CREATE INDEX IF NOT EXISTS "IX_ChatConversations_LastMessageAtUtc" ON "ChatConversations" ("LastMessageAtUtc");

            CREATE TABLE IF NOT EXISTS "ChatMessages" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ChatMessages" PRIMARY KEY,
                "ConversationId" TEXT NOT NULL,
                "SenderUserId" TEXT NOT NULL,
                "SenderName" TEXT NOT NULL,
                "SenderRole" TEXT NOT NULL,
                "Content" TEXT NOT NULL,
                "SentAtUtc" TEXT NOT NULL,
                "IsRead" INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT "FK_ChatMessages_ChatConversations_ConversationId" FOREIGN KEY ("ConversationId") REFERENCES "ChatConversations" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ChatMessages_AspNetUsers_SenderUserId" FOREIGN KEY ("SenderUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_ChatMessages_ConversationId_SentAtUtc" ON "ChatMessages" ("ConversationId", "SentAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_ChatMessages_SenderUserId" ON "ChatMessages" ("SenderUserId");

            CREATE TABLE IF NOT EXISTS "SupportTickets" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_SupportTickets" PRIMARY KEY,
                "UserId" TEXT NULL,
                "UserRole" TEXT NOT NULL,
                "Category" TEXT NOT NULL,
                "SenderEmail" TEXT NOT NULL,
                "Content" TEXT NOT NULL,
                "AttachmentFileName" TEXT NULL,
                "AttachmentData" TEXT NULL,
                "Status" INTEGER NOT NULL DEFAULT 0,
                "ResolutionNote" TEXT NULL,
                "ResolvedByUserId" TEXT NULL,
                "ResolvedByName" TEXT NULL,
                "CreatedAtUtc" TEXT NOT NULL,
                "ResolvedAtUtc" TEXT NULL,
                CONSTRAINT "FK_SupportTickets_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL,
                CONSTRAINT "FK_SupportTickets_AspNetUsers_ResolvedByUserId" FOREIGN KEY ("ResolvedByUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_SupportTickets_Status" ON "SupportTickets" ("Status");
            CREATE INDEX IF NOT EXISTS "IX_SupportTickets_CreatedAtUtc" ON "SupportTickets" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_SupportTickets_SenderEmail" ON "SupportTickets" ("SenderEmail");
            """,
            cancellationToken);

        try { await db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""SupportTickets"" ADD COLUMN ""AttachmentFileName"" TEXT NULL;", cancellationToken); } catch { }
        try { await db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""SupportTickets"" ADD COLUMN ""AttachmentData"" TEXT NULL;", cancellationToken); } catch { }
        try { await db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""ChatConversations"" ADD COLUMN ""IsDeletedByCustomer"" INTEGER NOT NULL DEFAULT 0;", cancellationToken); } catch { }
        try { await db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""ChatConversations"" ADD COLUMN ""IsDeletedByProvider"" INTEGER NOT NULL DEFAULT 0;", cancellationToken); } catch { }
    }

    private static async Task EnsurePostgreSqlAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            ALTER TABLE "ProviderProfiles" ADD COLUMN IF NOT EXISTS "CategoryId" integer NULL;

            CREATE TABLE IF NOT EXISTS "ChatConversations" (
                "Id" uuid NOT NULL,
                "CustomerId" text NOT NULL,
                "CustomerName" character varying(120) NOT NULL,
                "ProviderId" uuid NULL,
                "ProviderBusinessName" character varying(160) NULL,
                "Topic" character varying(200) NOT NULL,
                "LastMessageText" character varying(2000) NULL,
                "LastMessageAtUtc" timestamp with time zone NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "IsClosed" boolean NOT NULL DEFAULT FALSE,
                "IsDeletedByCustomer" boolean NOT NULL DEFAULT FALSE,
                "IsDeletedByProvider" boolean NOT NULL DEFAULT FALSE,
                CONSTRAINT "PK_ChatConversations" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ChatConversations_AspNetUsers_CustomerId"
                    FOREIGN KEY ("CustomerId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ChatConversations_ProviderProfiles_ProviderId"
                    FOREIGN KEY ("ProviderId") REFERENCES "ProviderProfiles" ("Id") ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_ChatConversations_CustomerId" ON "ChatConversations" ("CustomerId");
            CREATE INDEX IF NOT EXISTS "IX_ChatConversations_ProviderId" ON "ChatConversations" ("ProviderId");
            CREATE INDEX IF NOT EXISTS "IX_ChatConversations_LastMessageAtUtc" ON "ChatConversations" ("LastMessageAtUtc");

            CREATE TABLE IF NOT EXISTS "ChatMessages" (
                "Id" uuid NOT NULL,
                "ConversationId" uuid NOT NULL,
                "SenderUserId" text NOT NULL,
                "SenderName" character varying(120) NOT NULL,
                "SenderRole" character varying(40) NOT NULL,
                "Content" character varying(2000) NOT NULL,
                "SentAtUtc" timestamp with time zone NOT NULL,
                "IsRead" boolean NOT NULL DEFAULT FALSE,
                CONSTRAINT "PK_ChatMessages" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ChatMessages_ChatConversations_ConversationId"
                    FOREIGN KEY ("ConversationId") REFERENCES "ChatConversations" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ChatMessages_AspNetUsers_SenderUserId"
                    FOREIGN KEY ("SenderUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_ChatMessages_ConversationId_SentAtUtc" ON "ChatMessages" ("ConversationId", "SentAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_ChatMessages_SenderUserId" ON "ChatMessages" ("SenderUserId");

            CREATE TABLE IF NOT EXISTS "SupportTickets" (
                "Id" uuid NOT NULL,
                "UserId" text NULL,
                "UserRole" character varying(30) NOT NULL,
                "Category" character varying(120) NOT NULL,
                "SenderEmail" character varying(160) NOT NULL,
                "Content" character varying(4000) NOT NULL,
                "AttachmentFileName" character varying(260) NULL,
                "AttachmentData" text NULL,
                "Status" integer NOT NULL DEFAULT 0,
                "ResolutionNote" character varying(4000) NULL,
                "ResolvedByUserId" text NULL,
                "ResolvedByName" character varying(120) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "ResolvedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "PK_SupportTickets" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_SupportTickets_AspNetUsers_UserId"
                    FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL,
                CONSTRAINT "FK_SupportTickets_AspNetUsers_ResolvedByUserId"
                    FOREIGN KEY ("ResolvedByUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL
            );
            ALTER TABLE "SupportTickets" ADD COLUMN IF NOT EXISTS "AttachmentFileName" character varying(260) NULL;
            ALTER TABLE "SupportTickets" ADD COLUMN IF NOT EXISTS "AttachmentData" text NULL;
            ALTER TABLE "ChatConversations" ADD COLUMN IF NOT EXISTS "IsDeletedByCustomer" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "ChatConversations" ADD COLUMN IF NOT EXISTS "IsDeletedByProvider" boolean NOT NULL DEFAULT FALSE;
            CREATE INDEX IF NOT EXISTS "IX_SupportTickets_Status" ON "SupportTickets" ("Status");
            CREATE INDEX IF NOT EXISTS "IX_SupportTickets_CreatedAtUtc" ON "SupportTickets" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_SupportTickets_SenderEmail" ON "SupportTickets" ("SenderEmail");
            """,
            cancellationToken);
    }
}
