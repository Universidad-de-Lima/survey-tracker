import { getFirebaseDb } from '@/config/firebase';
import { logger } from '@/shared/utils/logger';
import { AppError } from '@/shared/errors/app-error';

const SURVEY_COUNTS_REF = 'survey_counts';
const SCANNED_FIELD = 'scanned';

export async function incrementScanCount(): Promise<number> {
  try {
    const db = getFirebaseDb();
    const scannedRef = db.ref(`${SURVEY_COUNTS_REF}/${SCANNED_FIELD}`);

    const result = await scannedRef.transaction((currentCount) => {
      return ((currentCount as number) || 0) + 1;
    });

    const newCount = (result?.snapshot.val() as number) ?? 0;
    logger.info('Scan count incremented', { newCount });
    return newCount;
  } catch (error) {
    logger.error('Failed to increment scan count', { error });
    throw AppError.internal('Failed to register QR scan');
  }
}
