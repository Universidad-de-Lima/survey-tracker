import { resetSurveyCounts } from '@/modules/reset/reset.repository';
import type { ResetResult } from '@/modules/reset/reset.types';

export async function processReset(): Promise<ResetResult> {
  const previousCounts = await resetSurveyCounts();

  return {
    message: 'Contadores reseteados exitosamente.',
    previousCounts,
  };
}
