import type { FastifyReply, FastifyRequest } from 'fastify';

import { processReset } from '@/modules/reset/reset.service';

export async function handleReset(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await processReset();

  reply.status(200).send({
    message: result.message,
    previousCounts: result.previousCounts,
  });
}
