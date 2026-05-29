import { getFirebaseDb } from '@/config/firebase';
import type { SurveyCounts } from '@/modules/surveys/survey.types';
import { AppError } from '@/shared/errors/app-error';
import { logger } from '@/shared/utils/logger';

const SURVEY_COUNTS_REF = 'survey_counts';

export async function resetSurveyCounts(): Promise<SurveyCounts> {
  try {
    const db = getFirebaseDb();
    const ref = db.ref(SURVEY_COUNTS_REF);

    // Read current values before reset
    const snapshot = await ref.once('value');
    const previousCounts = snapshot.val() as SurveyCounts | null;

    const previous: SurveyCounts = {
      scanned: previousCounts?.scanned ?? 0,
      completed: previousCounts?.completed ?? 0,
    };

    // Reset to zero
    await ref.set({
      scanned: 0,
      completed: 0,
    });

    logger.info('Survey counts reset', { previous: previous });
    return previous;
  } catch (error) {
    logger.error('Failed to reset survey counts', { error });
    throw AppError.internal('Failed to reset survey counts');
  }
}
