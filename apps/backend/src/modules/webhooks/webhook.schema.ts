import { z } from 'zod';

export const zohoWebhookPayloadSchema = z.object({
  response_status: z.enum(['COMPLETED', 'INCOMPLETE', 'PARTIAL']),
  webhook_event: z.enum([
    'response_completed',
    'response_incomplete',
    'response_partial',
  ]),
});

export const webhookSuccessResponseSchema = z.object({
  message: z.string(),
});

export type ZohoWebhookPayloadDto = z.infer<typeof zohoWebhookPayloadSchema>;
export type WebhookSuccessResponseDto = z.infer<typeof webhookSuccessResponseSchema>;
