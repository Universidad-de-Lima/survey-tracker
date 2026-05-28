export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, code?: string): AppError {
    return new AppError(400, message, code ?? 'BAD_REQUEST');
  }

  static unauthorized(message = 'Unauthorized', code?: string): AppError {
    return new AppError(401, message, code ?? 'UNAUTHORIZED');
  }

  static notFound(message = 'Resource not found', code?: string): AppError {
    return new AppError(404, message, code ?? 'NOT_FOUND');
  }

  static internal(message = 'Internal server error', code?: string): AppError {
    return new AppError(500, message, code ?? 'INTERNAL_ERROR');
  }

  static validationError(details: unknown): AppError {
    return new AppError(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }
}
