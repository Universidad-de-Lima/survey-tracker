import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCounts } from '@/modules/surveys/survey.service';

export async function handleGetCounts(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const counts = await getCounts();
  reply.status(200).send(counts);
}
