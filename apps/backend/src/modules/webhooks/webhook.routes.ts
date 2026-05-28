import type { FastifyInstance } from 'fastify';

import { handleZohoWebhook } from '@/modules/webhooks/webhook.controller';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/zoho-webhook', handleZohoWebhook);
}
