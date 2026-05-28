import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/app-error';
import { logger } from '@/shared/utils/logger';

export function errorHandler(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    logger.warn('Application error', {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });

    reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    logger.warn('Validation error', { validation: error.validation });
    reply.status(400).send({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.validation,
    });
    return;
  }

  // Unknown errors
  logger.error('Unhandled error', {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });

  reply.status(500).send({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
