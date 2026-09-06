export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: unknown;

  constructor(message: string, statusCode = 400, errors: unknown = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
