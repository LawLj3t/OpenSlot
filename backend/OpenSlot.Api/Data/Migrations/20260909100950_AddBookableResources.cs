using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSlot.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBookableResources : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BookableResourceId",
                table: "DealSlots",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BookableResources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VenueId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    ResourceType = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 60, nullable: true),
                    FloorOrZone = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    PositionDescription = table.Column<string>(type: "TEXT", maxLength: 255, nullable: true),
                    MaxCapacity = table.Column<int>(type: "INTEGER", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookableResources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookableResources_Venues_VenueId",
                        column: x => x.VenueId,
                        principalTable: "Venues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DealSlots_BookableResourceId_StartAtUtc",
                table: "DealSlots",
                columns: new[] { "BookableResourceId", "StartAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_BookableResources_VenueId_Code",
                table: "BookableResources",
                columns: new[] { "VenueId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BookableResources_VenueId_IsActive",
                table: "BookableResources",
                columns: new[] { "VenueId", "IsActive" });

            migrationBuilder.AddForeignKey(
                name: "FK_DealSlots_BookableResources_BookableResourceId",
                table: "DealSlots",
                column: "BookableResourceId",
                principalTable: "BookableResources",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DealSlots_BookableResources_BookableResourceId",
                table: "DealSlots");

            migrationBuilder.DropTable(
                name: "BookableResources");

            migrationBuilder.DropIndex(
                name: "IX_DealSlots_BookableResourceId_StartAtUtc",
                table: "DealSlots");

            migrationBuilder.DropColumn(
                name: "BookableResourceId",
                table: "DealSlots");
        }
    }
}
