import { getSurveyCounts } from '@/modules/surveys/survey.repository';
import type { SurveyCounts } from '@/modules/surveys/survey.types';

export async function getCounts(): Promise<SurveyCounts> {
  return getSurveyCounts();
}
