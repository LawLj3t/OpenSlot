using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSlot.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSlotHolds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SlotHolds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DealSlotId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CustomerUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ReleasedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ConfirmedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    BookingId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ReleaseReason = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlotHolds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SlotHolds_AspNetUsers_CustomerUserId",
                        column: x => x.CustomerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SlotHolds_DealSlots_DealSlotId",
                        column: x => x.DealSlotId,
                        principalTable: "DealSlots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SlotHolds_CustomerUserId_DealSlotId_Status",
                table: "SlotHolds",
                columns: new[] { "CustomerUserId", "DealSlotId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SlotHolds_DealSlotId_Status_ExpiresAtUtc",
                table: "SlotHolds",
                columns: new[] { "DealSlotId", "Status", "ExpiresAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlotHolds");
        }
    }
}
