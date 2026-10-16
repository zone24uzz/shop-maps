/**
 * An error that is safe to show to API clients. Anything that is not an
 * AppError is treated as unexpected and answered with a generic 500.
 */
export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(code, message) {
    return new AppError(400, code, message);
  }

  static notFound(code, message) {
    return new AppError(404, code, message);
  }

  static serviceUnavailable(code, message) {
    return new AppError(503, code, message);
  }
}
