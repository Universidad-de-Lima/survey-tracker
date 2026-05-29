import Fastify from 'fastify';

import { env } from '@/config/env';
import { registerCors } from '@/middleware/cors';
import { errorHandler } from '@/middleware/error-handler';
import { registerRateLimit } from '@/middleware/rate-limit';
import { qrRoutes } from '@/modules/qr/qr.routes';
import { resetRoutes } from '@/modules/reset/reset.routes';
import { surveyRoutes } from '@/modules/surveys/survey.routes';
import { webhookRoutes } from '@/modules/webhooks/webhook.routes';
import { logger } from '@/shared/utils/logger';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Register middleware
  await registerCors(app);
  await registerRateLimit(app);

  // Health check
  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  }));

  // Register routes
  await app.register(qrRoutes);
  await app.register(webhookRoutes);
  await app.register(surveyRoutes);
  await app.register(resetRoutes);

  logger.info('Fastify app built successfully', {
    environment: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
  });

  return app;
}
