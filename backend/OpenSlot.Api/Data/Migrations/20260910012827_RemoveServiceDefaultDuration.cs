using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSlot.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveServiceDefaultDuration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DefaultDurationMinutes",
                table: "ServiceOfferings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DefaultDurationMinutes",
                table: "ServiceOfferings",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }
    }
}
