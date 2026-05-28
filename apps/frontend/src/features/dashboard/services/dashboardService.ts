import type { GetCountsResponse } from '@survey-tracker/shared-types';

import type { DashboardCounts } from '@/features/dashboard/types';
import { apiClient } from '@/shared/services/api';

export async function fetchSurveyCounts(): Promise<DashboardCounts> {
  const data = await apiClient.get<GetCountsResponse>('/get-counts');
  return {
    scanned: data.scanned,
    completed: data.completed,
    pending: Math.max(0, data.scanned - data.completed),
  };
}
