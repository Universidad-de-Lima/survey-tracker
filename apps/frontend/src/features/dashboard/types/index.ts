import type { SurveyCounts } from '@survey-tracker/shared-types';

export interface DashboardCounts extends SurveyCounts {
  pending: number;
}

export interface DashboardCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'orange';
  showIndicator?: boolean;
}

export interface UseSurveyCountsResult {
  counts: DashboardCounts | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}
