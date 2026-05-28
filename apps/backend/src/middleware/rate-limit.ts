import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

import { env } from '@/config/env';

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Max ${context.max} requests per ${Number(context.after) / 1000}s`,
      retryAfter: context.after,
    }),
  });
}
