using OpenSlot.Api.Services;

namespace OpenSlot.Tests;

public sealed class CategorySlugGeneratorTests
{
    [Theory]
    [InlineData("Ăn uống & Cà phê", "an-uong-ca-phe")]
    [InlineData("  Dịch vụ cho Đối tác  ", "dich-vu-cho-doi-tac")]
    [InlineData("Sân thể thao 24/7", "san-the-thao-24-7")]
    public void Generate_creates_a_stable_url_safe_slug(string input, string expected)
    {
        Assert.Equal(expected, CategorySlugGenerator.Generate(input));
    }
}
