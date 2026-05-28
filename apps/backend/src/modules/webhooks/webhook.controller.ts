import type { FastifyReply, FastifyRequest } from 'fastify';
import { processZohoWebhook } from '@/modules/webhooks/webhook.service';
import { zohoWebhookPayloadSchema } from '@/modules/webhooks/webhook.schema';
import { AppError } from '@/shared/errors/app-error';
import { logger } from '@/shared/utils/logger';

export async function handleZohoWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.info('Zoho webhook received', { body: request.body });

  const parsed = zohoWebhookPayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    throw AppError.validationError(parsed.error.format());
  }

  const result = await processZohoWebhook(parsed.data);

  reply.status(200).send({
    message: 'Webhook de Zoho procesado con éxito.',
    completed: result.completed,
  });
}
