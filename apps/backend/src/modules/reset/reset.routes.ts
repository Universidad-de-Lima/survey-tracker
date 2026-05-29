import type { FastifyInstance } from 'fastify';

import { handleReset } from '@/modules/reset/reset.controller';

export async function resetRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/reset-counts', handleReset);
}
