using System.ComponentModel.DataAnnotations;
using OpenSlot.Api.Contracts.Auth;

namespace OpenSlot.Tests;

public sealed class GmailRegistrationValidationTests
{
    [Theory]
    [InlineData("lam@gmail.com")]
    [InlineData("LAM@GMAIL.COM")]
    public void GmailAddress_IsAccepted(string email)
    {
        Assert.Empty(Validate(email));
    }

    [Theory]
    [InlineData("lam@yahoo.com")]
    [InlineData("lam@gmail")]
    [InlineData("lam gmail.com")]
    [InlineData("lam@googlemail.com")]
    public void NonGmailAddress_IsRejected(string email)
    {
        var errors = Validate(email);
        Assert.Contains(errors, error => error.MemberNames.Contains(nameof(RegisterRequest.Email)));
    }

    private static List<ValidationResult> Validate(string email)
    {
        var request = new RegisterRequest
        {
            DisplayName = "Người dùng kiểm thử",
            Email = email,
            Password = "Password@123"
        };
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(request, new ValidationContext(request), results, validateAllProperties: true);
        return results;
    }
}
