import type { SurveyCounts } from '@survey-tracker/shared-types';

export interface DashboardCounts extends SurveyCounts {
  pending: number;
  /** Marca del primer escaneo del salón; `null` si nadie ha escaneado todavía. */
  firstScanAt: number | null;
  /** Marca de la última encuesta terminada; `null` si nadie ha terminado todavía. */
  lastCompletedAt: number | null;
}

export interface SurveyTimerProps {
  firstScanAt: number | null;
  lastCompletedAt: number | null;
  pending: number;
  completed: number;
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

export interface ResetCountsResponse {
  message: string;
  previousCounts: SurveyCounts;
}
