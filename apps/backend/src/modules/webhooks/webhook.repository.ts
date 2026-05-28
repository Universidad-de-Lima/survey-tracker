import { getFirebaseDb } from '@/config/firebase';
import { logger } from '@/shared/utils/logger';
import { AppError } from '@/shared/errors/app-error';

const SURVEY_COUNTS_REF = 'survey_counts';
const COMPLETED_FIELD = 'completed';

export async function incrementCompletedCount(): Promise<number> {
  try {
    const db = getFirebaseDb();
    const completedRef = db.ref(`${SURVEY_COUNTS_REF}/${COMPLETED_FIELD}`);

    const result = await completedRef.transaction((currentCount) => {
      return Number(currentCount ?? 0) + 1;
    });

    const newCount = (result?.snapshot.val() as number) ?? 0;
    logger.info('Completed count incremented', { newCount });
    return newCount;
  } catch (error) {
    logger.error('Failed to increment completed count', { error });
    throw AppError.internal('Failed to process webhook');
  }
}
