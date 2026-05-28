import type { FastifyInstance } from 'fastify';

import { handleGetCounts } from '@/modules/surveys/survey.controller';

export async function surveyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/get-counts', handleGetCounts);
}
