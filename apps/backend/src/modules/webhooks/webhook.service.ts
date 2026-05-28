import { incrementCompletedCount } from '@/modules/webhooks/webhook.repository';
import type { WebhookResult } from '@/modules/webhooks/webhook.types';
import { AppError } from '@/shared/errors/app-error';
import type { ZohoWebhookPayloadDto } from '@/modules/webhooks/webhook.schema';

export async function processZohoWebhook(payload: ZohoWebhookPayloadDto): Promise<WebhookResult> {
  if (
    payload.response_status !== 'COMPLETED' ||
    payload.webhook_event !== 'response_completed'
  ) {
    throw AppError.badRequest(
      'Invalid webhook payload: expected response_status=COMPLETED and webhook_event=response_completed',
    );
  }

  const completed = await incrementCompletedCount();

  return { completed };
}
