import { env } from '@/config/env';
import { resetSurveyCounts } from '@/modules/reset/reset.repository';
import type { ResetResult } from '@/modules/reset/reset.types';
import { AppError } from '@/shared/errors/app-error';

export async function processReset(authorizationHeader: string | undefined): Promise<ResetResult> {
  const expectedKey = env.RESET_API_KEY;

  // Extract Bearer token
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '');

  if (!token || token !== expectedKey) {
    throw AppError.unauthorized('Invalid or missing API key');
  }

  const previousCounts = await resetSurveyCounts();

  return {
    message: 'Contadores reseteados exitosamente.',
    previousCounts,
  };
}
