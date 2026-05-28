import { getFirebaseDb } from '@/config/firebase';

import { AppError } from '@/shared/errors/app-error';
import { logger } from '@/shared/utils/logger';
import type { SurveyCounts } from '@/modules/surveys/survey.types';

const SURVEY_COUNTS_REF = 'survey_counts';

export async function getSurveyCounts(): Promise<SurveyCounts> {
  try {
    const db = getFirebaseDb();
    const snapshot = await db.ref(SURVEY_COUNTS_REF).once('value');
    const counts = snapshot.val() as SurveyCounts | null;

    const result: SurveyCounts = {
      scanned: counts?.scanned ?? 0,
      completed: counts?.completed ?? 0,
    };

    logger.info('Survey counts retrieved', result);
    return result;
  } catch (error) {
    logger.error('Failed to retrieve survey counts', { error });
    throw AppError.internal('Failed to retrieve survey counts');
  }
}
