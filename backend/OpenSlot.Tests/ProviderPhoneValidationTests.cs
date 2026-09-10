using System.ComponentModel.DataAnnotations;
using OpenSlot.Api.Contracts.Auth;
using OpenSlot.Api.Contracts.Providers;

namespace OpenSlot.Tests;

public sealed class ProviderPhoneValidationTests
{
    [Theory]
    [InlineData("0900000000")]
    [InlineData("0123456789")]
    public void ValidVietnamesePhone_IsAccepted(string contactPhone)
    {
        Assert.Empty(Validate(new ApplyForProviderRequest
        {
            BusinessName = "Cửa hàng kiểm thử",
            ContactPhone = contactPhone
        }));
    }

    [Theory]
    [InlineData("qqqqqqqqqq")]
    [InlineData("1900000000")]
    [InlineData("090000000")]
    [InlineData("09000000000")]
    public void InvalidVietnamesePhone_IsRejected(string contactPhone)
    {
        var errors = Validate(new UpdateProviderProfileRequest
        {
            BusinessName = "Cửa hàng kiểm thử",
            ContactPhone = contactPhone
        });

        Assert.Contains(errors, error => error.MemberNames.Contains(nameof(UpdateProviderProfileRequest.ContactPhone)));
    }

    private static List<ValidationResult> Validate(object value)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(value, new ValidationContext(value), results, validateAllProperties: true);
        return results;
    }
}
