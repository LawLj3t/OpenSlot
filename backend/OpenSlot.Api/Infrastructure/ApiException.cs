namespace OpenSlot.Api.Infrastructure;

public sealed class ApiException(string message, int statusCode = StatusCodes.Status400BadRequest) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
