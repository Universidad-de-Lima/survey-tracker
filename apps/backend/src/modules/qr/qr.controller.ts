import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '@/config/env';
import { processQrScan } from '@/modules/qr/qr.service';
import { logger } from '@/shared/utils/logger';

export async function handleQrScan(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.info('QR scan request received');

  await processQrScan();

  // Redirect to Zoho Survey after recording the scan
  reply.redirect(302, env.ZOHO_SURVEY_URL);
}
