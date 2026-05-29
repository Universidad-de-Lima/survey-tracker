import type { FastifyReply, FastifyRequest } from 'fastify';

import { processReset } from '@/modules/reset/reset.service';
import { AppError } from '@/shared/errors/app-error';

export async function handleReset(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization) {
    throw AppError.unauthorized('Missing Authorization header');
  }

  const result = await processReset(authorization);

  reply.status(200).send({
    message: result.message,
    previousCounts: result.previousCounts,
  });
}
