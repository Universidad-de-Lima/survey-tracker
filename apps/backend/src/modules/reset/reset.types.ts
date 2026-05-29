import type { SurveyCounts } from '@/modules/surveys/survey.types';

export interface ResetResult {
  message: string;
  previousCounts: SurveyCounts;
}
